/**
 * Claude Agent SDK Manager
 *
 * Comprehensive implementation of the Claude Agent SDK with all key features:
 * - Custom tools with Zod schemas
 * - MCP server integration
 * - Subagents (programmatic definition)
 * - Permission system
 * - Session management
 * - Hooks for monitoring
 */

import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type {
  QueryOptions,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
  SDKSystemMessage,
  AgentDefinition,
  PermissionMode,
} from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/**
 * Agent SDK Configuration
 */
export interface AgentSDKConfig {
  apiKey?: string;
  model?: string;
  cwd?: string;
  permissionMode?: PermissionMode;
  enableCustomTools?: boolean;
  enableSubagents?: boolean;
  enableHooks?: boolean;
  onToolCall?: (toolName: string) => void;
  onSessionUpdate?: (sessionId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Custom Tools Example - Weather Tool
 */
const weatherToolServer = createSdkMcpServer({
  name: 'weather-tools',
  version: '1.0.0',
  tools: [
    tool(
      'get_weather',
      'Get current weather for a location',
      {
        location: z.string().describe('City name or location'),
        units: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature units'),
      },
      async (args) => {
        try {
          // Simulated weather data (in production, call a real API)
          const weatherData = {
            location: args.location,
            temperature: args.units === 'celsius' ? 22 : 72,
            conditions: 'Partly cloudy',
            humidity: 65,
            units: args.units,
          };

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(weatherData, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error fetching weather: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }
    ),
    tool(
      'calculate',
      'Perform mathematical calculations',
      {
        expression: z.string().describe('Mathematical expression to evaluate'),
        precision: z.number().min(0).max(10).default(2).describe('Decimal precision'),
      },
      async (args) => {
        try {
          // Safe evaluation (in production, use a proper math parser)
          const result = eval(args.expression);
          const rounded = Number(result.toFixed(args.precision));

          return {
            content: [
              {
                type: 'text' as const,
                text: `Result: ${rounded}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error evaluating expression: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }
    ),
  ],
});

/**
 * Subagent Definitions
 *
 * These are specialized agents for different tasks
 */
const subagents: Record<string, AgentDefinition> = {
  'code-reviewer': {
    description: 'Expert code reviewer for analyzing code quality, security, and best practices',
    prompt: `You are an expert code reviewer with deep knowledge of software engineering best practices.
Your role is to:
- Analyze code for bugs, security issues, and performance problems
- Suggest improvements and refactoring opportunities
- Check for adherence to coding standards
- Provide constructive feedback with specific examples

Always be thorough but respectful in your reviews.`,
    tools: ['Read', 'Grep', 'Glob'],
    model: 'sonnet',
  },
  'test-generator': {
    description: 'Generates comprehensive unit and integration tests for code',
    prompt: `You are a testing expert who creates comprehensive test suites.
Your role is to:
- Write thorough unit tests with good coverage
- Create integration tests for complex workflows
- Use appropriate testing frameworks and patterns
- Include edge cases and error scenarios

Focus on writing maintainable and readable tests.`,
    tools: ['Read', 'Write', 'Edit', 'Grep'],
    model: 'sonnet',
  },
  'documentation-writer': {
    description: 'Creates clear, comprehensive documentation for code and systems',
    prompt: `You are a technical writer who excels at creating clear documentation.
Your role is to:
- Write clear, concise documentation
- Create helpful code examples
- Explain complex concepts simply
- Follow documentation best practices

Make documentation accessible to developers of all skill levels.`,
    tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
    model: 'sonnet',
  },
  'architect': {
    description: 'System architect for designing software architecture and making high-level decisions',
    prompt: `You are a senior software architect with expertise in system design.
Your role is to:
- Design scalable and maintainable software architectures
- Make informed technology and pattern choices
- Consider performance, security, and maintainability
- Create architectural diagrams and documentation

Focus on long-term sustainability and best practices.`,
    tools: ['Read', 'Grep', 'Glob', 'Write'],
    model: 'opus',
  },
  'security-auditor': {
    description: 'Security expert for identifying vulnerabilities and security issues',
    prompt: `You are a security expert focused on finding and fixing vulnerabilities.
Your role is to:
- Identify security vulnerabilities (OWASP Top 10, etc.)
- Suggest secure coding practices
- Review authentication and authorization logic
- Check for data leaks and injection attacks

Be thorough and specific in security recommendations.`,
    tools: ['Read', 'Grep', 'Glob'],
    model: 'sonnet',
  },
};

/**
 * Main Agent SDK Manager Class
 */
export class AgentSDKManager {
  private config: AgentSDKConfig;
  private sessionId?: string;
  private toolCallCount: number = 0;
  private errorCount: number = 0;

  constructor(config: AgentSDKConfig = {}) {
    this.config = {
      model: 'claude-sonnet-4-5-20250929',
      cwd: process.cwd(),
      permissionMode: 'default',
      enableCustomTools: true,
      enableSubagents: true,
      enableHooks: true,
      ...config,
    };
  }

  /**
   * Execute a query using the Agent SDK
   *
   * This demonstrates the streaming pattern with async generators
   */
  async executeQuery(userPrompt: string, options?: Partial<QueryOptions>) {
    const messages: Array<SDKUserMessage | SDKAssistantMessage | SDKResultMessage | SDKSystemMessage> = [];
    this.toolCallCount = 0;
    this.errorCount = 0;

    // Create async generator for streaming input
    async function* generateMessages() {
      yield {
        type: 'user' as const,
        message: {
          role: 'user' as const,
          content: userPrompt,
        },
      };
    }

    // Build query options
    const queryOptions: QueryOptions = {
      model: this.config.model,
      cwd: this.config.cwd,
      permissionMode: this.config.permissionMode,

      // Custom MCP servers
      ...(this.config.enableCustomTools && {
        mcpServers: {
          'weather-tools': weatherToolServer,
        },
        allowedTools: [
          'Read',
          'Write',
          'Edit',
          'Grep',
          'Glob',
          'Bash',
          'Task',
          'mcp__weather-tools__get_weather',
          'mcp__weather-tools__calculate',
        ],
      }),

      // Subagents
      ...(this.config.enableSubagents && {
        agents: subagents,
      }),

      // Permission handler
      canUseTool: async (toolName, input) => {
        if (this.config.onToolCall) {
          this.config.onToolCall(toolName);
        }

        // Auto-approve safe tools
        const safePrefixes = ['Read', 'Grep', 'Glob', 'mcp__'];
        if (safePrefixes.some(prefix => toolName.startsWith(prefix))) {
          return {
            behavior: 'allow' as const,
            updatedInput: input,
          };
        }

        // For other tools, you could implement custom logic
        return {
          behavior: 'allow' as const,
          updatedInput: input,
        };
      },

      // Hooks for monitoring
      ...(this.config.enableHooks && {
        hooks: {
          preToolUse: async (ctx, toolId) => {
            this.toolCallCount++;
          },
          postToolUse: async (ctx, toolId) => {
            // Tool completed
          },
          userPromptSubmit: async (ctx) => {
            // User prompt submitted
          },
          sessionStart: async (ctx) => {
            // Session started
          },
          sessionEnd: async (ctx) => {
            // Session ended - stats available
          },
        },
      }),

      // Resume from previous session if available
      ...(this.sessionId && {
        resume: this.sessionId,
      }),

      // Merge additional options
      ...options,
    };

    try {
      // Execute query with streaming
      for await (const message of query({
        prompt: generateMessages(),
        options: queryOptions,
      })) {
        messages.push(message);

        // Handle different message types
        switch (message.type) {
          case 'system':
            // Capture session ID from system message
            if (message.sessionId) {
              this.sessionId = message.sessionId;
              if (this.config.onSessionUpdate) {
                this.config.onSessionUpdate(message.sessionId);
              }
            }
            break;

          case 'assistant':
            // Assistant message processed
            break;

          case 'result':
            // Final result received
            break;

          case 'error':
            this.errorCount++;
            if (this.config.onError && message.error instanceof Error) {
              this.config.onError(message.error);
            }
            break;
        }
      }
    } catch (error) {
      if (this.config.onError && error instanceof Error) {
        this.config.onError(error);
      }
      throw error;
    }

    return {
      messages,
      sessionId: this.sessionId,
      stats: {
        toolCalls: this.toolCallCount,
        errorCount: this.errorCount,
        messageCount: messages.length,
      },
    };
  }

  /**
   * Resume a previous session
   */
  async resumeSession(sessionId: string, userPrompt: string) {
    this.sessionId = sessionId;
    return this.executeQuery(userPrompt);
  }

  /**
   * Fork a session to explore different paths
   */
  async forkSession(sessionId: string, userPrompt: string) {
    const originalSessionId = this.sessionId;
    this.sessionId = sessionId;

    const result = await this.executeQuery(userPrompt, {
      forkSession: true,
    });

    // Restore original session ID
    this.sessionId = originalSessionId;

    return result;
  }

  /**
   * Execute with different permission modes
   */
  async executeWithPermissionMode(userPrompt: string, mode: PermissionMode) {
    const originalMode = this.config.permissionMode;
    this.config.permissionMode = mode;

    const result = await this.executeQuery(userPrompt);

    // Restore original mode
    this.config.permissionMode = originalMode;

    return result;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Clear current session
   */
  clearSession(): void {
    this.sessionId = undefined;
  }

  /**
   * Get statistics from last query
   */
  getStats() {
    return {
      toolCalls: this.toolCallCount,
      errorCount: this.errorCount,
      sessionId: this.sessionId,
    };
  }
}

/**
 * Example usage demonstrations
 */
export const examples = {
  /**
   * Basic query example
   */
  async basicQuery() {
    const manager = new AgentSDKManager({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await manager.executeQuery(
      'What is the weather like in San Francisco?'
    );

    return result;
  },

  /**
   * Code review with subagent
   */
  async codeReviewExample() {
    const manager = new AgentSDKManager({
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableSubagents: true,
    });

    const result = await manager.executeQuery(
      'Please review the code in src/core/agents/agent-sdk-manager.ts and provide feedback'
    );

    return result;
  },

  /**
   * Custom tool usage
   */
  async customToolExample() {
    const manager = new AgentSDKManager({
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableCustomTools: true,
    });

    const result = await manager.executeQuery(
      'Calculate the result of (123 + 456) * 2 using the calculator tool'
    );

    return result;
  },

  /**
   * Session management example
   */
  async sessionExample() {
    const manager = new AgentSDKManager({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // First query
    const result1 = await manager.executeQuery('Hello! My name is Michael.');
    console.log('Session ID:', manager.getSessionId());

    // Continue session
    const result2 = await manager.executeQuery('What is my name?');

    // Fork session to explore different path
    const sessionId = manager.getSessionId()!;
    const forkedResult = await manager.forkSession(
      sessionId,
      'Tell me a joke instead'
    );

    return { result1, result2, forkedResult };
  },

  /**
   * Permission mode example
   */
  async permissionExample() {
    const manager = new AgentSDKManager({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Execute with different permission modes
    const defaultResult = await manager.executeWithPermissionMode(
      'Create a test file',
      'default'
    );

    const autoApproveResult = await manager.executeWithPermissionMode(
      'Create a test file',
      'acceptEdits'
    );

    return { defaultResult, autoApproveResult };
  },
};

export default AgentSDKManager;
