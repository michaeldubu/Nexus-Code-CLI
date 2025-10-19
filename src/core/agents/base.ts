/**
 * Nexus Code - Base Agent Framework
 * Production-ready agent system with lifecycle management
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentRole,
  AgentStatus,
  AgentMetadata,
  AgentContext,
  AgentCapability,
  Task,
  MemoryFragment,
  Result,
  success,
  failure,
} from '../types/index.js';
import { MCPClient, MCPTool, MCPToolCall, MCPToolResult } from '../mcp/client.js';

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
export abstract class BaseAgent extends EventEmitter {
  protected metadata: AgentMetadata;
  protected context: AgentContext;
  protected mcpClient: MCPClient;
  protected sessionId?: string;
  protected memory: MemoryFragment[] = [];
  protected tools: MCPTool[] = [];
  protected isRunning = false;

  constructor(config: AgentConfig) {
    super();

    this.metadata = {
      id: uuidv4(),
      role: config.role,
      name: config.name,
      version: config.version,
      capabilities: config.capabilities,
      status: AgentStatus.IDLE,
      created: new Date(),
      lastActive: new Date(),
    };

    // Initialize context
    this.context = {
      agentId: this.metadata.id,
      sessionId: uuidv4(),
      userId: 'system',
      permissions: [],
      environment: {},
      memory: [],
    };

    // Initialize MCP client
    this.mcpClient = new MCPClient(config.mcpConfig);

    // Register event handlers
    this.setupEventHandlers();

    // Initialize agent-specific tools
    this.initializeTools();
  }

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
  private setupEventHandlers(): void {
    this.mcpClient.on('tool:calls', async ({ sessionId, toolCalls }) => {
      if (sessionId === this.sessionId) {
        await this.handleToolCalls(toolCalls);
      }
    });

    this.mcpClient.on('error', ({ error }) => {
      this.emit('error', { agentId: this.metadata.id, error });
    });
  }

  /**
   * Start the agent
   */
  async start(): Promise<Result<void>> {
    if (this.isRunning) {
      return failure(new Error('Agent is already running'));
    }

    try {
      // Create MCP session
      this.sessionId = this.mcpClient.createSession(this.tools, []).id;

      // Update status
      this.metadata.status = AgentStatus.IDLE;
      this.metadata.lastActive = new Date();
      this.isRunning = true;

      this.emit('started', { agentId: this.metadata.id });
      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<Result<void>> {
    if (!this.isRunning) {
      return failure(new Error('Agent is not running'));
    }

    try {
      // Clean up MCP session
      if (this.sessionId) {
        this.mcpClient.deleteSession(this.sessionId);
      }

      // Update status
      this.metadata.status = AgentStatus.IDLE;
      this.metadata.lastActive = new Date();
      this.isRunning = false;

      this.emit('stopped', { agentId: this.metadata.id });
      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Execute a task
   */
  async execute(task: Task): Promise<Result<any>> {
    if (!this.isRunning) {
      return failure(new Error('Agent is not running'));
    }

    try {
      // Update status
      this.metadata.status = AgentStatus.THINKING;
      this.metadata.lastActive = new Date();
      task.status = 'in_progress';
      task.started = new Date();

      this.emit('task:started', { agentId: this.metadata.id, taskId: task.id });

      // Process the task
      const result = await this.processTask(task);

      if (result.success) {
        // Update task status
        task.status = 'completed';
        task.completed = new Date();
        task.output = result.data;

        // Store in memory
        this.addMemory({
          content: JSON.stringify({ task, result: result.data }),
          type: 'result',
          contributingAgents: [this.metadata.id],
          metadata: { taskId: task.id },
        });

        this.emit('task:completed', {
          agentId: this.metadata.id,
          taskId: task.id,
          result: result.data,
        });
      } else {
        // Update task status
        task.status = 'failed';
        task.completed = new Date();
        task.error = result.error as Error;

        this.emit('task:failed', {
          agentId: this.metadata.id,
          taskId: task.id,
          error: result.error,
        });
      }

      // Reset status
      this.metadata.status = AgentStatus.IDLE;
      this.metadata.lastActive = new Date();

      return result;
    } catch (error) {
      task.status = 'failed';
      task.completed = new Date();
      task.error = error as Error;

      this.metadata.status = AgentStatus.FAILED;
      this.emit('error', { agentId: this.metadata.id, error });

      return failure(error as Error);
    }
  }

  /**
   * Send a message through MCP
   */
  protected async sendMessage(message: string): Promise<Result<string>> {
    if (!this.sessionId) {
      return failure(new Error('No active session'));
    }

    this.metadata.status = AgentStatus.THINKING;
    const result = await this.mcpClient.sendMessage(this.sessionId, message);
    this.metadata.status = AgentStatus.IDLE;
    this.metadata.lastActive = new Date();

    return result;
  }

  /**
   * Handle tool calls from Claude
   */
  private async handleToolCalls(toolCalls: MCPToolCall[]): Promise<void> {
    this.metadata.status = AgentStatus.EXECUTING;
    const results: MCPToolResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        // Find tool handler
        const tool = this.tools.find(t => t.name === toolCall.name);
        if (!tool) {
          results.push({
            toolCallId: toolCall.id,
            output: null,
            error: `Tool '${toolCall.name}' not found`,
          });
          continue;
        }

        // Execute tool (implemented by subclass)
        const result = await this.executeTool(toolCall.name, toolCall.input);

        if (result.success) {
          results.push({
            toolCallId: toolCall.id,
            output: result.data,
          });
        } else {
          results.push({
            toolCallId: toolCall.id,
            output: null,
            error: result.error.message,
          });
        }
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          output: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Continue conversation with tool results
    if (this.sessionId) {
      await this.mcpClient.continueWithToolResults(this.sessionId, results);
    }

    this.metadata.status = AgentStatus.IDLE;
  }

  /**
   * Execute a tool - implemented by subclasses
   */
  protected abstract executeTool(name: string, input: any): Promise<Result<any>>;

  /**
   * Register a tool
   */
  protected registerTool(tool: MCPTool): void {
    this.tools.push(tool);
  }

  /**
   * Add a memory fragment
   */
  protected addMemory(fragment: Omit<MemoryFragment, 'id' | 'timestamp'>): void {
    const memory: MemoryFragment = {
      id: uuidv4(),
      timestamp: new Date(),
      ...fragment,
    };

    this.memory.push(memory);
    this.context.memory.push(memory);

    // Limit memory size (keep last 100 fragments)
    if (this.memory.length > 100) {
      this.memory.shift();
    }
    if (this.context.memory.length > 100) {
      this.context.memory.shift();
    }
  }

  /**
   * Get recent memory
   */
  protected getRecentMemory(count: number = 10): MemoryFragment[] {
    return this.memory.slice(-count);
  }

  /**
   * Search memory by type
   */
  protected searchMemory(type: MemoryFragment['type']): MemoryFragment[] {
    return this.memory.filter(m => m.type === type);
  }

  /**
   * Clear memory
   */
  protected clearMemory(): void {
    this.memory = [];
    this.context.memory = [];
  }

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return { ...this.metadata };
  }

  /**
   * Get agent context
   */
  getContext(): AgentContext {
    return { ...this.context };
  }

  /**
   * Get agent status
   */
  getStatus(): AgentStatus {
    return this.metadata.status;
  }

  /**
   * Check if agent is busy
   */
  isBusy(): boolean {
    return this.metadata.status === AgentStatus.THINKING ||
           this.metadata.status === AgentStatus.EXECUTING ||
           this.metadata.status === AgentStatus.WAITING;
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapability[] {
    return [...this.metadata.capabilities];
  }

  /**
   * Send a message to another agent
   */
  async sendToAgent(targetAgentId: string, content: any): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      from: this.metadata.id,
      to: targetAgentId,
      content,
      timestamp: new Date(),
    };

    this.emit('message:send', message);
  }

  /**
   * Receive a message from another agent
   */
  async receiveFromAgent(message: AgentMessage): Promise<void> {
    this.emit('message:receive', message);

    // Store in memory
    this.addMemory({
      content: JSON.stringify(message),
      type: 'context',
      contributingAgents: [message.from],
      metadata: { messageId: message.id },
    });
  }
}

/**
 * Agent Factory - Creates agents based on role
 */
export class AgentFactory {
  private static agentClasses = new Map<AgentRole, new (config: AgentConfig) => BaseAgent>();

  /**
   * Register an agent class for a role
   */
  static register(role: AgentRole, agentClass: new (config: AgentConfig) => BaseAgent): void {
    this.agentClasses.set(role, agentClass);
  }

  /**
   * Create an agent instance
   */
  static create(role: AgentRole, config: Omit<AgentConfig, 'role'>): BaseAgent {
    const AgentClass = this.agentClasses.get(role);
    if (!AgentClass) {
      throw new Error(`No agent class registered for role '${role}'`);
    }

    return new AgentClass({ role, ...config });
  }

  /**
   * Get all registered roles
   */
  static getRegisteredRoles(): AgentRole[] {
    return Array.from(this.agentClasses.keys());
  }
}
