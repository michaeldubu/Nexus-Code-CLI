/**
 * Nexus Code - Implementation Agent
 * Specialized agent for code generation and feature development
 */

import { BaseAgent, AgentConfig } from '../../core/agents/base.js';
import {
  Task,
  AgentRole,
  Result,
  success,
  failure,
  MCPTool,
} from '../../core/types/index.js';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Implementation Agent
 * Responsible for:
 * - Code generation
 * - Feature implementation
 * - Refactoring existing code
 * - Implementing design specifications
 * - Writing production-ready code
 */
export class ImplementationAgent extends BaseAgent {
  constructor(config: Omit<AgentConfig, 'role' | 'capabilities'>) {
    super({
      ...config,
      role: AgentRole.IMPLEMENTATION,
      capabilities: [
        {
          name: 'code_generation',
          description: 'Generate production-ready code in multiple languages',
          tools: ['write_file', 'read_file', 'modify_file', 'execute_code'],
          maxConcurrency: 3,
        },
        {
          name: 'refactoring',
          description: 'Refactor and optimize existing code',
          tools: ['analyze_code', 'refactor_code', 'optimize_performance'],
          maxConcurrency: 2,
        },
        {
          name: 'debugging',
          description: 'Debug and fix issues in code',
          tools: ['debug_code', 'fix_bug', 'trace_execution'],
          maxConcurrency: 2,
        },
      ],
    });
  }

  protected initializeTools(): void {
    // Tool: Write File
    this.registerTool({
      name: 'write_file',
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path',
          },
          content: {
            type: 'string',
            description: 'File content',
          },
        },
        required: ['path', 'content'],
      },
    });

    // Tool: Read File
    this.registerTool({
      name: 'read_file',
      description: 'Read content from a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path',
          },
        },
        required: ['path'],
      },
    });

    // Tool: Modify File
    this.registerTool({
      name: 'modify_file',
      description: 'Modify specific parts of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path',
          },
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['insert', 'replace', 'delete'] },
                line: { type: 'number' },
                content: { type: 'string' },
              },
            },
            description: 'List of operations to perform',
          },
        },
        required: ['path', 'operations'],
      },
    });

    // Tool: Execute Code
    this.registerTool({
      name: 'execute_code',
      description: 'Execute code and return output',
      inputSchema: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            enum: ['javascript', 'typescript', 'python', 'bash'],
            description: 'Programming language',
          },
          code: {
            type: 'string',
            description: 'Code to execute',
          },
        },
        required: ['language', 'code'],
      },
    });

    // Tool: Analyze Code
    this.registerTool({
      name: 'analyze_code',
      description: 'Analyze code structure and complexity',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File or directory path',
          },
          analysisType: {
            type: 'string',
            enum: ['complexity', 'dependencies', 'structure', 'quality'],
            description: 'Type of analysis to perform',
          },
        },
        required: ['path', 'analysisType'],
      },
    });
  }

  protected async processTask(task: Task): Promise<Result<any>> {
    try {
      // Add context
      this.addMemory({
        content: JSON.stringify({
          task: task.description,
          type: task.type,
          input: task.input,
        }),
        type: 'context',
        contributingAgents: [this.metadata.id],
        metadata: { taskId: task.id },
      });

      // Build implementation prompt
      const prompt = this.buildImplementationPrompt(task);

      // Get implementation from Claude
      const response = await this.sendMessage(prompt);

      if (!response.success) {
        return failure(response.error);
      }

      // Parse and execute implementation
      const result = await this.executeImplementation(response.data, task);

      // Store result
      this.addMemory({
        content: JSON.stringify(result),
        type: 'result',
        contributingAgents: [this.metadata.id],
        metadata: { taskId: task.id },
      });

      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }

  protected async executeTool(name: string, input: any): Promise<Result<any>> {
    try {
      switch (name) {
        case 'write_file':
          return await this.writeFile(input.path, input.content);

        case 'read_file':
          return await this.readFile(input.path);

        case 'modify_file':
          return await this.modifyFile(input.path, input.operations);

        case 'execute_code':
          return await this.executeCode(input.language, input.code);

        case 'analyze_code':
          return await this.analyzeCode(input.path, input.analysisType);

        default:
          return failure(new Error(`Unknown tool: ${name}`));
      }
    } catch (error) {
      return failure(error as Error);
    }
  }

  protected getSystemPrompt(): string {
    return `You are the Implementation Agent in the Nexus Code multi-agent system.

Your responsibilities:
1. Generate production-ready, high-quality code
2. Implement features based on design specifications
3. Refactor and optimize existing code
4. Debug and fix issues
5. Write clean, maintainable, well-documented code
6. Follow best practices and coding standards

Coding principles:
- Write clear, self-documenting code
- Add comments for complex logic
- Follow SOLID principles
- Use appropriate design patterns
- Handle errors gracefully
- Write testable code
- Optimize for readability first, then performance
- Never use placeholders or TODOs in production code
- Always provide complete, working implementations

Guidelines:
- Always understand the full context before coding
- Ask for clarification if requirements are unclear
- Consider edge cases and error handling
- Write code that is maintainable and scalable
- Use TypeScript for type safety when possible
- Follow the existing codebase style and patterns
- Provide clear variable and function names
- Break complex functions into smaller, focused functions

Output Format:
- Provide complete file contents (not diffs)
- Include all necessary imports and dependencies
- Add inline comments for complex logic
- Structure code logically with proper separation of concerns
- Return structured data with file paths and contents`;
  }

  /**
   * Build implementation prompt
   */
  private buildImplementationPrompt(task: Task): string {
    const systemPrompt = this.getSystemPrompt();
    const recentMemory = this.getRecentMemory(3);
    const memoryContext = recentMemory.length > 0
      ? `\n\nRecent context:\n${recentMemory.map(m => m.content).join('\n')}`
      : '';

    let prompt = `${systemPrompt}\n\n`;
    prompt += `Task: ${task.description}\n\n`;

    if (task.input.specification) {
      prompt += `Specification:\n${JSON.stringify(task.input.specification, null, 2)}\n\n`;
    }

    if (task.input.existingCode) {
      prompt += `Existing code to refactor/modify:\n\`\`\`\n${task.input.existingCode}\n\`\`\`\n\n`;
    }

    if (task.input.requirements) {
      prompt += `Requirements:\n`;
      task.input.requirements.forEach((req: string, i: number) => {
        prompt += `${i + 1}. ${req}\n`;
      });
      prompt += `\n`;
    }

    prompt += `Provide a complete implementation that:\n`;
    prompt += `1. Meets all requirements\n`;
    prompt += `2. Is production-ready with no placeholders\n`;
    prompt += `3. Includes proper error handling\n`;
    prompt += `4. Is well-documented\n`;
    prompt += `5. Follows best practices\n`;

    prompt += memoryContext;

    return prompt;
  }

  /**
   * Execute implementation from Claude's response
   */
  private async executeImplementation(response: string, task: Task): Promise<any> {
    // Check if response contains tool calls
    try {
      const parsed = JSON.parse(response);
      if (parsed.type === 'tool_use') {
        return { type: 'tool_use', toolCalls: parsed.toolCalls };
      }
    } catch (e) {
      // Not tool use, treat as direct response
    }

    return {
      type: 'implementation',
      code: response,
      taskId: task.id,
      timestamp: new Date(),
    };
  }

  /**
   * Write file
   */
  private async writeFile(path: string, content: string): Promise<Result<any>> {
    try {
      await fs.writeFile(path, content, 'utf-8');
      this.emit('file:written', { path });
      return success({ path, size: content.length });
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Read file
   */
  private async readFile(path: string): Promise<Result<any>> {
    try {
      const content = await fs.readFile(path, 'utf-8');
      return success({ path, content, size: content.length });
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Modify file
   */
  private async modifyFile(
    path: string,
    operations: Array<{ type: string; line: number; content: string }>,
  ): Promise<Result<any>> {
    try {
      // Read existing content
      const content = await fs.readFile(path, 'utf-8');
      const lines = content.split('\n');

      // Apply operations
      for (const op of operations) {
        switch (op.type) {
          case 'insert':
            lines.splice(op.line, 0, op.content);
            break;
          case 'replace':
            lines[op.line] = op.content;
            break;
          case 'delete':
            lines.splice(op.line, 1);
            break;
        }
      }

      // Write back
      const newContent = lines.join('\n');
      await fs.writeFile(path, newContent, 'utf-8');

      this.emit('file:modified', { path, operations: operations.length });
      return success({ path, operationsApplied: operations.length });
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Execute code
   */
  private async executeCode(language: string, code: string): Promise<Result<any>> {
    try {
      let command: string;

      switch (language) {
        case 'javascript':
        case 'typescript':
          command = `node -e "${code.replace(/"/g, '\\"')}"`;
          break;
        case 'python':
          command = `python3 -c "${code.replace(/"/g, '\\"')}"`;
          break;
        case 'bash':
          command = code;
          break;
        default:
          return failure(new Error(`Unsupported language: ${language}`));
      }

      const { stdout, stderr } = await execAsync(command);
      
      this.emit('code:executed', { language });
      return success({ stdout, stderr, language });
    } catch (error: any) {
      return failure(new Error(error.stderr || error.message));
    }
  }

  /**
   * Analyze code
   */
  private async analyzeCode(path: string, analysisType: string): Promise<Result<any>> {
    try {
      const content = await fs.readFile(path, 'utf-8');
      
      // Basic analysis
      const analysis = {
        path,
        type: analysisType,
        lines: content.split('\n').length,
        size: content.length,
        timestamp: new Date(),
      };

      return success(analysis);
    } catch (error) {
      return failure(error as Error);
    }
  }
}
