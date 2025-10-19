/**
 * Nexus Code - Main Application
 * Production-ready multi-agent AI coding system
 */

import { EventEmitter } from 'events';
import { NexusConfig, AgentRole, Task, TaskPriority, Result, success, failure, PermissionAction, ResourceType } from './core/types/index.js';
import { JsonRpcServer, RpcServerConfig } from './core/rpc/server.js';
import { MCPServer } from './core/mcp/client.js';
import { AgentOrchestrator, OrchestratorConfig } from './core/orchestration/orchestrator.js';
import { SupervisorAgent } from './agents/supervisor/index.js';
import { ImplementationAgent } from './agents/implementation/index.js';
import { SecurityAgent } from './agents/security/index.js';
import { ABACEngine, SandboxManager, PermissionManager } from './security/permissions/index.js';
import { AuditLogger, ProvenanceTracker } from './security/audit/index.js';
import { BaseAgent, AgentFactory } from './core/agents/base.js';

/**
 * Nexus Code - Main Application Class
 */
export class NexusCode extends EventEmitter {
  private config: NexusConfig;
  private rpcServer?: JsonRpcServer;
  private mcpServer: MCPServer;
  private orchestrator: AgentOrchestrator;
  private abac: ABACEngine;
  private sandboxManager: SandboxManager;
  private permissionManager: PermissionManager;
  private auditLogger: AuditLogger;
  private provenanceTracker: ProvenanceTracker;
  private initialized = false;

  constructor(config: NexusConfig) {
    super();
    this.config = config;

    // Initialize MCP Server
    this.mcpServer = new MCPServer();

    // Initialize orchestrator
    const orchestratorConfig: OrchestratorConfig = {
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
  async initialize(): Promise<Result<void>> {
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
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Initialize all agents
   */
  private async initializeAgents(): Promise<void> {
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
  private setupDefaultSecurityPolicies(): void {
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
  private setupEventHandlers(): void {
    // Orchestrator events
    this.orchestrator.on('task:started', (data) => {
      this.auditLogger.logAgentAction(
        data.workflowId || 'unknown',
        'system',
        data.agentId,
        'task:started',
        data.taskId,
        'success',
        data,
      );
    });

    this.orchestrator.on('task:completed', (data) => {
      this.auditLogger.logAgentAction(
        'workflow',
        'system',
        data.agentId,
        'task:completed',
        data.taskId,
        'success',
        data,
      );
    });

    this.orchestrator.on('task:failed', (data) => {
      this.auditLogger.logAgentAction(
        'workflow',
        'system',
        data.agentId,
        'task:failed',
        data.taskId,
        'failure',
        data,
      );
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
  async executeTask(description: string, input: any): Promise<Result<any>> {
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
      const planningTask: Task = {
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
      const workflow = this.orchestrator.createWorkflow(
        'Coding Task',
        description,
        [], // Would be populated from plan
      );

      // Execute workflow
      const executionResult = await this.orchestrator.executeWorkflow(workflow);

      return executionResult;
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Generate code
   */
  async generateCode(
    description: string,
    requirements: string[],
    specifications?: any,
  ): Promise<Result<any>> {
    const implementations = this.orchestrator.getAgentsByRole(AgentRole.IMPLEMENTATION);
    if (implementations.length === 0) {
      return failure(new Error('No implementation agent available'));
    }

    const task: Task = {
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
  async analyzeSecurity(codePath: string): Promise<Result<any>> {
    const securityAgents = this.orchestrator.getAgentsByRole(AgentRole.SECURITY);
    if (securityAgents.length === 0) {
      return failure(new Error('No security agent available'));
    }

    const task: Task = {
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
  async shutdown(): Promise<void> {
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
  getOrchestrator(): AgentOrchestrator {
    return this.orchestrator;
  }

  /**
   * Get MCP server
   */
  getMCPServer(): MCPServer {
    return this.mcpServer;
  }

  /**
   * Get audit logger
   */
  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  /**
   * Get provenance tracker
   */
  getProvenanceTracker(): ProvenanceTracker {
    return this.provenanceTracker;
  }
}

/**
 * Create and initialize Nexus Code instance
 */
export async function createNexusCode(config: NexusConfig): Promise<Result<NexusCode>> {
  try {
    const nexus = new NexusCode(config);
    const initResult = await nexus.initialize();

    if (!initResult.success) {
      return failure(initResult.error);
    }

    return success(nexus);
  } catch (error) {
    return failure(error as Error);
  }
}
