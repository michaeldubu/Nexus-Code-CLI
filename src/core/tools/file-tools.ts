/**
 * File Tools - Read, Write, Edit, Bash, Glob, Grep
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';
import { join, dirname } from 'path';
import chalk from 'chalk';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

interface BackgroundShell {
  id: string;
  command: string;
  process: ChildProcess;
  output: string[];
  startTime: number;
  status: 'running' | 'completed' | 'error';
}

/**
 * Log tool usage
 */
function logToolCall(toolName: string, params: Record<string, any>): void {
  const paramStr = Object.entries(params)
    .map(([key, value]) => {
      if (typeof value === 'string' && value.length > 60) {
        return `${key}: "${value.substring(0, 57)}..."`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(', ');

  console.log(chalk.green(`● ${toolName}(${paramStr})`));
}

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
  private verboseMode: boolean = true; // Show tool calls by default
  private bashApprovalCallback?: (command: string) => Promise<boolean>;
  private backgroundShells: Map<string, BackgroundShell> = new Map();

  // 🔥 File permissions system
  private allowedPaths: string[] = [];
  private deniedPaths: string[] = [];
  private autoApprove: boolean = false;
  private fileApprovalCallback?: (operation: string, filePath: string, details?: string) => Promise<boolean>;

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Set bash approval callback
   */
  setBashApprovalCallback(callback: (command: string) => Promise<boolean>): void {
    this.bashApprovalCallback = callback;
  }

  /**
   * Set file approval callback for write/edit operations
   */
  setFileApprovalCallback(callback: (operation: string, filePath: string, details?: string) => Promise<boolean>): void {
    this.fileApprovalCallback = callback;
  }

  /**
   * Set permissions config
   */
  setPermissions(config: { autoApprove?: boolean; allowedPaths?: string[]; deniedPaths?: string[] }): void {
    if (config.autoApprove !== undefined) this.autoApprove = config.autoApprove;
    if (config.allowedPaths) this.allowedPaths = config.allowedPaths;
    if (config.deniedPaths) this.deniedPaths = config.deniedPaths;
  }

  /**
   * Enable/disable verbose mode
   */
  setVerbose(enabled: boolean): void {
    this.verboseMode = enabled;
  }

  /**
   * Get verbose mode state
   */
  isVerbose(): boolean {
    return this.verboseMode;
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
   * Check if file operation is approved (for write/edit)
   * Returns true if approved, false if denied, undefined if needs approval
   */
  private isFileOperationApproved(filePath: string): boolean | undefined {
    const fullPath = join(this.workingDirectory, filePath);

    // Check denied paths first
    for (const denied of this.deniedPaths) {
      if (fullPath.startsWith(denied)) {
        return false;
      }
    }

    // Check allowed paths (workspace)
    for (const allowed of this.allowedPaths) {
      if (fullPath.startsWith(allowed)) {
        return true;
      }
    }

    // If autoApprove is on, approve by default
    if (this.autoApprove) {
      return true;
    }

    // Needs approval
    return undefined;
  }

  /**
   * Read file
   */
  async read(filePath: string, offset?: number, limit?: number): Promise<ToolResult> {
    if (this.verboseMode) {
      const params: Record<string, any> = { file_path: filePath };
      if (offset !== undefined) params.offset = offset;
      if (limit !== undefined) params.limit = limit;
      logToolCall('Read', params);
    }

    try {
      const fullPath = join(this.workingDirectory, filePath);

      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: `File does not exist: ${filePath}`,
        };
      }

      // Check file size BEFORE reading to prevent context overflow
      if (offset === undefined && limit === undefined) {
        const stats = require('fs').statSync(fullPath);
        const fileSizeKB = stats.size / 1024;

        // Block files over 100KB without offset/limit
        if (fileSizeKB > 100) {
          return {
            success: false,
            error: `⚠️  File too large: ${fileSizeKB.toFixed(1)}KB!\n\nReading this entire file would consume too much context. Please use offset/limit parameters:\n  Example: read_file({ file_path: "${filePath}", offset: 0, limit: 100 })\n\nOr use grep to find specific sections first.`,
          };
        }
      }

      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Secondary check: line count (in case of small file size but many short lines)
      if ((offset === undefined && limit === undefined) && lines.length > 500) {
        return {
          success: false,
          error: `⚠️  File too large: ${lines.length} lines!\n\nReading this entire file would consume too much context. Please use offset/limit parameters:\n  Example: read_file({ file_path: "${filePath}", offset: 0, limit: 100 })\n\nOr use grep to find specific sections first.`,
        };
      }

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
    if (this.verboseMode) {
      logToolCall('Write', { file_path: filePath, content_length: content.length });
    }

    try {
      const fullPath = join(this.workingDirectory, filePath);
      const oldContent = existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : undefined;

      // 🔥 Check file operation approval
      const approved = this.isFileOperationApproved(filePath);
      if (approved === false) {
        return {
          success: false,
          error: `File operation denied: ${filePath} is in a denied path`,
        };
      }

      if (approved === undefined) {
        // Need user approval
        if (this.fileApprovalCallback) {
          const userApproved = await this.fileApprovalCallback(
            'write',
            filePath,
            `Writing ${content.length} chars`
          );
          if (!userApproved) {
            return {
              success: false,
              error: `File operation denied by user: ${filePath}`,
            };
          }
        } else {
          // No callback, deny by default
          return {
            success: false,
            error: `File operation not approved: ${filePath}. Configure permissions with /permissions`,
          };
        }
      }

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
    if (this.verboseMode) {
      logToolCall('Edit', { file_path: filePath, old_string: oldString.substring(0, 40) + '...', new_string: newString.substring(0, 40) + '...', replace_all: replaceAll });
    }

    try {
      const fullPath = join(this.workingDirectory, filePath);

      if (!existsSync(fullPath)) {
        return {
          success: false,
          error: `File does not exist: ${filePath}`,
        };
      }

      const oldContent = readFileSync(fullPath, 'utf-8');

      // 🔥 Check file operation approval
      const approved = this.isFileOperationApproved(filePath);
      if (approved === false) {
        return {
          success: false,
          error: `File operation denied: ${filePath} is in a denied path`,
        };
      }

      if (approved === undefined) {
        // Need user approval
        if (this.fileApprovalCallback) {
          const userApproved = await this.fileApprovalCallback(
            'edit',
            filePath,
            `Replace "${oldString.substring(0, 30)}..." with "${newString.substring(0, 30)}..."`
          );
          if (!userApproved) {
            return {
              success: false,
              error: `File operation denied by user: ${filePath}`,
            };
          }
        } else {
          // No callback, deny by default
          return {
            success: false,
            error: `File operation not approved: ${filePath}. Configure permissions with /permissions`,
          };
        }
      }

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
    if (this.verboseMode) {
      const params: Record<string, any> = { pattern };
      if (path) params.path = path;
      logToolCall('Glob', params);
    }

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
    if (this.verboseMode) {
      logToolCall('Grep', { pattern, ...options });
    }

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
    if (this.verboseMode) {
      logToolCall('Bash', { command, ...options });
    }

    try {
      // Check if command is approved
      if (!this.isCommandApproved(command)) {
        // Request approval through callback
        if (this.bashApprovalCallback) {
          const approved = await this.bashApprovalCallback(command);
          if (!approved) {
            return {
              success: false,
              error: `Command denied by user: ${command}`,
            };
          }
        } else {
          return {
            success: false,
            error: `Command not pre-approved: ${command}. Add to approved list with /permissions`,
          };
        }
      }

      // Background execution
      if (options.background) {
        const shellId = randomUUID();
        const child = spawn('bash', ['-c', command], {
          cwd: this.workingDirectory,
          detached: false,
        });

        const shell: BackgroundShell = {
          id: shellId,
          command,
          process: child,
          output: [],
          startTime: Date.now(),
          status: 'running',
        };

        // Capture output
        child.stdout?.on('data', (data) => {
          shell.output.push(data.toString());
        });

        child.stderr?.on('data', (data) => {
          shell.output.push(`STDERR: ${data.toString()}`);
        });

        child.on('close', (code) => {
          shell.status = code === 0 ? 'completed' : 'error';
        });

        this.backgroundShells.set(shellId, shell);

        return {
          success: true,
          output: `Background shell started with ID: ${shellId}\nUse bash_output tool to read output.`,
        };
      }

      // Foreground execution (existing behavior)
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
   * Get output from background shell
   */
  async bashOutput(shellId: string, filter?: string): Promise<ToolResult> {
    if (this.verboseMode) {
      logToolCall('BashOutput', { shellId, filter });
    }

    const shell = this.backgroundShells.get(shellId);
    if (!shell) {
      return {
        success: false,
        error: `No background shell found with ID: ${shellId}`,
      };
    }

    let output = shell.output.join('');

    // Apply filter if provided
    if (filter) {
      try {
        const regex = new RegExp(filter);
        const lines = output.split('\n');
        output = lines.filter(line => regex.test(line)).join('\n');
      } catch (error: any) {
        return {
          success: false,
          error: `Invalid regex filter: ${error.message}`,
        };
      }
    }

    // Clear the output buffer after reading
    shell.output = [];

    return {
      success: true,
      output: `Shell ${shellId} (${shell.status}):\n${output}`,
    };
  }

  /**
   * Kill background shell
   */
  async killShell(shellId: string): Promise<ToolResult> {
    if (this.verboseMode) {
      logToolCall('KillShell', { shellId });
    }

    const shell = this.backgroundShells.get(shellId);
    if (!shell) {
      return {
        success: false,
        error: `No background shell found with ID: ${shellId}`,
      };
    }

    try {
      shell.process.kill('SIGTERM');
      this.backgroundShells.delete(shellId);

      return {
        success: true,
        output: `Killed background shell ${shellId}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to kill shell: ${error.message}`,
      };
    }
  }

  /**
   * List all background shells
   */
  listBackgroundShells(): BackgroundShell[] {
    return Array.from(this.backgroundShells.values()).map(shell => ({
      ...shell,
      process: undefined as any, // Don't expose the process object
    }));
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
