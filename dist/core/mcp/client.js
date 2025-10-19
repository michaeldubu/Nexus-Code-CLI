/**
 * Nexus Code - Model Context Protocol (MCP)
 * Production-ready MCP implementation for Claude integration
 */
import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { success, failure, } from '../types/index.js';
/**
 * MCP Server - Manages tools, resources, and prompts
 */
export class MCPServer extends EventEmitter {
    tools = new Map();
    toolHandlers = new Map();
    resources = new Map();
    resourceHandlers = new Map();
    prompts = new Map();
    promptHandlers = new Map();
    constructor() {
        super();
    }
    /**
     * Register a tool with its handler
     */
    registerTool(tool, handler) {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool '${tool.name}' is already registered`);
        }
        this.tools.set(tool.name, tool);
        this.toolHandlers.set(tool.name, handler);
        this.emit('tool:registered', { tool: tool.name });
    }
    /**
     * Register a resource with its handler
     */
    registerResource(resource, handler) {
        if (this.resources.has(resource.uri)) {
            throw new Error(`Resource '${resource.uri}' is already registered`);
        }
        this.resources.set(resource.uri, resource);
        this.resourceHandlers.set(resource.uri, handler);
        this.emit('resource:registered', { uri: resource.uri });
    }
    /**
     * Register a prompt with its handler
     */
    registerPrompt(prompt, handler) {
        if (this.prompts.has(prompt.name)) {
            throw new Error(`Prompt '${prompt.name}' is already registered`);
        }
        this.prompts.set(prompt.name, prompt);
        this.promptHandlers.set(prompt.name, handler);
        this.emit('prompt:registered', { prompt: prompt.name });
    }
    /**
     * Execute a tool
     */
    async executeTool(name, input) {
        const handler = this.toolHandlers.get(name);
        if (!handler) {
            return failure(new Error(`Tool '${name}' not found`));
        }
        try {
            const result = await handler(input);
            this.emit('tool:executed', { tool: name, input, result });
            return success(result);
        }
        catch (error) {
            this.emit('tool:error', { tool: name, input, error });
            return failure(error);
        }
    }
    /**
     * Get a resource
     */
    async getResource(uri) {
        const handler = this.resourceHandlers.get(uri);
        if (!handler) {
            return failure(new Error(`Resource '${uri}' not found`));
        }
        try {
            const result = await handler();
            this.emit('resource:fetched', { uri, result });
            return success(result);
        }
        catch (error) {
            this.emit('resource:error', { uri, error });
            return failure(error);
        }
    }
    /**
     * Get a prompt
     */
    async getPrompt(name, args) {
        const handler = this.promptHandlers.get(name);
        if (!handler) {
            return failure(new Error(`Prompt '${name}' not found`));
        }
        try {
            const result = await handler(args);
            this.emit('prompt:generated', { prompt: name, args, result });
            return success(result);
        }
        catch (error) {
            this.emit('prompt:error', { prompt: name, args, error });
            return failure(error);
        }
    }
    /**
     * Get all registered tools
     */
    getTools() {
        return Array.from(this.tools.values());
    }
    /**
     * Get all registered resources
     */
    getResources() {
        return Array.from(this.resources.values());
    }
    /**
     * Get all registered prompts
     */
    getPrompts() {
        return Array.from(this.prompts.values());
    }
}
/**
 * MCP Client - Communicates with Claude using MCP
 */
export class MCPClient extends EventEmitter {
    anthropic;
    config;
    sessions = new Map();
    constructor(config) {
        super();
        this.config = config;
        this.anthropic = new Anthropic({
            apiKey: config.anthropicApiKey,
        });
    }
    /**
     * Create a new MCP session
     */
    createSession(tools, resources) {
        const session = {
            id: uuidv4(),
            messages: [],
            tools,
            resources,
            prompts: [],
            metadata: {},
        };
        this.sessions.set(session.id, session);
        this.emit('session:created', { sessionId: session.id });
        return session;
    }
    /**
     * Send a message and get a response from Claude
     */
    async sendMessage(sessionId, message, context) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return failure(new Error(`Session '${sessionId}' not found`));
        }
        try {
            // Add user message to history
            session.messages.push({
                role: 'user',
                content: message,
            });
            // Prepare tools for Claude
            const tools = session.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
            }));
            // Make API call to Claude
            const response = await this.anthropic.messages.create({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
                messages: session.messages,
                tools: tools.length > 0 ? tools : undefined,
            });
            // Handle tool use
            if (response.stop_reason === 'tool_use') {
                const toolCalls = [];
                for (const block of response.content) {
                    if (block.type === 'tool_use') {
                        toolCalls.push({
                            id: block.id,
                            name: block.name,
                            input: block.input,
                        });
                    }
                }
                this.emit('tool:calls', { sessionId, toolCalls });
                // Store assistant message
                session.messages.push({
                    role: 'assistant',
                    content: response.content,
                });
                return success(JSON.stringify({
                    type: 'tool_use',
                    toolCalls,
                }));
            }
            // Extract text response
            let responseText = '';
            for (const block of response.content) {
                if (block.type === 'text') {
                    responseText += block.text;
                }
            }
            // Store assistant message
            session.messages.push({
                role: 'assistant',
                content: responseText,
            });
            this.emit('message:received', { sessionId, response: responseText });
            return success(responseText);
        }
        catch (error) {
            this.emit('error', { sessionId, error });
            return failure(error);
        }
    }
    /**
     * Continue conversation after tool execution
     */
    async continueWithToolResults(sessionId, toolResults) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return failure(new Error(`Session '${sessionId}' not found`));
        }
        try {
            // Add tool results to messages
            const toolResultContent = toolResults.map(result => ({
                type: 'tool_result',
                tool_use_id: result.toolCallId,
                content: result.error || JSON.stringify(result.output),
                is_error: !!result.error,
            }));
            session.messages.push({
                role: 'user',
                content: toolResultContent,
            });
            // Continue conversation
            const tools = session.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
            }));
            const response = await this.anthropic.messages.create({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
                messages: session.messages,
                tools: tools.length > 0 ? tools : undefined,
            });
            // Handle response
            if (response.stop_reason === 'tool_use') {
                const toolCalls = [];
                for (const block of response.content) {
                    if (block.type === 'tool_use') {
                        toolCalls.push({
                            id: block.id,
                            name: block.name,
                            input: block.input,
                        });
                    }
                }
                session.messages.push({
                    role: 'assistant',
                    content: response.content,
                });
                return success(JSON.stringify({
                    type: 'tool_use',
                    toolCalls,
                }));
            }
            // Extract text response
            let responseText = '';
            for (const block of response.content) {
                if (block.type === 'text') {
                    responseText += block.text;
                }
            }
            session.messages.push({
                role: 'assistant',
                content: responseText,
            });
            return success(responseText);
        }
        catch (error) {
            return failure(error);
        }
    }
    /**
     * Get session
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * Delete session
     */
    deleteSession(sessionId) {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            this.emit('session:deleted', { sessionId });
        }
        return deleted;
    }
    /**
     * Clear all messages in a session
     */
    clearSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messages = [];
            this.emit('session:cleared', { sessionId });
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=client.js.map