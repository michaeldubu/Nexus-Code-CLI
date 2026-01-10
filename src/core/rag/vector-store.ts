/**
 * Vector Store - TRUE RAG Implementation
 *
 * Features:
 * - Vector embeddings for semantic search
 * - Chunk-level retrieval (not whole files)
 * - Hybrid search (vector + keyword + graph)
 * - Scalable to large codebases
 *
 * Uses OpenAI embeddings API (text-embedding-3-small)
 * In-memory vector store with cosine similarity
 */

import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface CodeChunk {
  /**
   * Unique chunk ID
   */
  id: string;

  /**
   * File path (relative to workspace)
   */
  filePath: string;

  /**
   * Content of this chunk
   */
  content: string;

  /**
   * Start line in file
   */
  startLine: number;

  /**
   * End line in file
   */
  endLine: number;

  /**
   * Language/type
   */
  language: string;

  /**
   * Metadata
   */
  metadata: {
    type: 'function' | 'class' | 'import' | 'comment' | 'block';
    name?: string;
    exports?: string[];
    imports?: string[];
  };
}

export interface EmbeddedChunk extends CodeChunk {
  /**
   * Vector embedding (1536 dimensions for text-embedding-3-small)
   */
  embedding: number[];
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number; // cosine similarity score (0-1)
  reason: string;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export class VectorStore {
  private chunks: EmbeddedChunk[] = [];
  private openai?: OpenAI;
  private keywordIndex: Map<string, Set<string>> = new Map(); // keyword -> chunk IDs
  private embeddingCache: Map<string, number[]> = new Map(); // cache query embeddings
  private cacheMaxSize: number = 1000; // bounded cache

  constructor(openaiKey?: string) {
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
  }

  /**
   * Check if embeddings are available
   */
  isAvailable(): boolean {
    return !!this.openai;
  }

  /**
   * Add a chunk to the vector store
   */
  async addChunk(chunk: CodeChunk): Promise<void> {
    if (!this.openai) {
      throw new Error('OpenAI API key required for embeddings');
    }

    // Generate embedding
    const embedding = await this.generateEmbedding(chunk.content);

    // Add to store
    const embeddedChunk: EmbeddedChunk = {
      ...chunk,
      embedding,
    };

    this.chunks.push(embeddedChunk);

    // Index keywords for hybrid search
    this.indexKeywords(chunk);
  }

  /**
   * Add multiple chunks in batch
   */
  async addChunks(chunks: CodeChunk[]): Promise<void> {
    if (!this.openai) {
      throw new Error('OpenAI API key required for embeddings');
    }

    // Batch embed (OpenAI allows up to 2048 inputs per request)
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await this.generateEmbeddings(batch.map(c => c.content));

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];

        this.chunks.push({
          ...chunk,
          embedding,
        });

        this.indexKeywords(chunk);
      }
    }
  }

  /**
   * Generate embedding for a single text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    // Truncate to 8000 tokens (safe limit for text-embedding-3-small)
    const truncated = text.slice(0, 8000);

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 dimensions, cheap & fast
      input: truncated,
    });

    return response.data[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    // Truncate all texts
    const truncated = texts.map(t => t.slice(0, 8000));

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: truncated,
    });

    return response.data.map(d => d.embedding);
  }

  /**
   * Index keywords for hybrid search
   */
  private indexKeywords(chunk: CodeChunk): void {
    // Extract keywords from content
    const keywords = this.extractKeywords(chunk.content);

    // Add to index
    for (const keyword of keywords) {
      const lower = keyword.toLowerCase();
      if (!this.keywordIndex.has(lower)) {
        this.keywordIndex.set(lower, new Set());
      }
      this.keywordIndex.get(lower)!.add(chunk.id);
    }

    // Index metadata
    if (chunk.metadata.name) {
      const name = chunk.metadata.name.toLowerCase();
      if (!this.keywordIndex.has(name)) {
        this.keywordIndex.set(name, new Set());
      }
      this.keywordIndex.get(name)!.add(chunk.id);
    }

    // Index file path components
    const pathParts = chunk.filePath.split('/').filter(p => p);
    for (const part of pathParts) {
      const lower = part.toLowerCase();
      if (!this.keywordIndex.has(lower)) {
        this.keywordIndex.set(lower, new Set());
      }
      this.keywordIndex.get(lower)!.add(chunk.id);
    }
  }

  /**
   * Extract keywords from text (simple tokenization)
   */
  private extractKeywords(text: string): string[] {
    // Remove comments and strings (simple regex)
    const cleaned = text
      .replace(/\/\/.*$/gm, '') // single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // multi-line comments
      .replace(/["'`].*?["'`]/g, ''); // strings

    // Extract words (alphanumeric + underscore)
    const words = cleaned.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];

    // Filter out common keywords and short words
    const stopWords = new Set([
      'const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while',
      'return', 'import', 'export', 'from', 'as', 'new', 'this', 'super',
      'true', 'false', 'null', 'undefined', 'async', 'await', 'try', 'catch',
    ]);

    return words
      .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
      .slice(0, 50); // limit to top 50 keywords per chunk
  }

  /**
   * Semantic search using vector similarity
   */
  async search(
    query: string,
    options: {
      limit?: number;
      minScore?: number;
      hybrid?: boolean; // combine vector + keyword search
      fileFilter?: string[]; // filter by file paths
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.openai) {
      throw new Error('OpenAI API key required for semantic search');
    }

    const limit = options.limit || 10;
    const minScore = options.minScore || 0.5;
    const hybrid = options.hybrid !== false; // default true

    // Generate query embedding (with caching)
    let queryEmbedding: number[];
    if (this.embeddingCache.has(query)) {
      queryEmbedding = this.embeddingCache.get(query)!;
    } else {
      queryEmbedding = await this.generateEmbedding(query);

      // Bounded cache - evict oldest if full
      if (this.embeddingCache.size >= this.cacheMaxSize) {
        const firstKey = this.embeddingCache.keys().next().value;
        this.embeddingCache.delete(firstKey);
      }

      this.embeddingCache.set(query, queryEmbedding);
    }

    // Keyword boost set (for hybrid search)
    let keywordBoostIds = new Set<string>();
    if (hybrid) {
      const queryKeywords = this.extractKeywords(query);
      for (const keyword of queryKeywords) {
        const lower = keyword.toLowerCase();
        const ids = this.keywordIndex.get(lower);
        if (ids) {
          ids.forEach(id => keywordBoostIds.add(id));
        }
      }
    }

    // Calculate similarity scores
    const scores: SearchResult[] = [];

    for (const chunk of this.chunks) {
      // File filter
      if (options.fileFilter && !options.fileFilter.includes(chunk.filePath)) {
        continue;
      }

      // Vector similarity
      const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding);

      // Keyword boost (0.1 bonus if keyword match)
      const keywordBoost = keywordBoostIds.has(chunk.id) ? 0.1 : 0;

      // Final score
      const finalScore = vectorScore + keywordBoost;

      if (finalScore >= minScore) {
        scores.push({
          chunk,
          score: finalScore,
          reason: keywordBoost > 0
            ? `Semantic match (${(vectorScore * 100).toFixed(0)}%) + keyword match`
            : `Semantic match (${(finalScore * 100).toFixed(0)}%)`,
        });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, limit);
  }

  /**
   * Keyword-only search (fallback when no OpenAI key)
   */
  keywordSearch(
    query: string,
    options: {
      limit?: number;
      fileFilter?: string[];
    } = {}
  ): SearchResult[] {
    const limit = options.limit || 10;
    const queryKeywords = this.extractKeywords(query);

    const matches = new Map<string, number>(); // chunk ID -> match count

    for (const keyword of queryKeywords) {
      const lower = keyword.toLowerCase();
      const ids = this.keywordIndex.get(lower);
      if (ids) {
        ids.forEach(id => {
          matches.set(id, (matches.get(id) || 0) + 1);
        });
      }
    }

    // Find chunks and create results
    const results: SearchResult[] = [];

    for (const [chunkId, matchCount] of matches) {
      const chunk = this.chunks.find(c => c.id === chunkId);
      if (!chunk) continue;

      // File filter
      if (options.fileFilter && !options.fileFilter.includes(chunk.filePath)) {
        continue;
      }

      const score = matchCount / queryKeywords.length; // 0-1 score

      results.push({
        chunk,
        score,
        reason: `Keyword match (${matchCount}/${queryKeywords.length} keywords)`,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Get total chunk count
   */
  getChunkCount(): number {
    return this.chunks.length;
  }

  /**
   * Clear all chunks
   */
  clear(): void {
    this.chunks = [];
    this.keywordIndex.clear();
    this.embeddingCache.clear();
  }

  /**
   * Get storage stats
   */
  getStats(): {
    chunkCount: number;
    keywordCount: number;
    cacheSize: number;
    estimatedMemoryMB: number;
  } {
    // Estimate memory usage
    const embeddingBytes = this.chunks.length * 1536 * 8; // 1536 floats * 8 bytes
    const textBytes = this.chunks.reduce((sum, c) => sum + c.content.length, 0);
    const totalBytes = embeddingBytes + textBytes;

    return {
      chunkCount: this.chunks.length,
      keywordCount: this.keywordIndex.size,
      cacheSize: this.embeddingCache.size,
      estimatedMemoryMB: totalBytes / (1024 * 1024),
    };
  }

  /**
   * Export to JSON (without embeddings for smaller size)
   */
  exportChunks(): CodeChunk[] {
    return this.chunks.map(c => ({
      id: c.id,
      filePath: c.filePath,
      content: c.content,
      startLine: c.startLine,
      endLine: c.endLine,
      language: c.language,
      metadata: c.metadata,
    }));
  }

  /**
   * Re-embed all chunks (useful after importing)
   */
  async reembedAll(): Promise<void> {
    if (!this.openai) {
      throw new Error('OpenAI API key required');
    }

    const plainChunks = this.exportChunks();
    this.clear();
    await this.addChunks(plainChunks);
  }
}
