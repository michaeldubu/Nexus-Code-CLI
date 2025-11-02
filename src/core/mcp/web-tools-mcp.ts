/**
 * MCP Tool Definitions for Web Tools
 */

import { WebTools } from '../tools/web-tools.js';
import { MCPServer } from './client.js';

export function registerWebTools(server: MCPServer, webTools: WebTools) {
  // WebFetch tool
  server.registerTool({
    name: 'web_fetch',
    description: 'Fetch content from a specified URL and process it using an AI model. Automatically upgrades HTTP to HTTPS and handles redirects.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch content from (must be a valid HTTP/HTTPS URL)',
        },
        prompt: {
          type: 'string',
          description: 'The prompt/question to ask about the fetched content',
        },
      },
      required: ['url', 'prompt'],
    },
  }, async (input) => {
    const result = await webTools.webFetch(input.url as string, input.prompt as string);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output || 'Success';
  });

  // WebSearch tool
  server.registerTool({
    name: 'web_search',
    description: 'Search the web for information. Returns search results that can be used to answer questions or gather up-to-date information.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        allowed_domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Only include results from these domains',
        },
        blocked_domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Never include results from these domains',
        },
      },
      required: ['query'],
    },
  }, async (input) => {
    const result = await webTools.webSearch(
      input.query as string,
      {
        allowedDomains: input.allowed_domains as string[] | undefined,
        blockedDomains: input.blocked_domains as string[] | undefined,
      }
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output || 'Success';
  });
}

export function getWebToolsDefinitions() {
  return [
    {
      name: 'web_fetch',
      description: 'Fetch content from a specified URL and process it using an AI model',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' },
          prompt: { type: 'string', description: 'The prompt to process the content with' },
        },
        required: ['url', 'prompt'],
      },
    },
    {
      name: 'web_search',
      description: 'Search the web for information',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          allowed_domains: { type: 'array', items: { type: 'string' } },
          blocked_domains: { type: 'array', items: { type: 'string' } },
        },
        required: ['query'],
      },
    },
  ];
}
