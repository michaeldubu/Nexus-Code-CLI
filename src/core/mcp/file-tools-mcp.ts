/**
 * MCP FileTools Integration
 * Registers all FileTools with MCP Server for Claude/GPT to use
 */

import { MCPServer } from './client.js';
import { FileTools } from '../tools/file-tools.js';
import { MemoryTool } from '../tools/memory-tool.js';
import { MCPTool } from '../types/index.js';

/**
 * Register all FileTools with MCP Server
 */
export function registerFileTools(mcpServer: MCPServer, fileTools: FileTools): void {
  // Read File Tool
  const readFileTool: MCPTool = {
    name: 'read_file',
    description: 'Read contents of a file with optional line offset and limit. Returns file content with line numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to read (relative to working directory)'
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (1-indexed, optional)'
        },
        limit: {
          type: 'number',
          description: 'Number of lines to read (optional)'
        },
      },
      required: ['file_path'],
    },
  };

  mcpServer.registerTool(readFileTool, async (input) => {
    const result = await fileTools.read(input.file_path, input.offset, input.limit);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output;
  });

  // Write File Tool
  const writeFileTool: MCPTool = {
    name: 'write_file',
    description: 'Write content to a file (creates or overwrites). Use this to create new files or completely replace existing ones.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to write'
        },
        content: {
          type: 'string',
          description: 'Content to write to the file'
        },
      },
      required: ['file_path', 'content'],
    },
  };

  mcpServer.registerTool(writeFileTool, async (input) => {
    const result = await fileTools.write(input.file_path, input.content);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output;
  });

  // Edit File Tool
  const editFileTool: MCPTool = {
    name: 'edit_file',
    description: 'Edit a file by finding and replacing text. Safer than write_file for making targeted changes.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to edit'
        },
        old_string: {
          type: 'string',
          description: 'Exact text to find in the file (must match exactly including whitespace)'
        },
        new_string: {
          type: 'string',
          description: 'Text to replace it with'
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences (default: false, replaces only first match)'
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  };

  mcpServer.registerTool(editFileTool, async (input) => {
    const result = await fileTools.edit(
      input.file_path,
      input.old_string,
      input.new_string,
      input.replace_all || false
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output;
  });

  // Glob Search Tool
  const globTool: MCPTool = {
    name: 'glob_search',
    description: 'Find files matching a glob pattern. Returns list of file paths sorted by modification time.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.js", "*.json")'
        },
        path: {
          type: 'string',
          description: 'Directory to search in (optional, defaults to working directory)'
        },
      },
      required: ['pattern'],
    },
  };

  mcpServer.registerTool(globTool, async (input) => {
    const result = await fileTools.globFiles(input.pattern, input.path);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output;
  });

  // Grep Search Tool
  const grepTool: MCPTool = {
    name: 'grep_search',
    description: 'Search file contents using regex pattern (powered by ripgrep). Returns matching lines with context.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern to search for'
        },
        path: {
          type: 'string',
          description: 'Directory or file to search in (optional)'
        },
        glob: {
          type: 'string',
          description: 'File pattern to filter (e.g., "*.ts", "*.{js,jsx}")'
        },
        case_insensitive: {
          type: 'boolean',
          description: 'Case insensitive search (default: false)'
        },
        show_line_numbers: {
          type: 'boolean',
          description: 'Show line numbers in output (default: false)'
        },
        context_before: {
          type: 'number',
          description: 'Number of lines to show before each match'
        },
        context_after: {
          type: 'number',
          description: 'Number of lines to show after each match'
        },
        files_only: {
          type: 'boolean',
          description: 'Only show file names, not matches (default: false)'
        },
      },
      required: ['pattern'],
    },
  };

  mcpServer.registerTool(grepTool, async (input) => {
    const result = await fileTools.grep(input.pattern, {
      path: input.path,
      glob: input.glob,
      caseInsensitive: input.case_insensitive,
      showLineNumbers: input.show_line_numbers,
      contextBefore: input.context_before,
      contextAfter: input.context_after,
      filesOnly: input.files_only,
    });
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output;
  });

  // Bash Command Tool
  const bashTool: MCPTool = {
    name: 'bash_command',
    description: 'Execute a bash command. IMPORTANT: Requires user approval unless pre-approved. Use carefully.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 120000 = 2 minutes)'
        },
        background: {
          type: 'boolean',
          description: 'Run in background (default: false)'
        },
      },
      required: ['command'],
    },
  };

  mcpServer.registerTool(bashTool, async (input) => {
    const result = await fileTools.bash(input.command, {
      timeout: input.timeout,
      background: input.background,
    });
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output;
  });

  // BashOutput Tool
  const bashOutputTool: MCPTool = {
    name: 'bash_output',
    description: 'Read output from a background bash shell. Output is cleared after reading.',
    inputSchema: {
      type: 'object',
      properties: {
        shell_id: {
          type: 'string',
          description: 'The ID of the background shell (returned from bash_command with background: true)'
        },
        filter: {
          type: 'string',
          description: 'Optional regex pattern to filter output lines'
        },
      },
      required: ['shell_id'],
    },
  };

  mcpServer.registerTool(bashOutputTool, async (input) => {
    const result = await fileTools.bashOutput(input.shell_id, input.filter);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output;
  });

  // KillShell Tool
  const killShellTool: MCPTool = {
    name: 'kill_shell',
    description: 'Terminate a background bash shell',
    inputSchema: {
      type: 'object',
      properties: {
        shell_id: {
          type: 'string',
          description: 'The ID of the background shell to terminate'
        },
      },
      required: ['shell_id'],
    },
  };

  mcpServer.registerTool(killShellTool, async (input) => {
    const result = await fileTools.killShell(input.shell_id);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output;
  });
}

/**
 * Get all FileTools as MCP tools (for passing to Anthropic/OpenAI APIs)
 */
export function getFileToolsDefinitions(): MCPTool[] {
  return [
    {
      name: 'read_file',
      description: 'Read contents of a file with optional line offset and limit',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          offset: { type: 'number' },
          limit: { type: 'number' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file (creates or overwrites)',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['file_path', 'content'],
      },
    },
    {
      name: 'edit_file',
      description: 'Edit a file by finding and replacing text',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          old_string: { type: 'string' },
          new_string: { type: 'string' },
          replace_all: { type: 'boolean' },
        },
        required: ['file_path', 'old_string', 'new_string'],
      },
    },
    {
      name: 'glob_search',
      description: 'Find files matching a glob pattern',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'grep_search',
      description: 'Search file contents using regex pattern',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string' },
          glob: { type: 'string' },
          case_insensitive: { type: 'boolean' },
          show_line_numbers: { type: 'boolean' },
          context_before: { type: 'number' },
          context_after: { type: 'number' },
          files_only: { type: 'boolean' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'bash_command',
      description: 'Execute a bash command (requires approval)',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          timeout: { type: 'number' },
          background: { type: 'boolean' },
        },
        required: ['command'],
      },
    },
    {
      name: 'bash_output',
      description: 'Read output from a background bash shell',
      inputSchema: {
        type: 'object',
        properties: {
          shell_id: { type: 'string' },
          filter: { type: 'string' },
        },
        required: ['shell_id'],
      },
    },
    {
      name: 'kill_shell',
      description: 'Terminate a background bash shell',
      inputSchema: {
        type: 'object',
        properties: {
          shell_id: { type: 'string' },
        },
        required: ['shell_id'],
      },
    },
  ];
}
