/**
 * Nexus Code - Implementation Agent
 * Specialized agent for code generation and feature development
 */
import { BaseAgent, AgentConfig } from '../../core/agents/base.js';
import { Task, Result } from '../../core/types/index.js';
/**
 * Implementation Agent
 * Responsible for:
 * - Code generation
 * - Feature implementation
 * - Refactoring existing code
 * - Implementing design specifications
 * - Writing production-ready code
 */
export declare class ImplementationAgent extends BaseAgent {
    constructor(config: Omit<AgentConfig, 'role' | 'capabilities'>);
    protected initializeTools(): void;
    protected processTask(task: Task): Promise<Result<any>>;
    protected executeTool(name: string, input: any): Promise<Result<any>>;
    protected getSystemPrompt(): string;
    /**
     * Build implementation prompt
     */
    private buildImplementationPrompt;
    /**
     * Execute implementation from Claude's response
     */
    private executeImplementation;
    /**
     * Write file
     */
    private writeFile;
    /**
     * Read file
     */
    private readFile;
    /**
     * Modify file
     */
    private modifyFile;
    /**
     * Execute code
     */
    private executeCode;
    /**
     * Analyze code
     */
    private analyzeCode;
}
//# sourceMappingURL=index.d.ts.map