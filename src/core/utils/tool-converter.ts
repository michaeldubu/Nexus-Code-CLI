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

export interface OpenAITool {
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
 * Convert any tool format to OpenAI format 🚀
 */
export function mcpToOpenAITools(mcpTools: any[]): OpenAITool[] {
  if (!mcpTools || mcpTools.length === 0) {
    return [];
  }

  return mcpTools.map((tool) => {
    let inputSchema = tool.input_schema || tool.inputSchema || tool.parameters || {};

    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: inputSchema,
      },
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
