/**
 * Nexus Code - Model Context Protocol (MCP)
 * Production-ready MCP implementation for Claude integration
 */
import { EventEmitter } from 'events';
import { MCPTool, MCPResource, MCPPrompt, Result } from '../types/index.js';
export type { MCPTool };
export interface MCPConfig {
    anthropicApiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
}
export interface MCPToolCall {
    id: string;
    name: string;
    input: any;
}
export interface MCPToolResult {
    toolCallId: string;
    output: any;
    error?: string;
}
export interface MCPMessage {
    role: 'user' | 'assistant';
    content: string | Array<{
        type: string;
        [key: string]: any;
    }>;
}
export interface MCPSession {
    id: string;
    messages: MCPMessage[];
    tools: MCPTool[];
    resources: MCPResource[];
    prompts: MCPPrompt[];
    metadata: Record<string, any>;
}
/**
 * MCP Server - Manages tools, resources, and prompts
 */
export declare class MCPServer extends EventEmitter {
    private tools;
    private toolHandlers;
    private resources;
    private resourceHandlers;
    private prompts;
    private promptHandlers;
    constructor();
    /**
     * Register a tool with its handler
     */
    registerTool(tool: MCPTool, handler: (input: any) => Promise<any>): void;
    /**
     * Register a resource with its handler
     */
    registerResource(resource: MCPResource, handler: () => Promise<any>): void;
    /**
     * Register a prompt with its handler
     */
    registerPrompt(prompt: MCPPrompt, handler: (args: Record<string, any>) => Promise<string>): void;
    /**
     * Execute a tool
     */
    executeTool(name: string, input: any): Promise<Result<any>>;
    /**
     * Get a resource
     */
    getResource(uri: string): Promise<Result<any>>;
    /**
     * Get a prompt
     */
    getPrompt(name: string, args: Record<string, any>): Promise<Result<string>>;
    /**
     * Get all registered tools
     */
    getTools(): MCPTool[];
    /**
     * Get all registered resources
     */
    getResources(): MCPResource[];
    /**
     * Get all registered prompts
     */
    getPrompts(): MCPPrompt[];
}
/**
 * MCP Client - Communicates with Claude using MCP
 */
export declare class MCPClient extends EventEmitter {
    private anthropic;
    private config;
    private sessions;
    constructor(config: MCPConfig);
    /**
     * Create a new MCP session
     */
    createSession(tools: MCPTool[], resources: MCPResource[]): MCPSession;
    /**
     * Send a message and get a response from Claude
     */
    sendMessage(sessionId: string, message: string, context?: Record<string, any>): Promise<Result<string>>;
    /**
     * Continue conversation after tool execution
     */
    continueWithToolResults(sessionId: string, toolResults: MCPToolResult[]): Promise<Result<string>>;
    /**
     * Get session
     */
    getSession(sessionId: string): MCPSession | undefined;
    /**
     * Delete session
     */
    deleteSession(sessionId: string): boolean;
    /**
     * Clear all messages in a session
     */
    clearSession(sessionId: string): boolean;
}
//# sourceMappingURL=client.d.ts.map