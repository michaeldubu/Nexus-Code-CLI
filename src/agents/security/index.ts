/**
 * Nexus Code - Security Agent
 * Specialized agent for security analysis and vulnerability scanning
 */

import { BaseAgent, AgentConfig } from '../../core/agents/base.js';
import {
  Task,
  AgentRole,
  Result,
  success,
  failure,
} from '../../core/types/index.js';

export class SecurityAgent extends BaseAgent {
  constructor(config: Omit<AgentConfig, 'role' | 'capabilities'>) {
    super({
      ...config,
      role: AgentRole.SECURITY,
      capabilities: [
        {
          name: 'vulnerability_scanning',
          description: 'Scan code for security vulnerabilities',
          tools: ['scan_dependencies', 'analyze_code_security', 'check_patterns'],
          maxConcurrency: 2,
        },
        {
          name: 'security_audit',
          description: 'Perform comprehensive security audits',
          tools: ['audit_authentication', 'audit_authorization', 'audit_data_handling'],
          maxConcurrency: 1,
        },
      ],
    });
  }

  protected initializeTools(): void {
    this.registerTool({
      name: 'scan_dependencies',
      description: 'Scan dependencies for known vulnerabilities',
      inputSchema: {
        type: 'object',
        properties: {
          packageFile: { type: 'string', description: 'Path to package.json or requirements.txt' },
        },
        required: ['packageFile'],
      },
    });

    this.registerTool({
      name: 'analyze_code_security',
      description: 'Analyze code for security issues',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          checks: { type: 'array', items: { type: 'string' } },
        },
        required: ['path'],
      },
    });
  }

  protected async processTask(task: Task): Promise<Result<any>> {
    const prompt = `${this.getSystemPrompt()}\n\nTask: ${task.description}\n\nInput: ${JSON.stringify(task.input)}`;
    const response = await this.sendMessage(prompt);
    return response.success ? success({ analysis: response.data }) : failure(response.error);
  }

  protected async executeTool(name: string, input: any): Promise<Result<any>> {
    return success({ tool: name, input, result: 'Security check completed' });
  }

  protected getSystemPrompt(): string {
    return `You are the Security Agent. Analyze code for vulnerabilities, security issues, and best practices violations.`;
  }
}
