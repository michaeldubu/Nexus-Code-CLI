/**
 * Nexus Code - Base Agent Framework
 * Production-ready agent system with lifecycle management
 */
import { EventEmitter } from 'events';
import { AgentRole, AgentStatus, AgentMetadata, AgentContext, AgentCapability, Task, MemoryFragment, Result } from '../types/index.js';
import { MCPClient, MCPTool } from '../mcp/client.js';
export interface AgentConfig {
    role: AgentRole;
    name: string;
    version: string;
    capabilities: AgentCapability[];
    mcpConfig: {
        anthropicApiKey: string;
        model: string;
        maxTokens: number;
        temperature: number;
    };
}
export interface AgentMessage {
    id: string;
    from: string;
    to: string;
    content: any;
    timestamp: Date;
}
/**
 * Base Agent class - All agents extend this
 */
export declare abstract class BaseAgent extends EventEmitter {
    protected metadata: AgentMetadata;
    protected context: AgentContext;
    protected mcpClient: MCPClient;
    protected sessionId?: string;
    protected memory: MemoryFragment[];
    protected tools: MCPTool[];
    protected isRunning: boolean;
    constructor(config: AgentConfig);
    /**
     * Initialize agent-specific tools
     * Must be implemented by subclasses
     */
    protected abstract initializeTools(): void;
    /**
     * Process a task - core agent logic
     * Must be implemented by subclasses
     */
    protected abstract processTask(task: Task): Promise<Result<any>>;
    /**
     * Get the agent's system prompt
     * Must be implemented by subclasses
     */
    protected abstract getSystemPrompt(): string;
    /**
     * Setup event handlers
     */
    private setupEventHandlers;
    /**
     * Start the agent
     */
    start(): Promise<Result<void>>;
    /**
     * Stop the agent
     */
    stop(): Promise<Result<void>>;
    /**
     * Execute a task
     */
    execute(task: Task): Promise<Result<any>>;
    /**
     * Send a message through MCP
     */
    protected sendMessage(message: string): Promise<Result<string>>;
    /**
     * Handle tool calls from Claude
     */
    private handleToolCalls;
    /**
     * Execute a tool - implemented by subclasses
     */
    protected abstract executeTool(name: string, input: any): Promise<Result<any>>;
    /**
     * Register a tool
     */
    protected registerTool(tool: MCPTool): void;
    /**
     * Add a memory fragment
     */
    protected addMemory(fragment: Omit<MemoryFragment, 'id' | 'timestamp'>): void;
    /**
     * Get recent memory
     */
    protected getRecentMemory(count?: number): MemoryFragment[];
    /**
     * Search memory by type
     */
    protected searchMemory(type: MemoryFragment['type']): MemoryFragment[];
    /**
     * Clear memory
     */
    protected clearMemory(): void;
    /**
     * Get agent metadata
     */
    getMetadata(): AgentMetadata;
    /**
     * Get agent context
     */
    getContext(): AgentContext;
    /**
     * Get agent status
     */
    getStatus(): AgentStatus;
    /**
     * Check if agent is busy
     */
    isBusy(): boolean;
    /**
     * Get agent capabilities
     */
    getCapabilities(): AgentCapability[];
    /**
     * Send a message to another agent
     */
    sendToAgent(targetAgentId: string, content: any): Promise<void>;
    /**
     * Receive a message from another agent
     */
    receiveFromAgent(message: AgentMessage): Promise<void>;
}
/**
 * Agent Factory - Creates agents based on role
 */
export declare class AgentFactory {
    private static agentClasses;
    /**
     * Register an agent class for a role
     */
    static register(role: AgentRole, agentClass: new (config: AgentConfig) => BaseAgent): void;
    /**
     * Create an agent instance
     */
    static create(role: AgentRole, config: Omit<AgentConfig, 'role'>): BaseAgent;
    /**
     * Get all registered roles
     */
    static getRegisteredRoles(): AgentRole[];
}
//# sourceMappingURL=base.d.ts.map