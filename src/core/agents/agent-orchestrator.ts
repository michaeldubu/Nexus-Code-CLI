/**
 * Agent Orchestrator
 *
 * Coordinates multiple agents for complex tasks, working alongside
 * the existing UnifiedModelManager for backward compatibility.
 */

import { AgentSDKManager, AgentSDKConfig } from './agent-sdk-manager';
import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk';

/**
 * Task delegation strategy
 */
export type DelegationStrategy = 'sequential' | 'parallel' | 'conditional';

/**
 * Task definition for orchestration
 */
export interface AgentTask {
  id: string;
  description: string;
  agentType?: string; // Which subagent to use
  dependencies?: string[]; // Task IDs this depends on
  priority?: number;
  timeout?: number;
}

/**
 * Task execution result
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: any;
  error?: Error;
  stats?: {
    toolCalls: number;
    errorCount: number;
    duration: number;
  };
}

/**
 * Orchestration options
 */
export interface OrchestrationOptions {
  strategy?: DelegationStrategy;
  maxParallel?: number;
  continueOnError?: boolean;
  permissionMode?: PermissionMode;
}

/**
 * Agent Orchestrator Class
 *
 * Manages multiple agents working together on complex tasks.
 * Works alongside UnifiedModelManager - does not replace it.
 */
export class AgentOrchestrator {
  private agentSDK: AgentSDKManager;
  private tasks: Map<string, AgentTask> = new Map();
  private results: Map<string, TaskResult> = new Map();
  private isExecuting: boolean = false;

  constructor(config: AgentSDKConfig = {}) {
    this.agentSDK = new AgentSDKManager(config);
  }

  /**
   * Add a task to the orchestration queue
   */
  addTask(task: AgentTask): void {
    this.tasks.set(task.id, task);
  }

  /**
   * Add multiple tasks at once
   */
  addTasks(tasks: AgentTask[]): void {
    tasks.forEach(task => this.addTask(task));
  }

  /**
   * Clear all tasks and results
   */
  clear(): void {
    this.tasks.clear();
    this.results.clear();
  }

  /**
   * Execute all tasks based on strategy
   */
  async execute(options: OrchestrationOptions = {}): Promise<Map<string, TaskResult>> {
    if (this.isExecuting) {
      throw new Error('Orchestrator is already executing tasks');
    }

    const {
      strategy = 'sequential',
      maxParallel = 3,
      continueOnError = false,
      permissionMode = 'default',
    } = options;

    this.isExecuting = true;
    this.results.clear();

    try {
      switch (strategy) {
        case 'sequential':
          await this.executeSequential(continueOnError, permissionMode);
          break;
        case 'parallel':
          await this.executeParallel(maxParallel, continueOnError, permissionMode);
          break;
        case 'conditional':
          await this.executeConditional(continueOnError, permissionMode);
          break;
      }
    } finally {
      this.isExecuting = false;
    }

    return this.results;
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(
    continueOnError: boolean,
    permissionMode: PermissionMode
  ): Promise<void> {
    const taskArray = Array.from(this.tasks.values());

    for (const task of taskArray) {
      const result = await this.executeTask(task, permissionMode);
      this.results.set(task.id, result);

      if (!result.success && !continueOnError) {
        throw new Error(`Task ${task.id} failed: ${result.error?.message}`);
      }
    }
  }

  /**
   * Execute tasks in parallel with concurrency limit
   */
  private async executeParallel(
    maxParallel: number,
    continueOnError: boolean,
    permissionMode: PermissionMode
  ): Promise<void> {
    const taskArray = Array.from(this.tasks.values());
    const executing: Promise<void>[] = [];

    for (const task of taskArray) {
      const promise = this.executeTask(task, permissionMode).then(result => {
        this.results.set(task.id, result);

        if (!result.success && !continueOnError) {
          throw new Error(`Task ${task.id} failed: ${result.error?.message}`);
        }
      });

      executing.push(promise);

      if (executing.length >= maxParallel) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => p === promise),
          1
        );
      }
    }

    await Promise.all(executing);
  }

  /**
   * Execute tasks based on dependencies (topological sort)
   */
  private async executeConditional(
    continueOnError: boolean,
    permissionMode: PermissionMode
  ): Promise<void> {
    const sortedTasks = this.topologicalSort();

    for (const task of sortedTasks) {
      // Check if all dependencies succeeded
      if (task.dependencies) {
        const allDependenciesSucceeded = task.dependencies.every(depId => {
          const depResult = this.results.get(depId);
          return depResult && depResult.success;
        });

        if (!allDependenciesSucceeded) {
          this.results.set(task.id, {
            taskId: task.id,
            success: false,
            error: new Error('Dependencies failed or not completed'),
          });
          continue;
        }
      }

      const result = await this.executeTask(task, permissionMode);
      this.results.set(task.id, result);

      if (!result.success && !continueOnError) {
        throw new Error(`Task ${task.id} failed: ${result.error?.message}`);
      }
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: AgentTask,
    permissionMode: PermissionMode
  ): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Build the prompt
      let prompt = task.description;

      // If a specific agent type is requested, prepend delegation instruction
      if (task.agentType) {
        prompt = `Use the ${task.agentType} subagent to: ${task.description}`;
      }

      // Execute the query
      const result = await this.agentSDK.executeWithPermissionMode(prompt, permissionMode);

      const duration = Date.now() - startTime;

      return {
        taskId: task.id,
        success: result.stats.errorCount === 0,
        output: result.messages,
        stats: {
          ...result.stats,
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        stats: {
          toolCalls: 0,
          errorCount: 1,
          duration,
        },
      };
    }
  }

  /**
   * Topological sort for dependency-based execution
   */
  private topologicalSort(): AgentTask[] {
    const visited = new Set<string>();
    const sorted: AgentTask[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;

      const task = this.tasks.get(taskId);
      if (!task) return;

      visited.add(taskId);

      // Visit dependencies first
      if (task.dependencies) {
        task.dependencies.forEach(depId => visit(depId));
      }

      sorted.push(task);
    };

    // Visit all tasks
    this.tasks.forEach((_, taskId) => visit(taskId));

    return sorted;
  }

  /**
   * Get results for a specific task
   */
  getResult(taskId: string): TaskResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * Get all results
   */
  getAllResults(): Map<string, TaskResult> {
    return this.results;
  }

  /**
   * Get execution summary
   */
  getSummary() {
    const total = this.results.size;
    const successful = Array.from(this.results.values()).filter(r => r.success).length;
    const failed = total - successful;

    const totalToolCalls = Array.from(this.results.values()).reduce(
      (sum, r) => sum + (r.stats?.toolCalls || 0),
      0
    );

    const totalDuration = Array.from(this.results.values()).reduce(
      (sum, r) => sum + (r.stats?.duration || 0),
      0
    );

    return {
      total,
      successful,
      failed,
      totalToolCalls,
      totalDuration,
      averageDuration: total > 0 ? totalDuration / total : 0,
    };
  }
}

/**
 * Example usage
 */
export const orchestratorExamples = {
  /**
   * Sequential task execution
   */
  async sequentialExample() {
    const orchestrator = new AgentOrchestrator({
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableSubagents: true,
    });

    orchestrator.addTasks([
      {
        id: 'analyze',
        description: 'Analyze the codebase structure',
        agentType: 'architect',
      },
      {
        id: 'review',
        description: 'Review the main application file for security issues',
        agentType: 'security-auditor',
      },
      {
        id: 'document',
        description: 'Create documentation for the analyzed architecture',
        agentType: 'documentation-writer',
      },
    ]);

    const results = await orchestrator.execute({ strategy: 'sequential' });
    console.log('Summary:', orchestrator.getSummary());

    return results;
  },

  /**
   * Parallel task execution
   */
  async parallelExample() {
    const orchestrator = new AgentOrchestrator({
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableSubagents: true,
    });

    orchestrator.addTasks([
      {
        id: 'test-1',
        description: 'Generate tests for the agent SDK manager',
        agentType: 'test-generator',
      },
      {
        id: 'test-2',
        description: 'Generate tests for the orchestrator',
        agentType: 'test-generator',
      },
      {
        id: 'test-3',
        description: 'Generate tests for the model manager',
        agentType: 'test-generator',
      },
    ]);

    const results = await orchestrator.execute({
      strategy: 'parallel',
      maxParallel: 2,
    });

    return results;
  },

  /**
   * Conditional (dependency-based) execution
   */
  async conditionalExample() {
    const orchestrator = new AgentOrchestrator({
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableSubagents: true,
    });

    orchestrator.addTasks([
      {
        id: 'architecture',
        description: 'Design the system architecture',
        agentType: 'architect',
      },
      {
        id: 'implementation',
        description: 'Implement the designed architecture',
        dependencies: ['architecture'],
      },
      {
        id: 'tests',
        description: 'Generate tests for the implementation',
        agentType: 'test-generator',
        dependencies: ['implementation'],
      },
      {
        id: 'review',
        description: 'Review the implementation and tests',
        agentType: 'code-reviewer',
        dependencies: ['implementation', 'tests'],
      },
    ]);

    const results = await orchestrator.execute({ strategy: 'conditional' });

    return results;
  },
};

export default AgentOrchestrator;
