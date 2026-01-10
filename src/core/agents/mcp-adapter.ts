/**
 * MCP Adapter for Agent SDK
 *
 * Bridges existing Nexus MCP tools with the Claude Agent SDK,
 * allowing agents to use FileTools, WebTools, and MemoryTool.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { FileTools } from '../tools/file-tools.js';
import type { WebTools } from '../tools/web-tools.js';
import type { MemoryTool } from '../tools/memory-tool.js';

/**
 * Create an MCP server for the Agent SDK that wraps Nexus FileTools
 */
export function createFileToolsServer(fileTools: FileTools) {
  return createSdkMcpServer({
    name: 'nexus-file-tools',
    version: '1.0.0',
    tools: [
      tool(
        'nexus_read_file',
        'Read contents of a file with optional line offset and limit',
        {
          file_path: z.string().describe('Path to the file to read'),
          offset: z.number().optional().describe('Line number to start reading from (1-indexed)'),
          limit: z.number().optional().describe('Number of lines to read'),
        },
        async (args) => {
          try {
            const result = await fileTools.read(args.file_path, args.offset, args.limit);

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || '',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
      tool(
        'nexus_write_file',
        'Write content to a file (creates or overwrites)',
        {
          file_path: z.string().describe('Path to the file to write'),
          content: z.string().describe('Content to write to the file'),
        },
        async (args) => {
          try {
            const result = await fileTools.write(args.file_path, args.content);

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || 'File written successfully',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
      tool(
        'nexus_edit_file',
        'Edit a file by finding and replacing text',
        {
          file_path: z.string().describe('Path to the file to edit'),
          old_string: z.string().describe('Exact text to find in the file'),
          new_string: z.string().describe('Text to replace it with'),
          replace_all: z.boolean().default(false).describe('Replace all occurrences'),
        },
        async (args) => {
          try {
            const result = await fileTools.edit(
              args.file_path,
              args.old_string,
              args.new_string,
              args.replace_all
            );

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || 'File edited successfully',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error editing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
      tool(
        'nexus_list_directory',
        'List contents of a directory',
        {
          directory_path: z.string().describe('Path to the directory'),
          recursive: z.boolean().default(false).describe('List recursively'),
        },
        async (args) => {
          try {
            const result = await fileTools.list(args.directory_path, args.recursive);

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || '',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error listing directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
      tool(
        'nexus_search_files',
        'Search for files matching a pattern',
        {
          pattern: z.string().describe('Glob pattern to search for'),
          directory: z.string().optional().describe('Directory to search in (default: cwd)'),
        },
        async (args) => {
          try {
            const result = await fileTools.search(args.pattern, args.directory);

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || 'No files found',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error searching files: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
    ],
  });
}

/**
 * Create an MCP server for the Agent SDK that wraps Nexus WebTools
 */
export function createWebToolsServer(webTools: WebTools) {
  return createSdkMcpServer({
    name: 'nexus-web-tools',
    version: '1.0.0',
    tools: [
      tool(
        'nexus_web_fetch',
        'Fetch content from a URL and process it with AI',
        {
          url: z.string().url().describe('The URL to fetch content from'),
          prompt: z.string().describe('The prompt/question to ask about the content'),
        },
        async (args) => {
          try {
            const result = await webTools.webFetch(args.url, args.prompt);

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || '',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error fetching URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
      tool(
        'nexus_web_search',
        'Search the web for information',
        {
          query: z.string().describe('The search query'),
          allowed_domains: z.array(z.string()).optional().describe('Only include results from these domains'),
          blocked_domains: z.array(z.string()).optional().describe('Never include results from these domains'),
        },
        async (args) => {
          try {
            const result = await webTools.webSearch(args.query, {
              allowedDomains: args.allowed_domains,
              blockedDomains: args.blocked_domains,
            });

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || '',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error searching web: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
    ],
  });
}

/**
 * Create an MCP server for the Agent SDK that wraps Nexus MemoryTool
 */
export function createMemoryToolServer(memoryTool: MemoryTool) {
  return createSdkMcpServer({
    name: 'nexus-memory-tool',
    version: '1.0.0',
    tools: [
      tool(
        'nexus_store_memory',
        'Store information in long-term memory',
        {
          key: z.string().describe('Key to store the memory under'),
          value: z.string().describe('Value to store'),
          category: z.string().optional().describe('Category for organizing memories'),
        },
        async (args) => {
          try {
            const result = await memoryTool.store(args.key, args.value, args.category);

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || 'Memory stored successfully',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error storing memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
      tool(
        'nexus_recall_memory',
        'Recall information from long-term memory',
        {
          key: z.string().describe('Key to recall'),
        },
        async (args) => {
          try {
            const result = await memoryTool.recall(args.key);

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || 'No memory found',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error recalling memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
      tool(
        'nexus_search_memories',
        'Search through stored memories',
        {
          query: z.string().describe('Search query'),
          category: z.string().optional().describe('Filter by category'),
        },
        async (args) => {
          try {
            const result = await memoryTool.search(args.query, args.category);

            if (!result.success) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${result.error}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text' as const,
                  text: result.output || 'No memories found',
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error searching memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      ),
    ],
  });
}

/**
 * Get all Nexus tool names for allowedTools configuration
 */
export function getAllNexusToolNames(): string[] {
  return [
    // File tools
    'mcp__nexus-file-tools__nexus_read_file',
    'mcp__nexus-file-tools__nexus_write_file',
    'mcp__nexus-file-tools__nexus_edit_file',
    'mcp__nexus-file-tools__nexus_list_directory',
    'mcp__nexus-file-tools__nexus_search_files',
    // Web tools
    'mcp__nexus-web-tools__nexus_web_fetch',
    'mcp__nexus-web-tools__nexus_web_search',
    // Memory tools
    'mcp__nexus-memory-tool__nexus_store_memory',
    'mcp__nexus-memory-tool__nexus_recall_memory',
    'mcp__nexus-memory-tool__nexus_search_memories',
  ];
}

export default {
  createFileToolsServer,
  createWebToolsServer,
  createMemoryToolServer,
  getAllNexusToolNames,
};
