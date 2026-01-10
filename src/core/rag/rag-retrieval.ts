/**
 * RAG Retrieval System
 * Combines vector search, keyword search, and dependency graph
 * for intelligent context retrieval
 */

import { VectorStore, SearchResult } from './vector-store.js';
import { CodeChunker } from './code-chunker.js';
import { ContextIntelligence, RelevanceScore } from '../intelligence/context-intelligence.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface RAGOptions {
  /**
   * OpenAI API key for embeddings
   */
  openaiKey?: string;

  /**
   * Workspace root path
   */
  workspaceRoot: string;

  /**
   * Maximum chunks to return
   */
  maxChunks?: number;

  /**
   * Enable hybrid search (vector + keyword)
   */
  hybridSearch?: boolean;

  /**
   * Minimum similarity score (0-1)
   */
  minScore?: number;
}

export interface RetrievalResult {
  /**
   * Retrieved chunks (from vector search)
   */
  chunks: SearchResult[];

  /**
   * Relevant files (from graph analysis)
   */
  relevantFiles: RelevanceScore[];

  /**
   * Total context size (characters)
   */
  contextSize: number;

  /**
   * Retrieval strategy used
   */
  strategy: 'vector' | 'keyword' | 'graph' | 'hybrid';
}

export class RAGRetrieval {
  private vectorStore: VectorStore;
  private chunker: CodeChunker;
  private intelligence?: ContextIntelligence;
  private workspaceRoot: string;
  private options: Required<Omit<RAGOptions, 'openaiKey'>>;
  private isInitialized: boolean = false;

  constructor(options: RAGOptions) {
    this.vectorStore = new VectorStore(options.openaiKey);
    this.chunker = new CodeChunker();
    this.workspaceRoot = options.workspaceRoot;

    this.options = {
      workspaceRoot: options.workspaceRoot,
      maxChunks: options.maxChunks || 10,
      hybridSearch: options.hybridSearch !== false,
      minScore: options.minScore || 0.6,
    };

    // Initialize context intelligence (for graph-based retrieval)
    if (options.workspaceRoot) {
      this.intelligence = new ContextIntelligence(options.workspaceRoot);
    }
  }

  /**
   * Initialize the RAG system
   * - Analyzes workspace
   * - Chunks files
   * - Generates embeddings
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚀 Initializing RAG system...');

    // Initialize context intelligence
    if (this.intelligence) {
      await this.intelligence.initialize();
      console.log('✅ Context intelligence initialized');
    }

    // Index all files if vector store is available
    if (this.vectorStore.isAvailable()) {
      console.log('📊 Generating embeddings (this may take a few minutes)...');
      await this.indexWorkspace();
      console.log('✅ Vector embeddings generated');

      const stats = this.vectorStore.getStats();
      console.log(`📦 Indexed ${stats.chunkCount} chunks (~${stats.estimatedMemoryMB.toFixed(1)}MB)`);
    } else {
      console.log('⚠️  No OpenAI key - using keyword search only');
    }

    this.isInitialized = true;
  }

  /**
   * Index entire workspace
   */
  private async indexWorkspace(): Promise<void> {
    if (!this.intelligence) return;

    const context = this.intelligence.getContext();
    if (!context) return;

    const allChunks: any[] = [];

    // Process each file
    for (const [filePath, node] of context.graph.nodes) {
      try {
        const fullPath = join(this.workspaceRoot, filePath);
        const content = readFileSync(fullPath, 'utf-8');

        // Chunk the file
        const chunks = this.chunker.chunkFile(filePath, content, node.language);

        allChunks.push(...chunks);
      } catch (error) {
        // Skip files that can't be read
      }
    }

    console.log(`🔄 Adding ${allChunks.length} chunks to vector store...`);

    // Batch add all chunks
    await this.vectorStore.addChunks(allChunks);
  }

  /**
   * Retrieve relevant context for a query
   */
  async retrieve(
    query: string,
    currentFiles: string[] = []
  ): Promise<RetrievalResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let chunks: SearchResult[] = [];
    let relevantFiles: RelevanceScore[] = [];
    let strategy: RetrievalResult['strategy'] = 'hybrid';

    // Strategy 1: Vector search (if available)
    if (this.vectorStore.isAvailable()) {
      chunks = await this.vectorStore.search(query, {
        limit: this.options.maxChunks,
        minScore: this.options.minScore,
        hybrid: this.options.hybridSearch,
        fileFilter: currentFiles.length > 0 ? currentFiles : undefined,
      });

      strategy = this.options.hybridSearch ? 'hybrid' : 'vector';
    }
    // Strategy 2: Keyword search (fallback)
    else {
      chunks = this.vectorStore.keywordSearch(query, {
        limit: this.options.maxChunks,
        fileFilter: currentFiles.length > 0 ? currentFiles : undefined,
      });

      strategy = 'keyword';
    }

    // Strategy 3: Graph-based file retrieval
    if (this.intelligence) {
      relevantFiles = await this.intelligence.calculateRelevance(query, currentFiles);
    }

    // Calculate total context size
    const contextSize = chunks.reduce((sum, c) => sum + c.chunk.content.length, 0);

    return {
      chunks,
      relevantFiles,
      contextSize,
      strategy,
    };
  }

  /**
   * Build context string from retrieval results
   */
  buildContextString(results: RetrievalResult): string {
    const lines: string[] = [];

    if (results.chunks.length > 0) {
      lines.push('## Relevant Code Context\n');

      for (const result of results.chunks) {
        lines.push(`### ${result.chunk.filePath}:${result.chunk.startLine}-${result.chunk.endLine}`);
        lines.push(`*${result.reason} (score: ${(result.score * 100).toFixed(0)}%)*\n`);
        lines.push('```' + result.chunk.language);
        lines.push(result.chunk.content);
        lines.push('```\n');
      }
    }

    if (results.relevantFiles.length > 0) {
      lines.push('\n## Other Relevant Files\n');
      for (const file of results.relevantFiles.slice(0, 5)) {
        lines.push(`- **${file.file}**: ${file.reasons.join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get RAG stats
   */
  getStats(): {
    isInitialized: boolean;
    vectorStoreAvailable: boolean;
    chunkCount: number;
    filesAnalyzed: number;
    memoryUsageMB: number;
  } {
    const vectorStats = this.vectorStore.getStats();
    const context = this.intelligence?.getContext();

    return {
      isInitialized: this.isInitialized,
      vectorStoreAvailable: this.vectorStore.isAvailable(),
      chunkCount: vectorStats.chunkCount,
      filesAnalyzed: context?.graph.nodes.size || 0,
      memoryUsageMB: vectorStats.estimatedMemoryMB,
    };
  }

  /**
   * Clear all indexed data
   */
  clear(): void {
    this.vectorStore.clear();
    this.isInitialized = false;
  }

  /**
   * Refresh a single file (re-chunk and re-embed)
   */
  async refreshFile(filePath: string): Promise<void> {
    // TODO: Implement file-level refresh
    // For now, just reindex the entire workspace
    await this.indexWorkspace();
  }
}
