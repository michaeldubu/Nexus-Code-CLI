/**
 * Nexus Code - Security Agent
 * Specialized agent for security analysis and vulnerability scanning
 */
import { BaseAgent, AgentConfig } from '../../core/agents/base.js';
import { Task, Result } from '../../core/types/index.js';
export declare class SecurityAgent extends BaseAgent {
    constructor(config: Omit<AgentConfig, 'role' | 'capabilities'>);
    protected initializeTools(): void;
    protected processTask(task: Task): Promise<Result<any>>;
    protected executeTool(name: string, input: any): Promise<Result<any>>;
    protected getSystemPrompt(): string;
}
//# sourceMappingURL=index.d.ts.map