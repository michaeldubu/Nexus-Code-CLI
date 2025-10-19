/**
 * Nexus Code - Multi-Agent Orchestration Engine
 * Production-ready orchestration with parallel execution and dependency management
 */
import { EventEmitter } from 'events';
import { Task, WorkflowPlan, ExecutionContext, AgentRole, Result } from '../types/index.js';
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
export declare class AgentOrchestrator extends EventEmitter {
    private config;
    private agents;
    private agentsByRole;
    private activeExecutions;
    private taskAssignments;
    private taskQueue;
    constructor(config: OrchestratorConfig);
    /**
     * Register an agent with the orchestrator
     */
    registerAgent(agent: BaseAgent): void;
    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: string): Promise<Result<void>>;
    /**
     * Setup event handlers for an agent
     */
    private setupAgentEventHandlers;
    /**
     * Create a workflow plan
     */
    createWorkflow(name: string, description: string, tasks: Omit<Task, 'id' | 'status' | 'created'>[]): WorkflowPlan;
    /**
     * Analyze task dependencies and determine execution strategy
     */
    private analyzeDependencies;
    /**
     * Execute a workflow
     */
    executeWorkflow(workflow: WorkflowPlan): Promise<Result<ExecutionContext>>;
    /**
     * Execute tasks in parallel
     */
    private executeParallelTasks;
    /**
     * Execute a single task
     */
    private executeTask;
    /**
     * Select appropriate agent for a task
     */
    private selectAgent;
    /**
     * Get agent priority (lower is better)
     */
    private getAgentPriority;
    /**
     * Handle task timeout
     */
    private taskTimeout;
    /**
     * Handle task completion
     */
    private handleTaskCompleted;
    /**
     * Handle task failure
     */
    private handleTaskFailed;
    /**
     * Log execution event
     */
    private logExecution;
    /**
     * Get agent by ID
     */
    getAgent(agentId: string): BaseAgent | undefined;
    /**
     * Get agents by role
     */
    getAgentsByRole(role: AgentRole): BaseAgent[];
    /**
     * Get all agents
     */
    getAllAgents(): BaseAgent[];
    /**
     * Get execution context
     */
    getExecutionContext(workflowId: string): ExecutionContext | undefined;
    /**
     * Get task assignment
     */
    getTaskAssignment(taskId: string): TaskAssignment | undefined;
    /**
     * Get orchestrator stats
     */
    getStats(): {
        totalAgents: number;
        activeExecutions: number;
        taskAssignments: number;
        agentsByRole: {
            [k: string]: number;
        };
    };
}
//# sourceMappingURL=orchestrator.d.ts.map