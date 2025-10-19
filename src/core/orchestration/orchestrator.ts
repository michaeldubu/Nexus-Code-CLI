/**
 * Nexus Code - Multi-Agent Orchestration Engine
 * Production-ready orchestration with parallel execution and dependency management
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  TaskPriority,
  WorkflowPlan,
  ExecutionContext,
  ExecutionLog,
  AgentRole,
  Result,
  success,
  failure,
} from '../types/index.js';
import { BaseAgent } from '../agents/base.js';

export interface OrchestratorConfig {
  maxConcurrentAgents: number;
  maxTasksPerAgent: number;
  taskTimeout: number;
  retryAttempts: number;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
}

/**
 * Multi-Agent Orchestrator
 * Coordinates agent execution, manages dependencies, and handles parallel execution
 */
export class AgentOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private agents = new Map<string, BaseAgent>();
  private agentsByRole = new Map<AgentRole, Set<string>>();
  private activeExecutions = new Map<string, ExecutionContext>();
  private taskAssignments = new Map<string, TaskAssignment>();
  private taskQueue: Task[] = [];

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: BaseAgent): void {
    const metadata = agent.getMetadata();
    
    if (this.agents.has(metadata.id)) {
      throw new Error(`Agent '${metadata.id}' is already registered`);
    }

    this.agents.set(metadata.id, agent);

    // Track by role
    if (!this.agentsByRole.has(metadata.role)) {
      this.agentsByRole.set(metadata.role, new Set());
    }
    this.agentsByRole.get(metadata.role)!.add(metadata.id);

    // Setup agent event handlers
    this.setupAgentEventHandlers(agent);

    this.emit('agent:registered', { agentId: metadata.id, role: metadata.role });
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<Result<void>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return failure(new Error(`Agent '${agentId}' not found`));
    }

    // Stop agent if running
    await agent.stop();

    // Remove from tracking
    const metadata = agent.getMetadata();
    this.agents.delete(agentId);
    this.agentsByRole.get(metadata.role)?.delete(agentId);

    this.emit('agent:unregistered', { agentId });
    return success(undefined);
  }

  /**
   * Setup event handlers for an agent
   */
  private setupAgentEventHandlers(agent: BaseAgent): void {
    const agentId = agent.getMetadata().id;

    agent.on('task:started', (data) => {
      this.emit('task:started', { ...data, agentId });
    });

    agent.on('task:completed', (data) => {
      this.handleTaskCompleted(data.taskId, data.result);
    });

    agent.on('task:failed', (data) => {
      this.handleTaskFailed(data.taskId, data.error);
    });

    agent.on('message:send', (message) => {
      // Route message to target agent
      const targetAgent = this.agents.get(message.to);
      if (targetAgent) {
        targetAgent.receiveFromAgent(message);
      }
    });

    agent.on('error', (data) => {
      this.emit('error', { ...data, agentId });
    });
  }

  /**
   * Create a workflow plan
   */
  createWorkflow(
    name: string,
    description: string,
    tasks: Omit<Task, 'id' | 'status' | 'created'>[],
  ): WorkflowPlan {
    const workflow: WorkflowPlan = {
      id: uuidv4(),
      name,
      description,
      tasks: tasks.map(t => ({
        id: uuidv4(),
        status: 'pending',
        created: new Date(),
        ...t,
      })),
      parallel: [],
      sequential: [],
      estimatedDuration: 0,
      metadata: {},
    };

    // Analyze dependencies and determine execution order
    this.analyzeDependencies(workflow);

    this.emit('workflow:created', { workflowId: workflow.id, name });
    return workflow;
  }

  /**
   * Analyze task dependencies and determine execution strategy
   */
  private analyzeDependencies(workflow: WorkflowPlan): void {
    const taskMap = new Map(workflow.tasks.map(t => [t.id, t]));
    const completed = new Set<string>();
    const parallel: string[][] = [];
    const sequential: string[] = [];

    // Group tasks by dependency level
    while (completed.size < workflow.tasks.length) {
      const ready: string[] = [];

      for (const task of workflow.tasks) {
        if (completed.has(task.id)) continue;

        // Check if all dependencies are completed
        const depsReady = task.dependencies.every(dep => completed.has(dep));
        if (depsReady) {
          ready.push(task.id);
        }
      }

      if (ready.length === 0) {
        // Circular dependency detected
        throw new Error('Circular dependency detected in workflow');
      }

      // Tasks at same level can run in parallel
      if (ready.length > 1) {
        parallel.push(ready);
      } else {
        sequential.push(ready[0]);
      }

      // Mark as completed
      ready.forEach(id => completed.add(id));
    }

    workflow.parallel = parallel;
    workflow.sequential = sequential;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflow: WorkflowPlan): Promise<Result<ExecutionContext>> {
    const context: ExecutionContext = {
      workflowId: workflow.id,
      sessionId: uuidv4(),
      startTime: new Date(),
      activeAgents: new Set(),
      completedTasks: new Set(),
      failedTasks: new Set(),
      artifacts: new Map(),
      logs: [],
    };

    this.activeExecutions.set(workflow.id, context);

    try {
      this.emit('workflow:started', { workflowId: workflow.id });

      // Execute parallel groups
      for (const parallelGroup of workflow.parallel) {
        await this.executeParallelTasks(parallelGroup, workflow, context);
      }

      // Execute sequential tasks
      for (const taskId of workflow.sequential) {
        const task = workflow.tasks.find(t => t.id === taskId);
        if (task) {
          await this.executeTask(task, workflow, context);
        }
      }

      this.emit('workflow:completed', {
        workflowId: workflow.id,
        duration: Date.now() - context.startTime.getTime(),
      });

      return success(context);
    } catch (error) {
      this.emit('workflow:failed', {
        workflowId: workflow.id,
        error,
      });
      return failure(error as Error);
    } finally {
      this.activeExecutions.delete(workflow.id);
    }
  }

  /**
   * Execute tasks in parallel
   */
  private async executeParallelTasks(
    taskIds: string[],
    workflow: WorkflowPlan,
    context: ExecutionContext,
  ): Promise<void> {
    const tasks = taskIds
      .map(id => workflow.tasks.find(t => t.id === id))
      .filter(t => t !== undefined) as Task[];

    // Limit concurrency
    const batches: Task[][] = [];
    for (let i = 0; i < tasks.length; i += this.config.maxConcurrentAgents) {
      batches.push(tasks.slice(i, i + this.config.maxConcurrentAgents));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map(task => this.executeTask(task, workflow, context)),
      );
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: Task,
    workflow: WorkflowPlan,
    context: ExecutionContext,
  ): Promise<Result<any>> {
    try {
      // Find appropriate agent
      const agent = await this.selectAgent(task);
      if (!agent) {
        throw new Error(`No available agent for task '${task.id}'`);
      }

      const agentId = agent.getMetadata().id;

      // Track assignment
      this.taskAssignments.set(task.id, {
        taskId: task.id,
        agentId,
        assignedAt: new Date(),
      });

      context.activeAgents.add(agentId);

      // Log task start
      this.logExecution(context, {
        level: 'info',
        agentId,
        taskId: task.id,
        message: `Executing task: ${task.description}`,
      });

      // Execute task with timeout
      const result = await Promise.race([
        agent.execute(task),
        this.taskTimeout(task.id),
      ]);

      if (result.success) {
        context.completedTasks.add(task.id);
        
        // Store artifact if present
        if (result.data) {
          context.artifacts.set(task.id, result.data);
        }

        this.logExecution(context, {
          level: 'info',
          agentId,
          taskId: task.id,
          message: `Task completed successfully`,
          data: { result: result.data },
        });
      } else {
        context.failedTasks.add(task.id);
        
        this.logExecution(context, {
          level: 'error',
          agentId,
          taskId: task.id,
          message: `Task failed: ${result.error.message}`,
          data: { error: result.error },
        });
      }

      context.activeAgents.delete(agentId);
      this.taskAssignments.delete(task.id);

      return result;
    } catch (error) {
      context.failedTasks.add(task.id);
      return failure(error as Error);
    }
  }

  /**
   * Select appropriate agent for a task
   */
  private async selectAgent(task: Task): Promise<BaseAgent | null> {
    // Find agents with matching capabilities
    const candidates: BaseAgent[] = [];

    for (const agent of this.agents.values()) {
      if (agent.isBusy()) continue;

      const metadata = agent.getMetadata();
      const hasCapability = metadata.capabilities.some(cap =>
        cap.name === task.type || cap.tools.includes(task.type),
      );

      if (hasCapability) {
        candidates.push(agent);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Select agent based on priority and load
    candidates.sort((a, b) => {
      const aPriority = this.getAgentPriority(a);
      const bPriority = this.getAgentPriority(b);
      return aPriority - bPriority;
    });

    return candidates[0];
  }

  /**
   * Get agent priority (lower is better)
   */
  private getAgentPriority(agent: BaseAgent): number {
    const metadata = agent.getMetadata();
    let priority = 0;

    // Factor in status
    if (metadata.status === 'idle') priority += 0;
    else if (metadata.status === 'waiting') priority += 1;
    else priority += 10;

    // Factor in recent activity
    const timeSinceActive = Date.now() - metadata.lastActive.getTime();
    priority += Math.floor(timeSinceActive / 60000); // Add 1 per minute

    return priority;
  }

  /**
   * Handle task timeout
   */
  private taskTimeout(taskId: string): Promise<Result<never>> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task '${taskId}' timed out`));
      }, this.config.taskTimeout);
    });
  }

  /**
   * Handle task completion
   */
  private handleTaskCompleted(taskId: string, result: any): void {
    this.emit('task:completed', { taskId, result });
  }

  /**
   * Handle task failure
   */
  private handleTaskFailed(taskId: string, error: Error): void {
    this.emit('task:failed', { taskId, error });

    // Check for retry
    const assignment = this.taskAssignments.get(taskId);
    if (assignment) {
      // Implement retry logic here if needed
      this.emit('task:retry', { taskId, attempt: 1 });
    }
  }

  /**
   * Log execution event
   */
  private logExecution(
    context: ExecutionContext,
    log: Omit<ExecutionLog, 'id' | 'timestamp'>,
  ): void {
    const entry: ExecutionLog = {
      id: uuidv4(),
      timestamp: new Date(),
      ...log,
    };

    context.logs.push(entry);
    this.emit('log', entry);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agents by role
   */
  getAgentsByRole(role: AgentRole): BaseAgent[] {
    const agentIds = this.agentsByRole.get(role);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(a => a !== undefined) as BaseAgent[];
  }

  /**
   * Get all agents
   */
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get execution context
   */
  getExecutionContext(workflowId: string): ExecutionContext | undefined {
    return this.activeExecutions.get(workflowId);
  }

  /**
   * Get task assignment
   */
  getTaskAssignment(taskId: string): TaskAssignment | undefined {
    return this.taskAssignments.get(taskId);
  }

  /**
   * Get orchestrator stats
   */
  getStats() {
    return {
      totalAgents: this.agents.size,
      activeExecutions: this.activeExecutions.size,
      taskAssignments: this.taskAssignments.size,
      agentsByRole: Object.fromEntries(
        Array.from(this.agentsByRole.entries()).map(([role, agents]) => [
          role,
          agents.size,
        ]),
      ),
    };
  }
}
