/**
 * Multi-Model Conversation Engine
 * Real collaborative AI - parallel & sequential modes 🔥
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import chalk from 'chalk';
import {
  TeamConfig,
  ParticipantConfig,
  ConversationMessage,
  ModelProvider,
} from './types.js';
import { RateLimitManager } from './rate-limit.js';
import { TeamConfigManager } from './team-config.js';
import { FileTools } from '../core/tools/file-tools.js';

export class ConversationEngine {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private rateLimiter: RateLimitManager;
  private teamConfig: TeamConfigManager;
  private config: TeamConfig;
  private messages: ConversationMessage[] = [];
  private fileTools?: FileTools;

  constructor(
    config: TeamConfig,
    anthropicKey: string,
    openaiKey?: string,
    fileTools?: FileTools
  ) {
    this.config = config;
    this.anthropic = new Anthropic({ apiKey: anthropicKey });
    this.openai = new OpenAI({ apiKey: openaiKey });
    this.rateLimiter = new RateLimitManager();
    this.teamConfig = new TeamConfigManager();
    this.fileTools = fileTools;
  }

  /**
   * Process user message with the team
   */
  async processMessage(userMessage: string, forceParallel: boolean = false): Promise<void> {
    // Add user message to history
    this.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    console.log(chalk.gray('\n' + '─'.repeat(80) + '\n'));

    // Easter egg: /parallel for chaos mode 😂
    if (forceParallel || this.config.mode === 'parallel') {
      await this.processParallel();
    } else {
      // Default: Round-robin (sequential)
      await this.processSequential();
    }

    console.log(chalk.gray('\n' + '─'.repeat(80)));
  }

  /**
   * Parallel mode: All models respond simultaneously
   */
  private async processParallel(): Promise<void> {
    console.log(chalk.magenta('🔥 Parallel Mode: All models responding...\n'));

    const promises = this.config.participants.map((participant) =>
      this.getParticipantResponse(participant)
    );

    // Wait for all to complete
    const responses = await Promise.all(promises);

    // Add all responses to history
    for (const response of responses) {
      if (response) {
        this.messages.push(response);
      }
    }
  }

  /**
   * Sequential mode: Round-robin (models respond in order selected)
   */
  private async processSequential(): Promise<void> {
    console.log(
      chalk.cyan('⚡ Round-Robin: Models responding in order...\n')
    );

    for (const participant of this.config.participants) {
      const response = await this.getParticipantResponse(participant);

      if (response) {
        this.messages.push(response);
        console.log(); // Spacing between models
      }
    }
  }

  /**
   * Get response from a single participant
   */
  private async getParticipantResponse(
    participant: ParticipantConfig
  ): Promise<ConversationMessage | null> {
    try {
      // Check rate limits
      const delay = this.rateLimiter.getDelay(
        participant.provider,
        participant.model
      );

      if (delay > 0) {
        const formattedDelay = this.rateLimiter.formatDelay(delay);
        console.log(
          chalk.yellow(
            `⏳ ${participant.name} rate limited - waiting ${formattedDelay}...`
          )
        );
        await this.sleep(delay);
      }

      // Prune context if needed
      const prunedMessages = this.pruneContext(participant.provider);

      // Get response based on provider
      if (participant.provider === 'anthropic') {
        return await this.getAnthropicResponse(participant, prunedMessages);
      } else {
        return await this.getOpenAIResponse(participant, prunedMessages);
      }
    } catch (error: any) {
      // Handle rate limit errors
      if (
        error?.status === 429 ||
        error?.message?.toLowerCase()?.includes('rate limit')
      ) {
        const backoffTime = this.rateLimiter.handleRateLimitError(
          participant.provider,
          participant.model,
          error
        );
        const formattedTime = this.rateLimiter.formatDelay(backoffTime);

        console.log(
          chalk.red(
            `❌ ${participant.name} hit rate limit! Backing off for ${formattedTime}...`
          )
        );

        // Retry after backoff
        await this.sleep(backoffTime);
        return await this.getParticipantResponse(participant);
      }

      console.log(
        chalk.red(`❌ ${participant.name} error: ${error.message}`)
      );
      return null;
    }
  }

  /**
   * Get response from Anthropic model
   */
  private async getAnthropicResponse(
    participant: ParticipantConfig,
    messages: ConversationMessage[]
  ): Promise<ConversationMessage> {
    console.log(chalk.cyan(`🤖 ${participant.name}: `));

    // Build messages for Anthropic
    const anthropicMessages: Anthropic.Messages.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        anthropicMessages.push({
          role: 'user',
          content: msg.content,
        });
      } else {
        // Include attribution in assistant messages
        const content = msg.attribution
          ? `[${msg.attribution}]: ${msg.content}`
          : msg.content;

        anthropicMessages.push({
          role: 'assistant',
          content,
        });
      }
    }

    // Generate system prompt
    const systemPrompt = this.teamConfig.generateSystemPrompt(
      participant,
      this.config.participants
    );

    // Build tools if FileTools available
    const tools = this.fileTools ? this.buildAnthropicTools() : undefined;

    // Stream response with tools
    const stream = await this.anthropic.messages.stream({
      model: participant.model,
      max_tokens: participant.maxTokens || 64000,
      temperature: participant.temperature || 1.0,
      system: systemPrompt,
      messages: anthropicMessages,
      tools,
    });

    let fullResponse = '';
    const toolUses: any[] = [];
    let currentToolUse: any = null;

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_start') {
        if (chunk.content_block.type === 'tool_use') {
          currentToolUse = {
            id: chunk.content_block.id,
            name: chunk.content_block.name,
            input: '',
          };
        }
      } else if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          process.stdout.write(text);
          fullResponse += text;
        } else if (chunk.delta.type === 'input_json_delta' && currentToolUse) {
          currentToolUse.input += chunk.delta.partial_json;
        }
      } else if (chunk.type === 'content_block_stop' && currentToolUse) {
        currentToolUse.input = JSON.parse(currentToolUse.input);
        toolUses.push(currentToolUse);
        currentToolUse = null;
      }
    }

    // If tools were used, execute them and continue conversation
    if (toolUses.length > 0) {
      console.log(); // New line before tool execution

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolUse of toolUses) {
        const result = await this.executeAnthropicTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.success ? (result.output || 'Success') : `Error: ${result.error}`,
        });
      }

      // Continue conversation with tool results
      anthropicMessages.push({
        role: 'assistant',
        content: toolUses.map((tu) => ({
          type: 'tool_use' as const,
          id: tu.id,
          name: tu.name,
          input: tu.input,
        })),
      });

      anthropicMessages.push({
        role: 'user',
        content: toolResults,
      });

      // Get final response after tool execution
      const finalStream = await this.anthropic.messages.stream({
        model: participant.model,
        max_tokens: participant.maxTokens || 64000,
        temperature: participant.temperature || 1.0,
        system: systemPrompt,
        messages: anthropicMessages,
        tools,
      });

      for await (const chunk of finalStream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const text = chunk.delta.text;
          process.stdout.write(text);
          fullResponse += text;
        }
      }
    }

    console.log(); // New line after response

    // Mark successful request
    this.rateLimiter.markSuccess(participant.provider, participant.model);

    return {
      role: 'assistant',
      content: fullResponse,
      attribution: participant.name,
      timestamp: new Date().toISOString(),
      model: participant.model,
    };
  }

  /**
   * Get response from OpenAI model
   */
  private async getOpenAIResponse(
    participant: ParticipantConfig,
    messages: ConversationMessage[]
  ): Promise<ConversationMessage> {
    console.log(chalk.green(`🤖 ${participant.name}: `));

    // Build input for Responses API
    const input: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        input.push({
          role: 'user',
          content: [{ type: 'input_text', text: msg.content }],
        });
      } else {
        // Include attribution
        const content = msg.attribution
          ? `[${msg.attribution}]: ${msg.content}`
          : msg.content;

        input.push({
          role: 'assistant',
          content,
        });
      }
    }

    // Generate system prompt
    const instructions = this.teamConfig.generateSystemPrompt(
      participant,
      this.config.participants
    );

    // Use Responses API
    const params: any = {
      model: participant.model,
      input,
      instructions,
      temperature: participant.temperature ?? 0.9,
      max_output_tokens: participant.maxTokens ?? 16384,
      stream: true,
    };

    // Add reasoning for o-series models
    if (participant.model.startsWith('o')) {
      params.reasoning = participant.reasoning || { effort: 'medium' };
    }

    const stream: any = await this.openai.responses.create(params);

    let fullResponse = '';

    for await (const event of stream as any) {
      if (event.type === 'response.output_text.delta') {
        const text = event.delta || '';
        process.stdout.write(text);
        fullResponse += text;
      }
    }

    console.log(); // New line after response

    // Mark successful request
    this.rateLimiter.markSuccess(participant.provider, participant.model);

    return {
      role: 'assistant',
      content: fullResponse,
      attribution: participant.name,
      timestamp: new Date().toISOString(),
      model: participant.model,
    };
  }

  /**
   * Build tool schemas for Anthropic API
   */
  private buildAnthropicTools(): Anthropic.Messages.Tool[] {
    return [
      {
        name: 'read_file',
        description: 'Read contents of a file with optional line offset and limit',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to the file to read' },
            offset: { type: 'number', description: 'Line number to start reading from (optional)' },
            limit: { type: 'number', description: 'Number of lines to read (optional)' },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file (creates or overwrites)',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to the file to write' },
            content: { type: 'string', description: 'Content to write to the file' },
          },
          required: ['file_path', 'content'],
        },
      },
      {
        name: 'edit_file',
        description: 'Edit a file by finding and replacing text',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to the file to edit' },
            old_string: { type: 'string', description: 'Text to find in the file' },
            new_string: { type: 'string', description: 'Text to replace it with' },
            replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
          },
          required: ['file_path', 'old_string', 'new_string'],
        },
      },
      {
        name: 'glob_search',
        description: 'Find files matching a glob pattern',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.js")' },
            path: { type: 'string', description: 'Directory to search in (optional)' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'grep_search',
        description: 'Search file contents using regex pattern',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Regex pattern to search for' },
            path: { type: 'string', description: 'Directory or file to search in (optional)' },
            glob: { type: 'string', description: 'File pattern to filter (e.g., "*.ts")' },
            case_insensitive: { type: 'boolean', description: 'Case insensitive search' },
            show_line_numbers: { type: 'boolean', description: 'Show line numbers in output' },
            files_only: { type: 'boolean', description: 'Only show file names, not matches' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'bash_command',
        description: 'Execute a bash command (requires approval)',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Shell command to execute' },
            timeout: { type: 'number', description: 'Timeout in milliseconds (optional)' },
          },
          required: ['command'],
        },
      },
    ];
  }

  /**
   * Execute Anthropic tool
   */
  private async executeAnthropicTool(name: string, input: any): Promise<any> {
    if (!this.fileTools) {
      return { success: false, error: 'FileTools not available' };
    }

    try {
      switch (name) {
        case 'read_file':
          return await this.fileTools.read(input.file_path, input.offset, input.limit);

        case 'write_file':
          return await this.fileTools.write(input.file_path, input.content);

        case 'edit_file':
          return await this.fileTools.edit(
            input.file_path,
            input.old_string,
            input.new_string,
            input.replace_all || false
          );

        case 'glob_search':
          return await this.fileTools.globFiles(input.pattern, input.path);

        case 'grep_search':
          return await this.fileTools.grep(input.pattern, {
            path: input.path,
            glob: input.glob,
            caseInsensitive: input.case_insensitive,
            showLineNumbers: input.show_line_numbers,
            filesOnly: input.files_only,
          });

        case 'bash_command':
          return await this.fileTools.bash(input.command, {
            timeout: input.timeout,
          });

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Prune context to stay within limits
   * NO ARTIFICIAL LIMITS - only prune when approaching provider limits
   */
  private pruneContext(provider: ModelProvider): ConversationMessage[] {
    const limit =
      provider === 'anthropic'
        ? this.config.contextManagement.claudeLimit
        : this.config.contextManagement.gptLimit;

    // Rough token estimation: ~4 chars per token
    const estimatedTokens = this.messages.reduce(
      (sum, msg) => sum + msg.content.length / 4,
      0
    );

    // Only prune if approaching limit (90% threshold)
    if (estimatedTokens < limit * 0.9) {
      return this.messages;
    }

    // Gradually remove oldest messages
    const pruneAmount = this.config.contextManagement.pruneAmount;
    const prunedMessages = this.messages.slice(pruneAmount);

    console.log(
      chalk.yellow(
        `⚠️  Context approaching limit - removed ${pruneAmount} oldest messages`
      )
    );

    // Update the main messages array
    this.messages = prunedMessages;

    return prunedMessages;
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationMessage[] {
    return this.messages;
  }

  /**
   * Load conversation history
   */
  loadHistory(messages: ConversationMessage[]): void {
    this.messages = messages;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
