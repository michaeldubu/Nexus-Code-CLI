/**
 * Nexus Code - Base Agent Framework
 * Production-ready agent system with lifecycle management
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentStatus, success, failure, } from '../types/index.js';
import { MCPClient } from '../mcp/client.js';
/**
 * Base Agent class - All agents extend this
 */
export class BaseAgent extends EventEmitter {
    metadata;
    context;
    mcpClient;
    sessionId;
    memory = [];
    tools = [];
    isRunning = false;
    constructor(config) {
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
     * Setup event handlers
     */
    setupEventHandlers() {
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
    async start() {
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
        }
        catch (error) {
            return failure(error);
        }
    }
    /**
     * Stop the agent
     */
    async stop() {
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
        }
        catch (error) {
            return failure(error);
        }
    }
    /**
     * Execute a task
     */
    async execute(task) {
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
            }
            else {
                // Update task status
                task.status = 'failed';
                task.completed = new Date();
                task.error = result.error;
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
        }
        catch (error) {
            task.status = 'failed';
            task.completed = new Date();
            task.error = error;
            this.metadata.status = AgentStatus.FAILED;
            this.emit('error', { agentId: this.metadata.id, error });
            return failure(error);
        }
    }
    /**
     * Send a message through MCP
     */
    async sendMessage(message) {
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
    async handleToolCalls(toolCalls) {
        this.metadata.status = AgentStatus.EXECUTING;
        const results = [];
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
                }
                else {
                    results.push({
                        toolCallId: toolCall.id,
                        output: null,
                        error: result.error.message,
                    });
                }
            }
            catch (error) {
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
     * Register a tool
     */
    registerTool(tool) {
        this.tools.push(tool);
    }
    /**
     * Add a memory fragment
     */
    addMemory(fragment) {
        const memory = {
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
    getRecentMemory(count = 10) {
        return this.memory.slice(-count);
    }
    /**
     * Search memory by type
     */
    searchMemory(type) {
        return this.memory.filter(m => m.type === type);
    }
    /**
     * Clear memory
     */
    clearMemory() {
        this.memory = [];
        this.context.memory = [];
    }
    /**
     * Get agent metadata
     */
    getMetadata() {
        return { ...this.metadata };
    }
    /**
     * Get agent context
     */
    getContext() {
        return { ...this.context };
    }
    /**
     * Get agent status
     */
    getStatus() {
        return this.metadata.status;
    }
    /**
     * Check if agent is busy
     */
    isBusy() {
        return this.metadata.status === AgentStatus.THINKING ||
            this.metadata.status === AgentStatus.EXECUTING ||
            this.metadata.status === AgentStatus.WAITING;
    }
    /**
     * Get agent capabilities
     */
    getCapabilities() {
        return [...this.metadata.capabilities];
    }
    /**
     * Send a message to another agent
     */
    async sendToAgent(targetAgentId, content) {
        const message = {
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
    async receiveFromAgent(message) {
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
    static agentClasses = new Map();
    /**
     * Register an agent class for a role
     */
    static register(role, agentClass) {
        this.agentClasses.set(role, agentClass);
    }
    /**
     * Create an agent instance
     */
    static create(role, config) {
        const AgentClass = this.agentClasses.get(role);
        if (!AgentClass) {
            throw new Error(`No agent class registered for role '${role}'`);
        }
        return new AgentClass({ role, ...config });
    }
    /**
     * Get all registered roles
     */
    static getRegisteredRoles() {
        return Array.from(this.agentClasses.keys());
    }
}
//# sourceMappingURL=base.js.map