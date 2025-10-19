/**
 * Nexus Code - Main Application
 * Production-ready multi-agent AI coding system
 */
import { EventEmitter } from 'events';
import { AgentRole, TaskPriority, success, failure, PermissionAction, ResourceType } from './core/types/index.js';
import { MCPServer } from './core/mcp/client.js';
import { AgentOrchestrator } from './core/orchestration/orchestrator.js';
import { SupervisorAgent } from './agents/supervisor/index.js';
import { ImplementationAgent } from './agents/implementation/index.js';
import { SecurityAgent } from './agents/security/index.js';
import { ABACEngine, SandboxManager, PermissionManager } from './security/permissions/index.js';
import { AuditLogger, ProvenanceTracker } from './security/audit/index.js';
/**
 * Nexus Code - Main Application Class
 */
export class NexusCode extends EventEmitter {
    config;
    rpcServer;
    mcpServer;
    orchestrator;
    abac;
    sandboxManager;
    permissionManager;
    auditLogger;
    provenanceTracker;
    initialized = false;
    constructor(config) {
        super();
        this.config = config;
        // Initialize MCP Server
        this.mcpServer = new MCPServer();
        // Initialize orchestrator
        const orchestratorConfig = {
            maxConcurrentAgents: config.maxConcurrentAgents,
            maxTasksPerAgent: config.maxTasksPerAgent,
            taskTimeout: config.defaultTimeout,
            retryAttempts: 3,
        };
        this.orchestrator = new AgentOrchestrator(orchestratorConfig);
        // Initialize security components
        this.abac = new ABACEngine();
        this.sandboxManager = new SandboxManager();
        this.permissionManager = new PermissionManager(this.abac);
        // Initialize audit logging
        this.auditLogger = new AuditLogger({
            logFile: './logs/nexus-audit.log',
            level: config.logging.level,
            enableProvenance: config.logging.provenanceTracking,
            retentionDays: 90,
        });
        this.provenanceTracker = new ProvenanceTracker();
        // Setup event handlers
        this.setupEventHandlers();
    }
    /**
     * Initialize the system
     */
    async initialize() {
        if (this.initialized) {
            return failure(new Error('System already initialized'));
        }
        try {
            this.emit('system:initializing');
            // Register default security policies
            this.setupDefaultSecurityPolicies();
            // Initialize agents
            await this.initializeAgents();
            // Initialize RPC server if enabled
            // (Optional - can be enabled via config)
            this.initialized = true;
            this.emit('system:initialized');
            return success(undefined);
        }
        catch (error) {
            return failure(error);
        }
    }
    /**
     * Initialize all agents
     */
    async initializeAgents() {
        const agentConfig = {
            name: '',
            version: '1.0.0',
            mcpConfig: {
                anthropicApiKey: this.config.anthropicApiKey,
                model: this.config.model,
                maxTokens: this.config.maxTokens,
                temperature: this.config.temperature,
            },
        };
        // Create Supervisor Agent
        const supervisor = new SupervisorAgent({
            ...agentConfig,
            name: 'Nexus Supervisor',
        });
        await supervisor.start();
        this.orchestrator.registerAgent(supervisor);
        // Create Implementation Agent
        const implementation = new ImplementationAgent({
            ...agentConfig,
            name: 'Nexus Implementation',
        });
        await implementation.start();
        this.orchestrator.registerAgent(implementation);
        // Create Security Agent
        const security = new SecurityAgent({
            ...agentConfig,
            name: 'Nexus Security',
        });
        await security.start();
        this.orchestrator.registerAgent(security);
        // Add more agents as needed (Testing, Review, Docs)
        this.emit('agents:initialized', {
            count: this.orchestrator.getAllAgents().length,
        });
    }
    /**
     * Setup default security policies
     */
    setupDefaultSecurityPolicies() {
        // Allow all file operations by default (can be restricted)
        this.abac.addPolicy({
            id: 'default-file-access',
            name: 'Default File Access',
            description: 'Allow file operations for authenticated users',
            rules: [
                {
                    id: 'read-files',
                    subject: '*',
                    action: PermissionAction.READ,
                    resource: ResourceType.FILE,
                    resourcePattern: '**/*',
                    effect: 'allow',
                },
                {
                    id: 'write-files',
                    subject: '*',
                    action: PermissionAction.WRITE,
                    resource: ResourceType.FILE,
                    resourcePattern: '/home/claude/**/*',
                    effect: 'allow',
                },
            ],
            active: true,
        });
        // Terminal access policy
        if (!this.config.security.autoApprove) {
            this.abac.addPolicy({
                id: 'terminal-restrictions',
                name: 'Terminal Access Restrictions',
                description: 'Restrict terminal access to approved users',
                rules: [
                    {
                        id: 'terminal-execute',
                        subject: 'role=admin',
                        action: PermissionAction.EXECUTE,
                        resource: ResourceType.TERMINAL,
                        resourcePattern: '*',
                        effect: 'allow',
                    },
                ],
                active: true,
            });
        }
    }
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Orchestrator events
        this.orchestrator.on('task:started', (data) => {
            this.auditLogger.logAgentAction(data.workflowId || 'unknown', 'system', data.agentId, 'task:started', data.taskId, 'success', data);
        });
        this.orchestrator.on('task:completed', (data) => {
            this.auditLogger.logAgentAction('workflow', 'system', data.agentId, 'task:completed', data.taskId, 'success', data);
        });
        this.orchestrator.on('task:failed', (data) => {
            this.auditLogger.logAgentAction('workflow', 'system', data.agentId, 'task:failed', data.taskId, 'failure', data);
        });
        // Security events
        this.abac.on('permission:checked', (data) => {
            this.emit('security:permission-check', data);
        });
        this.sandboxManager.on('sandbox:created', (data) => {
            this.emit('security:sandbox-created', data);
        });
        // Audit events
        this.auditLogger.on('audit:logged', (log) => {
            this.emit('audit:log', log);
        });
    }
    /**
     * Execute a coding task
     */
    async executeTask(description, input) {
        if (!this.initialized) {
            return failure(new Error('System not initialized'));
        }
        try {
            // Create a plan using Supervisor
            const supervisors = this.orchestrator.getAgentsByRole(AgentRole.SUPERVISOR);
            if (supervisors.length === 0) {
                return failure(new Error('No supervisor agent available'));
            }
            const supervisor = supervisors[0];
            // Create planning task
            const planningTask = {
                id: `task-${Date.now()}`,
                type: 'plan',
                description: `Create a workflow plan for: ${description}`,
                priority: TaskPriority.HIGH,
                dependencies: [],
                status: 'pending',
                input: { description, requirements: input },
                created: new Date(),
                metadata: {},
            };
            // Execute planning
            const planResult = await supervisor.execute(planningTask);
            if (!planResult.success) {
                return planResult;
            }
            // Create workflow from plan
            const workflow = this.orchestrator.createWorkflow('Coding Task', description, []);
            // Execute workflow
            const executionResult = await this.orchestrator.executeWorkflow(workflow);
            return executionResult;
        }
        catch (error) {
            return failure(error);
        }
    }
    /**
     * Generate code
     */
    async generateCode(description, requirements, specifications) {
        const implementations = this.orchestrator.getAgentsByRole(AgentRole.IMPLEMENTATION);
        if (implementations.length === 0) {
            return failure(new Error('No implementation agent available'));
        }
        const task = {
            id: `gen-${Date.now()}`,
            type: 'code_generation',
            description,
            priority: TaskPriority.HIGH,
            dependencies: [],
            status: 'pending',
            input: { requirements, specification: specifications },
            created: new Date(),
            metadata: {},
        };
        return await implementations[0].execute(task);
    }
    /**
     * Analyze security
     */
    async analyzeSecurity(codePath) {
        const securityAgents = this.orchestrator.getAgentsByRole(AgentRole.SECURITY);
        if (securityAgents.length === 0) {
            return failure(new Error('No security agent available'));
        }
        const task = {
            id: `sec-${Date.now()}`,
            type: 'security_scan',
            description: `Analyze security of ${codePath}`,
            priority: TaskPriority.HIGH,
            dependencies: [],
            status: 'pending',
            input: { path: codePath },
            created: new Date(),
            metadata: {},
        };
        return await securityAgents[0].execute(task);
    }
    /**
     * Get system status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            agents: this.orchestrator.getStats(),
            audit: this.auditLogger.getStats(),
            provenance: this.provenanceTracker.getStats(),
            security: {
                policies: this.abac.getPolicies().length,
                sandboxes: this.sandboxManager.getActiveSandboxes().length,
            },
        };
    }
    /**
     * Shutdown the system
     */
    async shutdown() {
        this.emit('system:shutting-down');
        // Stop all agents
        const agents = this.orchestrator.getAllAgents();
        for (const agent of agents) {
            await agent.stop();
        }
        // Clean up sandboxes
        const sandboxes = this.sandboxManager.getActiveSandboxes();
        for (const sessionId of sandboxes) {
            await this.sandboxManager.destroySandbox(sessionId);
        }
        // Export audit logs
        await this.auditLogger.export('./logs/final-audit.json');
        await this.provenanceTracker.export('./logs/provenance.json');
        this.initialized = false;
        this.emit('system:shutdown');
    }
    /**
     * Get orchestrator
     */
    getOrchestrator() {
        return this.orchestrator;
    }
    /**
     * Get MCP server
     */
    getMCPServer() {
        return this.mcpServer;
    }
    /**
     * Get audit logger
     */
    getAuditLogger() {
        return this.auditLogger;
    }
    /**
     * Get provenance tracker
     */
    getProvenanceTracker() {
        return this.provenanceTracker;
    }
}
/**
 * Create and initialize Nexus Code instance
 */
export async function createNexusCode(config) {
    try {
        const nexus = new NexusCode(config);
        const initResult = await nexus.initialize();
        if (!initResult.success) {
            return failure(initResult.error);
        }
        return success(nexus);
    }
    catch (error) {
        return failure(error);
    }
}
//# sourceMappingURL=index.js.map