/**
 * Nexus Code - Supervisor Agent
 * Lead agent for planning, coordination, and task delegation
 */

import { BaseAgent, AgentConfig } from '../../core/agents/base.js';
import {
  Task,
  TaskPriority,
  AgentRole,
  WorkflowPlan,
  Result,
  success,
  failure,
  MCPTool,
} from '../../core/types/index.js';

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
export class SupervisorAgent extends BaseAgent {
  constructor(config: Omit<AgentConfig, 'role' | 'capabilities'>) {
    super({
      ...config,
      role: AgentRole.SUPERVISOR,
      capabilities: [
        {
          name: 'planning',
          description: 'Break down complex tasks into manageable subtasks',
          tools: ['analyze_requirements', 'create_plan', 'decompose_task'],
          maxConcurrency: 1,
        },
        {
          name: 'coordination',
          description: 'Coordinate multiple agents and manage workflow execution',
          tools: ['delegate_task', 'monitor_progress', 'resolve_conflicts'],
          maxConcurrency: 5,
        },
        {
          name: 'decision_making',
          description: 'Make high-level decisions about architecture and approach',
          tools: ['evaluate_options', 'select_strategy', 'prioritize_tasks'],
          maxConcurrency: 1,
        },
      ],
    });
  }

  protected initializeTools(): void {
    // Tool: Analyze Requirements
    this.registerTool({
      name: 'analyze_requirements',
      description: 'Analyze user requirements and identify key components, constraints, and success criteria',
      inputSchema: {
        type: 'object',
        properties: {
          requirements: {
            type: 'string',
            description: 'The user requirements to analyze',
          },
        },
        required: ['requirements'],
      },
    });

    // Tool: Create Workflow Plan
    this.registerTool({
      name: 'create_plan',
      description: 'Create a detailed workflow plan with tasks, dependencies, and execution strategy',
      inputSchema: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'The overall goal to achieve',
          },
          requirements: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of requirements',
          },
          constraints: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of constraints',
          },
        },
        required: ['goal', 'requirements'],
      },
    });

    // Tool: Decompose Task
    this.registerTool({
      name: 'decompose_task',
      description: 'Break down a complex task into smaller, manageable subtasks',
      inputSchema: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'The task to decompose',
          },
          level: {
            type: 'number',
            description: 'Decomposition level (1-3)',
          },
        },
        required: ['task'],
      },
    });

    // Tool: Delegate Task
    this.registerTool({
      name: 'delegate_task',
      description: 'Delegate a task to an appropriate specialized agent',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID of the task to delegate',
          },
          targetRole: {
            type: 'string',
            enum: Object.values(AgentRole),
            description: 'Role of the target agent',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'Task priority',
          },
          context: {
            type: 'object',
            description: 'Additional context for the task',
          },
        },
        required: ['taskId', 'targetRole', 'priority'],
      },
    });

    // Tool: Monitor Progress
    this.registerTool({
      name: 'monitor_progress',
      description: 'Check progress of ongoing tasks and identify blockers',
      inputSchema: {
        type: 'object',
        properties: {
          workflowId: {
            type: 'string',
            description: 'ID of the workflow to monitor',
          },
        },
        required: ['workflowId'],
      },
    });
  }

  protected async processTask(task: Task): Promise<Result<any>> {
    try {
      // Add task context to memory
      this.addMemory({
        content: JSON.stringify({ task: task.description, type: task.type }),
        type: 'context',
        contributingAgents: [this.metadata.id],
        metadata: { taskId: task.id },
      });

      // Build prompt based on task type
      const prompt = this.buildPrompt(task);

      // Send to Claude for processing
      const response = await this.sendMessage(prompt);

      if (!response.success) {
        return failure(response.error);
      }

      // Parse response
      const result = this.parseResponse(response.data, task.type);

      // Store result in memory
      this.addMemory({
        content: response.data,
        type: 'result',
        contributingAgents: [this.metadata.id],
        metadata: { taskId: task.id, result },
      });

      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }

  protected async executeTool(name: string, input: any): Promise<Result<any>> {
    try {
      switch (name) {
        case 'analyze_requirements':
          return await this.analyzeRequirements(input.requirements);

        case 'create_plan':
          return await this.createPlan(
            input.goal,
            input.requirements,
            input.constraints || [],
          );

        case 'decompose_task':
          return await this.decomposeTask(input.task, input.level || 2);

        case 'delegate_task':
          return await this.delegateTask(
            input.taskId,
            input.targetRole,
            input.priority,
            input.context,
          );

        case 'monitor_progress':
          return await this.monitorProgress(input.workflowId);

        default:
          return failure(new Error(`Unknown tool: ${name}`));
      }
    } catch (error) {
      return failure(error as Error);
    }
  }

  protected getSystemPrompt(): string {
    return `You are the Supervisor Agent in the Nexus Code multi-agent system.

Your responsibilities:
1. Analyze user requirements and identify key components
2. Break down complex coding tasks into manageable subtasks
3. Create detailed workflow plans with proper dependencies
4. Delegate tasks to specialized agents (Architect, Implementation, Security, Testing, Review, Documentation)
5. Monitor progress and coordinate execution
6. Make high-level architectural and strategic decisions

Available specialized agents:
- Architect: System design, architecture decisions, technology selection
- Implementation: Code generation, feature development
- Security: Vulnerability scanning, security analysis
- Testing: Quality assurance, test generation, test execution
- Review: Code review, best practices validation
- Documentation: Technical documentation, API docs, README files

Guidelines:
- Always think through the problem systematically
- Create clear, actionable tasks for other agents
- Identify dependencies between tasks
- Prioritize tasks appropriately (critical > high > medium > low)
- Consider parallel execution opportunities
- Provide clear context and requirements to delegated agents
- Monitor for blockers and adjust plans as needed

When creating workflow plans:
- Break complex tasks into 5-15 smaller tasks
- Group tasks that can run in parallel
- Ensure proper dependencies are specified
- Include all necessary phases: design, implementation, testing, review, documentation
- Estimate realistic durations

Output Format:
- For planning tasks: Provide structured workflow plans with tasks, dependencies, and reasoning
- For delegation: Clearly specify target agent, task details, and priority
- For monitoring: Report on progress, identify blockers, suggest adjustments
- Always explain your reasoning and decision-making process`;
  }

  /**
   * Build prompt based on task
   */
  private buildPrompt(task: Task): string {
    const systemPrompt = this.getSystemPrompt();
    const recentMemory = this.getRecentMemory(5);
    const memoryContext = recentMemory.length > 0
      ? `\n\nRecent context:\n${recentMemory.map(m => m.content).join('\n')}`
      : '';

    let prompt = `${systemPrompt}\n\n`;

    switch (task.type) {
      case 'plan':
        prompt += `Create a comprehensive workflow plan for the following request:\n\n`;
        prompt += `${task.description}\n\n`;
        prompt += `Requirements: ${JSON.stringify(task.input)}\n\n`;
        prompt += `Provide a detailed plan with:\n`;
        prompt += `1. List of tasks with clear descriptions\n`;
        prompt += `2. Task dependencies\n`;
        prompt += `3. Recommended agent assignments\n`;
        prompt += `4. Priority levels\n`;
        prompt += `5. Estimated duration\n`;
        prompt += `6. Your reasoning`;
        break;

      case 'delegate':
        prompt += `Delegate the following task to an appropriate specialized agent:\n\n`;
        prompt += `${task.description}\n\n`;
        prompt += `Task details: ${JSON.stringify(task.input)}\n\n`;
        prompt += `Determine:\n`;
        prompt += `1. Which agent role is best suited for this task\n`;
        prompt += `2. Task priority level\n`;
        prompt += `3. Any special instructions or context needed\n`;
        prompt += `4. Your reasoning`;
        break;

      case 'monitor':
        prompt += `Monitor progress of the current workflow:\n\n`;
        prompt += `${task.description}\n\n`;
        prompt += `Current status: ${JSON.stringify(task.input)}\n\n`;
        prompt += `Analyze:\n`;
        prompt += `1. Overall progress\n`;
        prompt += `2. Any blockers or issues\n`;
        prompt += `3. Recommendations for adjustments\n`;
        prompt += `4. Next steps`;
        break;

      default:
        prompt += `Task: ${task.description}\n\n`;
        prompt += `Input: ${JSON.stringify(task.input)}\n\n`;
        prompt += `Provide a comprehensive response.`;
    }

    prompt += memoryContext;

    return prompt;
  }

  /**
   * Parse response based on task type
   */
  private parseResponse(response: string, taskType: string): any {
    // Check if response is tool use
    try {
      const parsed = JSON.parse(response);
      if (parsed.type === 'tool_use') {
        return parsed;
      }
    } catch (e) {
      // Not JSON, continue with text parsing
    }

    // Return structured response
    return {
      type: taskType,
      response,
      timestamp: new Date(),
    };
  }

  /**
   * Analyze requirements
   */
  private async analyzeRequirements(requirements: string): Promise<Result<any>> {
    // This would be implemented by Claude through the MCP
    return success({
      components: [],
      constraints: [],
      successCriteria: [],
      complexity: 'medium',
    });
  }

  /**
   * Create workflow plan
   */
  private async createPlan(
    goal: string,
    requirements: string[],
    constraints: string[],
  ): Promise<Result<PlanningResult>> {
    // This would be implemented by Claude through the MCP
    return success({
      workflow: {} as WorkflowPlan,
      reasoning: 'Plan created based on requirements',
      estimatedDuration: 3600000, // 1 hour
      requiredAgents: [AgentRole.ARCHITECT, AgentRole.IMPLEMENTATION],
    });
  }

  /**
   * Decompose task into subtasks
   */
  private async decomposeTask(task: string, level: number): Promise<Result<Task[]>> {
    // This would be implemented by Claude through the MCP
    return success([]);
  }

  /**
   * Delegate task to another agent
   */
  private async delegateTask(
    taskId: string,
    targetRole: AgentRole,
    priority: string,
    context?: any,
  ): Promise<Result<DelegationDecision>> {
    // Convert string priority to TaskPriority enum
    let taskPriority: TaskPriority;
    switch (priority.toLowerCase()) {
      case 'critical':
        taskPriority = TaskPriority.CRITICAL;
        break;
      case 'high':
        taskPriority = TaskPriority.HIGH;
        break;
      case 'low':
        taskPriority = TaskPriority.LOW;
        break;
      default:
        taskPriority = TaskPriority.MEDIUM;
    }

    const decision: DelegationDecision = {
      taskId,
      targetRole,
      priority: taskPriority,
      reasoning: `Task delegated to ${targetRole} based on capabilities`,
    };

    this.emit('task:delegated', decision);
    return success(decision);
  }

  /**
   * Monitor workflow progress
   */
  private async monitorProgress(workflowId: string): Promise<Result<any>> {
    // This would be implemented by Claude through the MCP
    return success({
      workflowId,
      status: 'in_progress',
      completedTasks: 0,
      pendingTasks: 0,
      blockers: [],
    });
  }
}
