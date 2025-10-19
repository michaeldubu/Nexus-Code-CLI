/**
 * Nexus Code - Supervisor Agent
 * Lead agent for planning, coordination, and task delegation
 */
import { BaseAgent, AgentConfig } from '../../core/agents/base.js';
import { Task, TaskPriority, AgentRole, WorkflowPlan, Result } from '../../core/types/index.js';
export interface PlanningResult {
    workflow: WorkflowPlan;
    reasoning: string;
    estimatedDuration: number;
    requiredAgents: AgentRole[];
}
export interface DelegationDecision {
    taskId: string;
    targetRole: AgentRole;
    priority: TaskPriority;
    reasoning: string;
}
/**
 * Supervisor Agent
 * Responsible for:
 * - Understanding user requirements
 * - Breaking down complex tasks into subtasks
 * - Creating workflow plans
 * - Delegating tasks to specialized agents
 * - Monitoring progress and coordinating execution
 */
export declare class SupervisorAgent extends BaseAgent {
    constructor(config: Omit<AgentConfig, 'role' | 'capabilities'>);
    protected initializeTools(): void;
    protected processTask(task: Task): Promise<Result<any>>;
    protected executeTool(name: string, input: any): Promise<Result<any>>;
    protected getSystemPrompt(): string;
    /**
     * Build prompt based on task
     */
    private buildPrompt;
    /**
     * Parse response based on task type
     */
    private parseResponse;
    /**
     * Analyze requirements
     */
    private analyzeRequirements;
    /**
     * Create workflow plan
     */
    private createPlan;
    /**
     * Decompose task into subtasks
     */
    private decomposeTask;
    /**
     * Delegate task to another agent
     */
    private delegateTask;
    /**
     * Monitor workflow progress
     */
    private monitorProgress;
}
//# sourceMappingURL=index.d.ts.map