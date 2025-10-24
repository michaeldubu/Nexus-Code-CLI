/**
 * Memory Tool - Client-side implementation
 * Allows Claude to store/retrieve information across sessions
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, renameSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { ToolResult } from './file-tools.js';

export class MemoryTool {
  private memoryDir: string;
  private currentModel: string = 'shared';

  constructor(baseDir: string) {
    this.memoryDir = join(baseDir, '.nexus', 'memories');
    this.ensureMemoryDir();
  }

  private ensureMemoryDir(): void {
    if (!existsSync(this.memoryDir)) {
      mkdirSync(this.memoryDir, { recursive: true });
    }
    // Create model-specific subdirs
    const subdirs = ['shared', 'claude', 'openai'];
    for (const subdir of subdirs) {
      const path = join(this.memoryDir, subdir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    }
  }

  /**
   * Set current model to scope memory operations
   */
  setCurrentModel(provider: string): void {
    if (provider.includes('anthropic') || provider.includes('claude')) {
      this.currentModel = 'claude';
    } else if (provider.includes('openai') || provider.includes('gpt')) {
      this.currentModel = 'openai';
    } else if (provider.includes('google') || provider.includes('gemini')) {
      this.currentModel = 'openai'; // Group with OpenAI for now
    } else {
      this.currentModel = 'shared';
    }
  }

  /**
   * Validate path is within memory directory (prevent traversal attacks)
   */
  private validatePath(requestedPath: string): string {
    // Remove leading slash if present
    let cleanPath = requestedPath.startsWith('/memories')
      ? requestedPath.substring(9)
      : requestedPath;

    // If path doesn't start with model subdir, prepend it
    if (!cleanPath.startsWith('/shared') && !cleanPath.startsWith('/claude') && !cleanPath.startsWith('/openai')) {
      cleanPath = `/${this.currentModel}${cleanPath}`;
    }

    const fullPath = resolve(join(this.memoryDir, cleanPath));
    const normalizedMemoryDir = resolve(this.memoryDir);

    if (!fullPath.startsWith(normalizedMemoryDir)) {
      throw new Error('Path traversal detected - access denied');
    }

    return fullPath;
  }

  /**
   * VIEW - List directory contents or show file contents
   */
  view(path: string, viewRange?: [number, number]): ToolResult {
    try {
      const fullPath = this.validatePath(path);

      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: `Path not found: ${path}`,
        };
      }

      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        const entries = readdirSync(fullPath, { withFileTypes: true });
        const listing = entries.map(e =>
          e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`
        ).join('\n');
        return {
          success: true,
          output: `Directory: ${path}\n${listing || '(empty)'}`,
        };
      }

      // Read file
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      if (viewRange) {
        const [start, end] = viewRange;
        const selectedLines = lines.slice(start - 1, end);
        return {
          success: true,
          output: selectedLines.map((l, i) => `${start + i}: ${l}`).join('\n'),
        };
      }

      return {
        success: true,
        output: lines.map((l, i) => `${i + 1}: ${l}`).join('\n'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * CREATE - Create or overwrite a file
   */
  create(path: string, fileText: string): ToolResult {
    try {
      const fullPath = this.validatePath(path);
      const dir = dirname(fullPath);

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(fullPath, fileText, 'utf-8');
      return {
        success: true,
        output: `File created: ${path}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * STR_REPLACE - Replace text in file
   */
  strReplace(path: string, oldStr: string, newStr: string): ToolResult {
    try {
      const fullPath = this.validatePath(path);

      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: `File not found: ${path}`,
        };
      }

      const content = readFileSync(fullPath, 'utf-8');

      if (!content.includes(oldStr)) {
        return {
          success: false,
          error: `String not found in file: "${oldStr.substring(0, 50)}..."`,
        };
      }

      const newContent = content.replace(oldStr, newStr);
      writeFileSync(fullPath, newContent, 'utf-8');

      return {
        success: true,
        output: `Text replaced in ${path}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * INSERT - Insert text at specific line
   */
  insert(path: string, insertLine: number, insertText: string): ToolResult {
    try {
      const fullPath = this.validatePath(path);

      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: `File not found: ${path}`,
        };
      }

      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      if (insertLine < 1 || insertLine > lines.length + 1) {
        return {
          success: false,
          error: `Invalid line number: ${insertLine} (file has ${lines.length} lines)`,
        };
      }

      lines.splice(insertLine - 1, 0, insertText);
      writeFileSync(fullPath, lines.join('\n'), 'utf-8');

      return {
        success: true,
        output: `Text inserted at line ${insertLine} in ${path}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * DELETE - Delete file or directory
   */
  delete(path: string): ToolResult {
    try {
      const fullPath = this.validatePath(path);

      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: `Path not found: ${path}`,
        };
      }

      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        const entries = readdirSync(fullPath);
        if (entries.length > 0) {
          return {
            success: false,
            error: `Directory not empty: ${path}`,
          };
        }
      }

      unlinkSync(fullPath);

      return {
        success: true,
        output: `Deleted: ${path}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * RENAME - Rename or move file/directory
   */
  rename(oldPath: string, newPath: string): ToolResult {
    try {
      const fullOldPath = this.validatePath(oldPath);
      const fullNewPath = this.validatePath(newPath);

      if (!existsSync(fullOldPath)) {
        return {
          success: false,
          error: `Source not found: ${oldPath}`,
        };
      }

      if (existsSync(fullNewPath)) {
        return {
          success: false,
          error: `Destination already exists: ${newPath}`,
        };
      }

      const newDir = dirname(fullNewPath);
      if (!existsSync(newDir)) {
        mkdirSync(newDir, { recursive: true });
      }

      renameSync(fullOldPath, fullNewPath);

      return {
        success: true,
        output: `Renamed: ${oldPath} → ${newPath}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute memory tool command
   */
  async execute(command: string, args: any): Promise<ToolResult> {
    switch (command) {
      case 'view':
        return this.view(args.path, args.view_range);
      case 'create':
        return this.create(args.path, args.file_text);
      case 'str_replace':
        return this.strReplace(args.path, args.old_str, args.new_str);
      case 'insert':
        return this.insert(args.path, args.insert_line, args.insert_text);
      case 'delete':
        return this.delete(args.path);
      case 'rename':
        return this.rename(args.old_path, args.new_path);
      default:
        return {
          success: false,
          error: `Unknown memory command: ${command}`,
        };
    }
  }
}
