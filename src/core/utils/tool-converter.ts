/**
 * Tool Format Converter
 * Converts MCP tool definitions to Anthropic API format
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

/**
 * Convert MCP tool format to Anthropic API format
 * MCP uses `inputSchema`, Anthropic uses `input_schema`
 */
export function mcpToAnthropicTools(mcpTools: any[]): AnthropicTool[] {
  if (!mcpTools || mcpTools.length === 0) {
    return [];
  }

  return mcpTools.map((tool) => {
    // If it's already in Anthropic format, return as-is
    if (tool.input_schema) {
      return tool as AnthropicTool;
    }

    // Convert from MCP format
    if (tool.inputSchema) {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      };
    }

    // Fallback - assume it's in some other format
    console.warn(`Unknown tool format for: ${tool.name}, attempting to use as-is`);
    return tool;
  });
}
