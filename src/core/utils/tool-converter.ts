/**
 * Tool Format Converter 🔥
 * Converts between MCP, Anthropic, OpenAI, and Google tool formats
 * Multi-provider support FTW!
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// OpenAI Chat Completions format (legacy)
export interface OpenAIChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// OpenAI Responses API format (new) - supports ALL tool types
export interface OpenAITool {
  type: 'function' | 'custom' | 'web_search_preview' | 'file_search' |
        'code_interpreter' | 'image_generation' | 'mcp' | 'computer_use_preview';

  // Function/Custom specific
  name?: string;
  description?: string;
  parameters?: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  strict?: boolean;
  grammar?: string; // For custom tools with Context-Free Grammar

  // Web search specific
  search_context_size?: 'low' | 'medium' | 'high';
  user_location?: {
    type: 'approximate';
    country?: string;
    city?: string;
    region?: string;
    timezone?: string;
  };

  // File search specific
  vector_store_ids?: string[];
  max_num_results?: number;
  filters?: any;

  // Code interpreter specific
  container?: { type: 'auto'; files?: string[] } | string;

  // Image generation specific
  size?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  format?: 'png' | 'jpeg' | 'webp';
  compression?: number;
  background?: 'transparent' | 'opaque' | 'auto';

  // MCP specific
  server_label?: string;
  server_url?: string;
  headers?: Record<string, string>;
  require_approval?: 'always' | 'never' | { never: { tool_names: string[] } };
  allowed_tools?: string[];

  // Computer use specific
  display_width?: number;
  display_height?: number;
  environment?: 'browser' | 'mac' | 'windows' | 'ubuntu';
}

export interface GoogleTool {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  }>;
}

/**
 * Convert any tool format to Anthropic API format
 * MCP uses `inputSchema`, Anthropic uses `input_schema`
 */
export function mcpToAnthropicTools(mcpTools: any[]): AnthropicTool[] {
  if (!mcpTools || mcpTools.length === 0) {
    return [];
  }

  return mcpTools.map((tool) => {
    // Already in Anthropic format
    if (tool.input_schema && !tool.inputSchema && !tool.function) {
      return tool as AnthropicTool;
    }

    // MCP format
    if (tool.inputSchema) {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      };
    }

    // OpenAI format (nested in function)
    if (tool.function) {
      return {
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      };
    }

    // Fallback
    console.warn(`🤔 Unknown tool format for: ${tool.name}, attempting conversion`);
    return {
      name: tool.name || '',
      description: tool.description || '',
      input_schema: tool.parameters || tool.inputSchema || { type: 'object', properties: {} },
    };
  });
}

/**
 * Convert any tool format to OpenAI Responses API format 🚀
 * NOTE: Responses API supports multiple tool types, not just functions
 */
export function mcpToOpenAITools(mcpTools: any[]): OpenAITool[] {
  if (!mcpTools || mcpTools.length === 0) {
    return [];
  }

  return mcpTools.map((tool) => {
    // Handle different tool types based on tool.type
    if (tool.type === 'web_search' || tool.type === 'web_search_preview') {
      return {
        type: 'web_search_preview',
        search_context_size: tool.search_context_size || 'medium',
        user_location: tool.user_location,
      };
    }

    if (tool.type === 'file_search') {
      return {
        type: 'file_search',
        vector_store_ids: tool.vector_store_ids || [],
        max_num_results: tool.max_num_results,
        filters: tool.filters,
      };
    }

    if (tool.type === 'code_interpreter') {
      return {
        type: 'code_interpreter',
        container: tool.container || { type: 'auto' },
      };
    }

    if (tool.type === 'image_generation') {
      return {
        type: 'image_generation',
        size: tool.size || 'auto',
        quality: tool.quality || 'auto',
        format: tool.format,
        compression: tool.compression,
        background: tool.background || 'auto',
      };
    }

    if (tool.type === 'mcp') {
      return {
        type: 'mcp',
        server_label: tool.server_label,
        server_url: tool.server_url,
        headers: tool.headers,
        require_approval: tool.require_approval || 'always',
        allowed_tools: tool.allowed_tools,
      };
    }

    if (tool.type === 'computer_use_preview' || tool.type === 'computer_use') {
      return {
        type: 'computer_use_preview',
        display_width: tool.display_width || 1024,
        display_height: tool.display_height || 768,
        environment: tool.environment || 'browser',
      };
    }

    // Check if it's a custom tool (freeform text)
    if (tool.type === 'custom' || tool.freeform) {
      return {
        type: 'custom',
        name: tool.name,
        description: tool.description || '',
        grammar: tool.grammar, // Optional Context-Free Grammar
      };
    }

    // Default to function type (standard tool calling)
    const inputSchema = tool.input_schema || tool.inputSchema || tool.parameters || {};

    return {
      type: 'function' as const,
      name: tool.name,
      description: tool.description || '',
      parameters: inputSchema,
      strict: tool.strict !== undefined ? tool.strict : false,
    };
  });
}

/**
 * Convert any tool format to Google Generative AI format 🔥
 */
export function mcpToGoogleTools(mcpTools: any[]): GoogleTool {
  if (!mcpTools || mcpTools.length === 0) {
    return { functionDeclarations: [] };
  }

  return {
    functionDeclarations: mcpTools.map((tool) => {
      const inputSchema = tool.input_schema || tool.inputSchema || tool.parameters || {};

      return {
        name: tool.name,
        description: tool.description || '',
        parameters: inputSchema,
      };
    }),
  };
}
