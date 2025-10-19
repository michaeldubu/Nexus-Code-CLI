/**
 * File Tools - Read, Write, Edit, Bash, Glob, Grep
 * Mimics Claude Code's file access capabilities
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';
import { join, dirname } from 'path';

const execAsync = promisify(exec);

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface FileChange {
  path: string;
  action: 'read' | 'write' | 'edit';
  timestamp: string;
  oldContent?: string;
  newContent?: string;
}

export class FileTools {
  private workingDirectory: string;
  private fileHistory: FileChange[] = [];
  private approvedCommands: string[] = [];
  private deniedCommands: string[] = [];

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Set approved commands for auto-approval
   */
  setApprovedCommands(commands: string[]): void {
    this.approvedCommands = commands;
  }

  /**
   * Set denied commands
   */
  setDeniedCommands(commands: string[]): void {
    this.deniedCommands = commands;
  }

  /**
   * Check if command is approved
   */
  isCommandApproved(command: string): boolean {
    // Check denied first
    for (const denied of this.deniedCommands) {
      if (command.includes(denied)) {
        return false;
      }
    }

    // Check approved
    for (const approved of this.approvedCommands) {
      if (command.startsWith(approved)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Read file
   */
  async read(filePath: string, offset?: number, limit?: number): Promise<ToolResult> {
    try {
      const fullPath = join(this.workingDirectory, filePath);

      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: `File does not exist: ${filePath}`,
        };
      }

      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      let selectedLines: string[];
      if (offset !== undefined || limit !== undefined) {
        const start = offset || 0;
        const end = limit ? start + limit : lines.length;
        selectedLines = lines.slice(start, end);
      } else {
        selectedLines = lines;
      }

      // Format with line numbers (like cat -n)
      const formatted = selectedLines
        .map((line, idx) => {
          const lineNum = (offset || 0) + idx + 1;
          return `${lineNum.toString().padStart(6)}→${line}`;
        })
        .join('\n');

      this.recordFileChange({
        path: filePath,
        action: 'read',
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        output: formatted,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Write file
   */
  async write(filePath: string, content: string): Promise<ToolResult> {
    try {
      const fullPath = join(this.workingDirectory, filePath);
      const oldContent = existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : undefined;

      writeFileSync(fullPath, content, 'utf-8');

      this.recordFileChange({
        path: filePath,
        action: 'write',
        timestamp: new Date().toISOString(),
        oldContent,
        newContent: content,
      });

      return {
        success: true,
        output: `File written: ${filePath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Edit file (find and replace)
   */
  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<ToolResult> {
    try {
      const fullPath = join(this.workingDirectory, filePath);

      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: `File does not exist: ${filePath}`,
        };
      }

      const oldContent = readFileSync(fullPath, 'utf-8');

      // Check if old string exists
      if (!oldContent.includes(oldString)) {
        return {
          success: false,
          error: `String not found in file: "${oldString.substring(0, 50)}..."`,
        };
      }

      // Perform replacement
      let newContent: string;
      if (replaceAll) {
        newContent = oldContent.split(oldString).join(newString);
      } else {
        // Replace only first occurrence
        newContent = oldContent.replace(oldString, newString);
      }

      writeFileSync(fullPath, newContent, 'utf-8');

      this.recordFileChange({
        path: filePath,
        action: 'edit',
        timestamp: new Date().toISOString(),
        oldContent,
        newContent,
      });

      return {
        success: true,
        output: `File edited: ${filePath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Glob - find files by pattern
   */
  async globFiles(pattern: string, path?: string): Promise<ToolResult> {
    try {
      const searchPath = path || this.workingDirectory;
      const matches = await glob(pattern, {
        cwd: searchPath,
        absolute: false,
        nodir: false,
      });

      // Sort by modification time (most recent first)
      const sorted = matches.sort((a, b) => {
        const aPath = join(searchPath, a);
        const bPath = join(searchPath, b);
        const aStat = statSync(aPath);
        const bStat = statSync(bPath);
        return bStat.mtimeMs - aStat.mtimeMs;
      });

      return {
        success: true,
        output: sorted.join('\n'),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Grep - search file contents
   */
  async grep(
    pattern: string,
    options: {
      path?: string;
      glob?: string;
      caseInsensitive?: boolean;
      showLineNumbers?: boolean;
      contextBefore?: number;
      contextAfter?: number;
      filesOnly?: boolean;
    } = {}
  ): Promise<ToolResult> {
    try {
      const searchPath = options.path || this.workingDirectory;

      // Build ripgrep-like command
      let command = 'rg';

      if (options.caseInsensitive) command += ' -i';
      if (options.showLineNumbers) command += ' -n';
      if (options.filesOnly) command += ' -l';
      if (options.contextBefore) command += ` -B ${options.contextBefore}`;
      if (options.contextAfter) command += ` -A ${options.contextAfter}`;
      if (options.glob) command += ` -g "${options.glob}"`;

      command += ` "${pattern}" "${searchPath}"`;

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        success: true,
        output: stdout || '(no matches)',
      };
    } catch (error: any) {
      // ripgrep returns exit code 1 when no matches found
      if (error.code === 1) {
        return {
          success: true,
          output: '(no matches)',
        };
      }

      return {
        success: false,
        error: error.message || error.stderr,
      };
    }
  }

  /**
   * Bash - execute shell command
   */
  async bash(
    command: string,
    options: {
      timeout?: number;
      background?: boolean;
    } = {}
  ): Promise<ToolResult> {
    try {
      // Check if command is approved
      if (!this.isCommandApproved(command)) {
        return {
          success: false,
          error: `Command not pre-approved: ${command}. Add to approved list with /permissions`,
        };
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workingDirectory,
        timeout: options.timeout || 120000, // 2 min default
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        success: true,
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || error.stderr,
      };
    }
  }

  /**
   * Get file history
   */
  getFileHistory(limit: number = 10): FileChange[] {
    return this.fileHistory.slice(-limit).reverse();
  }

  /**
   * Record file change
   */
  private recordFileChange(change: FileChange): void {
    this.fileHistory.push(change);

    // Keep only last 100 changes in memory
    if (this.fileHistory.length > 100) {
      this.fileHistory = this.fileHistory.slice(-100);
    }
  }

  /**
   * Get working directory
   */
  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  /**
   * Set working directory
   */
  setWorkingDirectory(path: string): void {
    this.workingDirectory = path;
  }
}
