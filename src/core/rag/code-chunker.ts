/**
 * Code Chunker - Split code into semantic chunks for RAG
 *
 * Strategies:
 * - Function/method level chunking
 * - Class-level chunking
 * - Block-level chunking for procedural code
 * - Import/export chunking
 *
 * Preserves context and relationships
 */

import { readFileSync } from 'fs';
import { CodeChunk } from './vector-store.js';
import { v4 as uuidv4 } from 'uuid';

export interface ChunkingOptions {
  /**
   * Maximum chunk size in characters
   */
  maxChunkSize?: number;

  /**
   * Overlap between chunks (for context)
   */
  overlap?: number;

  /**
   * Minimum chunk size (skip tiny chunks)
   */
  minChunkSize?: number;
}

export class CodeChunker {
  private options: Required<ChunkingOptions>;

  constructor(options: ChunkingOptions = {}) {
    this.options = {
      maxChunkSize: options.maxChunkSize || 2000, // ~500 tokens
      overlap: options.overlap || 200, // ~50 tokens overlap
      minChunkSize: options.minChunkSize || 50,
    };
  }

  /**
   * Chunk a file into semantic units
   */
  chunkFile(
    filePath: string,
    content: string,
    language: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // Split by lines
    const lines = content.split('\n');

    // Extract top-level imports/exports first
    const importChunks = this.extractImports(filePath, lines, language);
    chunks.push(...importChunks);

    // Extract functions, classes, etc.
    if (language === 'typescript' || language === 'javascript') {
      chunks.push(...this.chunkTypeScript(filePath, lines, language));
    } else if (language === 'python') {
      chunks.push(...this.chunkPython(filePath, lines, language));
    } else {
      // Fallback: block chunking
      chunks.push(...this.chunkByBlocks(filePath, lines, language));
    }

    return chunks;
  }

  /**
   * Extract import/export statements
   */
  private extractImports(
    filePath: string,
    lines: string[],
    language: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    let importLines: number[] = [];
    let importContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (
        line.startsWith('import ') ||
        line.startsWith('export ') ||
        line.startsWith('from ') ||
        line.startsWith('require(')
      ) {
        importLines.push(i);
        importContent.push(lines[i]);
      }
    }

    // Create single import chunk if we have imports
    if (importLines.length > 0) {
      chunks.push({
        id: uuidv4(),
        filePath,
        content: importContent.join('\n'),
        startLine: importLines[0] + 1,
        endLine: importLines[importLines.length - 1] + 1,
        language,
        metadata: {
          type: 'import',
          imports: this.parseImports(importContent),
        },
      });
    }

    return chunks;
  }

  /**
   * Parse import statements to extract module names
   */
  private parseImports(importLines: string[]): string[] {
    const imports: string[] = [];

    for (const line of importLines) {
      // ES6 imports
      const importMatch = line.match(/from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        imports.push(importMatch[1]);
        continue;
      }

      // Require statements
      const requireMatch = line.match(/require\s*\(['"]([^'"]+)['"]\)/);
      if (requireMatch) {
        imports.push(requireMatch[1]);
      }
    }

    return imports;
  }

  /**
   * Chunk TypeScript/JavaScript code by functions and classes
   */
  private chunkTypeScript(
    filePath: string,
    lines: string[],
    language: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Detect function/class/interface
      if (
        line.match(/^(export\s+)?(async\s+)?function\s+\w+/) ||
        line.match(/^(export\s+)?(default\s+)?class\s+\w+/) ||
        line.match(/^(export\s+)?interface\s+\w+/) ||
        line.match(/^(export\s+)?type\s+\w+/) ||
        line.match(/^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/)
      ) {
        const { chunk, endLine } = this.extractBlock(filePath, lines, i, language);
        if (chunk) {
          chunks.push(chunk);
        }
        i = endLine;
      } else {
        i++;
      }
    }

    return chunks;
  }

  /**
   * Chunk Python code by functions and classes
   */
  private chunkPython(
    filePath: string,
    lines: string[],
    language: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Detect function/class
      if (line.match(/^def\s+\w+/) || line.match(/^class\s+\w+/)) {
        const { chunk, endLine } = this.extractPythonBlock(filePath, lines, i, language);
        if (chunk) {
          chunks.push(chunk);
        }
        i = endLine;
      } else {
        i++;
      }
    }

    return chunks;
  }

  /**
   * Extract a code block (function/class) from TypeScript/JavaScript
   */
  private extractBlock(
    filePath: string,
    lines: string[],
    startLine: number,
    language: string
  ): { chunk: CodeChunk | null; endLine: number } {
    const startContent = lines[startLine];

    // Extract name
    const nameMatch =
      startContent.match(/function\s+(\w+)/) ||
      startContent.match(/class\s+(\w+)/) ||
      startContent.match(/interface\s+(\w+)/) ||
      startContent.match(/type\s+(\w+)/) ||
      startContent.match(/const\s+(\w+)/);

    const name = nameMatch ? nameMatch[1] : undefined;

    // Determine type
    let type: CodeChunk['metadata']['type'] = 'block';
    if (startContent.includes('function') || startContent.includes('=>')) {
      type = 'function';
    } else if (startContent.includes('class')) {
      type = 'class';
    }

    // Find matching braces
    let braceCount = 0;
    let inBlock = false;
    let endLine = startLine;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inBlock = true;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && inBlock) {
            endLine = i;
            break;
          }
        }
      }

      if (braceCount === 0 && inBlock) {
        break;
      }

      // Safety: max 500 lines per block
      if (i - startLine > 500) {
        endLine = i;
        break;
      }
    }

    // Extract content
    const content = lines.slice(startLine, endLine + 1).join('\n');

    // Check size
    if (content.length < this.options.minChunkSize) {
      return { chunk: null, endLine: endLine + 1 };
    }

    // Split if too large
    if (content.length > this.options.maxChunkSize) {
      // TODO: Split large functions into smaller chunks
      // For now, just take the first part
      const truncated = content.slice(0, this.options.maxChunkSize);
      return {
        chunk: {
          id: uuidv4(),
          filePath,
          content: truncated,
          startLine: startLine + 1,
          endLine: endLine + 1,
          language,
          metadata: {
            type,
            name,
          },
        },
        endLine: endLine + 1,
      };
    }

    return {
      chunk: {
        id: uuidv4(),
        filePath,
        content,
        startLine: startLine + 1,
        endLine: endLine + 1,
        language,
        metadata: {
          type,
          name,
        },
      },
      endLine: endLine + 1,
    };
  }

  /**
   * Extract a Python block (function/class)
   */
  private extractPythonBlock(
    filePath: string,
    lines: string[],
    startLine: number,
    language: string
  ): { chunk: CodeChunk | null; endLine: number } {
    const startContent = lines[startLine];

    // Extract name
    const nameMatch =
      startContent.match(/def\s+(\w+)/) ||
      startContent.match(/class\s+(\w+)/);

    const name = nameMatch ? nameMatch[1] : undefined;

    // Determine type
    const type: CodeChunk['metadata']['type'] = startContent.includes('def') ? 'function' : 'class';

    // Get base indentation
    const baseIndentMatch = startContent.match(/^\s*/);
    const baseIndent = baseIndentMatch ? baseIndentMatch[0].length : 0;

    // Find end of block (next line with same or less indentation)
    let endLine = startLine;

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines
      if (line.trim() === '') continue;

      // Check indentation
      const indentMatch = line.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0].length : 0;

      if (indent <= baseIndent) {
        endLine = i - 1;
        break;
      }

      // Safety: max 500 lines
      if (i - startLine > 500) {
        endLine = i;
        break;
      }

      endLine = i;
    }

    // Extract content
    const content = lines.slice(startLine, endLine + 1).join('\n');

    // Check size
    if (content.length < this.options.minChunkSize) {
      return { chunk: null, endLine: endLine + 1 };
    }

    // Truncate if too large
    if (content.length > this.options.maxChunkSize) {
      const truncated = content.slice(0, this.options.maxChunkSize);
      return {
        chunk: {
          id: uuidv4(),
          filePath,
          content: truncated,
          startLine: startLine + 1,
          endLine: endLine + 1,
          language,
          metadata: {
            type,
            name,
          },
        },
        endLine: endLine + 1,
      };
    }

    return {
      chunk: {
        id: uuidv4(),
        filePath,
        content,
        startLine: startLine + 1,
        endLine: endLine + 1,
        language,
        metadata: {
          type,
          name,
        },
      },
      endLine: endLine + 1,
    };
  }

  /**
   * Fallback: chunk by fixed-size blocks
   */
  private chunkByBlocks(
    filePath: string,
    lines: string[],
    language: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    for (let i = 0; i < lines.length; i += 50) { // 50 lines per chunk
      const endLine = Math.min(i + 50, lines.length);
      const content = lines.slice(i, endLine).join('\n');

      if (content.trim().length >= this.options.minChunkSize) {
        chunks.push({
          id: uuidv4(),
          filePath,
          content,
          startLine: i + 1,
          endLine: endLine,
          language,
          metadata: {
            type: 'block',
          },
        });
      }
    }

    return chunks;
  }
}
