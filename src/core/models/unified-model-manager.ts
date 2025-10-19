/**
 * Unified Multi-Model Manager
 * Supports both OpenAI Responses API and Anthropic Messages API
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type ModelProvider = 'anthropic' | 'openai';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  supportsThinking?: boolean;
  supportsReasoning?: boolean;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  maxTokens: number;
  contextWindow: number;
}

export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // Anthropic Models
  'claude-sonnet-4-5-20250929': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    supportsThinking: true,
    maxTokens: 8192,
    contextWindow: 200000,
  },
  'claude-haiku-4-5-20250514': {
    id: 'claude-haiku-4-5-20250514',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    supportsThinking: false,
    maxTokens: 4096,
    contextWindow: 200000,
  },

  // OpenAI Models (Responses API)
  'gpt-5': {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'high',
    maxTokens: 16384,
    contextWindow: 128000,
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'low',
    maxTokens: 16384,
    contextWindow: 128000,
  },
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    supportsReasoning: false,
    maxTokens: 4096,
    contextWindow: 128000,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    supportsReasoning: false,
    maxTokens: 4096,
    contextWindow: 128000,
  },
  'o3': {
    id: 'o3',
    name: 'O3 (Reasoning)',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'high',
    maxTokens: 100000,
    contextWindow: 200000,
  },
  'o4-mini': {
    id: 'o4-mini',
    name: 'O4 Mini (Reasoning)',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'medium',
    maxTokens: 65536,
    contextWindow: 200000,
  },
};

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: string;
  function?: {
    name: string;
    arguments: string;
  };
}

export interface StreamChunk {
  type: 'text' | 'thinking' | 'reasoning' | 'tool_call' | 'done';
  content?: string;
  toolCall?: ToolCall;
}

export interface ModelResponse {
  content: string;
  thinking?: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
  };
  responseId?: string;
}

export class UnifiedModelManager {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private currentModel: string;
  private thinkingEnabled: boolean = true;
  private reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' = 'high';
  private lastResponseId?: string;

  constructor(
    anthropicKey: string,
    openaiKey: string,
    defaultModel: string = 'claude-sonnet-4-5-20250929'
  ) {
    this.anthropic = new Anthropic({ apiKey: anthropicKey });
    this.openai = new OpenAI({ apiKey: openaiKey });
    this.currentModel = defaultModel;
  }

  /**
   * Get current model
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Set current model
   */
  setModel(modelId: string): void {
    if (!AVAILABLE_MODELS[modelId]) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    this.currentModel = modelId;
    this.lastResponseId = undefined; // Reset conversation chain
  }

  /**
   * Toggle thinking mode (for Claude)
   */
  toggleThinking(): boolean {
    this.thinkingEnabled = !this.thinkingEnabled;
    return this.thinkingEnabled;
  }

  /**
   * Get thinking state
   */
  isThinkingEnabled(): boolean {
    return this.thinkingEnabled;
  }

  /**
   * Toggle reasoning effort (for OpenAI reasoning models)
   */
  toggleReasoning(): 'minimal' | 'low' | 'medium' | 'high' {
    const levels: Array<'minimal' | 'low' | 'medium' | 'high'> = ['minimal', 'low', 'medium', 'high'];
    const currentIndex = levels.indexOf(this.reasoningEffort);
    this.reasoningEffort = levels[(currentIndex + 1) % levels.length];
    return this.reasoningEffort;
  }

  /**
   * Get reasoning effort
   */
  getReasoningEffort(): 'minimal' | 'low' | 'medium' | 'high' {
    return this.reasoningEffort;
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelId?: string): ModelConfig {
    const id = modelId || this.currentModel;
    return AVAILABLE_MODELS[id];
  }

  /**
   * List all available models
   */
  listModels(): ModelConfig[] {
    return Object.values(AVAILABLE_MODELS);
  }

  /**
   * Send message (non-streaming)
   */
  async sendMessage(
    messages: Message[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<ModelResponse> {
    const config = this.getModelConfig();

    if (config.provider === 'anthropic') {
      return this.sendAnthropicMessage(messages, options);
    } else {
      return this.sendOpenAIMessage(messages, options);
    }
  }

  /**
   * Send message to Anthropic (Claude)
   */
  private async sendAnthropicMessage(
    messages: Message[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<ModelResponse> {
    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;

    // When thinking is enabled, temperature MUST be 1.0
    const useThinking = this.getModelConfig().supportsThinking && this.thinkingEnabled;
    const temperature = useThinking ? 1.0 : (options.temperature || 0.7);

    const response = await this.anthropic.messages.create({
      model: this.currentModel,
      max_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature,
      system: systemPrompt,
      messages: formattedMessages,
      // Enable extended thinking if supported and enabled
      ...(useThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: 10000,
        },
      }),
    });

    const textContent = response.content.find(c => c.type === 'text');
    const thinkingContent = response.content.find(c => c.type === 'thinking');

    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      thinking: thinkingContent?.type === 'thinking' ? thinkingContent.thinking : undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      responseId: response.id,
    };
  }

  /**
   * Send message to OpenAI (Responses API)
   */
  private async sendOpenAIMessage(
    messages: Message[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<ModelResponse> {
    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');

    // Build input array for Responses API
    const input: any[] = [];

    // Add system/developer message if present
    if (systemPrompt) {
      input.push({
        role: 'developer',
        content: systemPrompt,
      });
    }

    // Add user messages
    for (const msg of userMessages) {
      if (msg.role === 'user') {
        input.push({
          role: 'user',
          content: [{ type: 'input_text', text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        input.push({
          role: 'assistant',
          content: [{ type: 'output_text', text: msg.content }],
        });
      }
    }

    const response = await this.openai.responses.create({
      model: this.currentModel,
      input: input.length === 1 ? input[0].content[0].text : input,
      max_output_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: options.temperature || 0.7,
      // Use previous_response_id for context chaining
      ...(this.lastResponseId && { previous_response_id: this.lastResponseId }),
      // Enable reasoning for supported models
      ...(this.getModelConfig().supportsReasoning && {
        reasoning: {
          effort: this.reasoningEffort,
          summary: 'concise',
        },
      }),
    } as any);

    this.lastResponseId = response.id;

    // Parse output
    let content = '';
    let reasoning = '';

    for (const item of response.output) {
      if (item.type === 'message') {
        for (const contentItem of (item as any).content) {
          if (contentItem.type === 'output_text') {
            content += contentItem.text;
          }
        }
      } else if (item.type === 'reasoning') {
        for (const summary of (item as any).summary) {
          if (summary.type === 'summary_text') {
            reasoning += summary.text + ' ';
          }
        }
      }
    }

    return {
      content: content.trim(),
      reasoning: reasoning.trim() || undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        reasoningTokens: response.usage.output_tokens_details?.reasoning_tokens,
      },
      responseId: response.id,
    };
  }

  /**
   * Stream message
   */
  async *streamMessage(
    messages: Message[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): AsyncGenerator<StreamChunk> {
    const config = this.getModelConfig();

    if (config.provider === 'anthropic') {
      yield* this.streamAnthropicMessage(messages, options);
    } else {
      yield* this.streamOpenAIMessage(messages, options);
    }
  }

  /**
   * Stream from Anthropic
   */
  private async *streamAnthropicMessage(
    messages: Message[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): AsyncGenerator<StreamChunk> {
    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;

    // When thinking is enabled, temperature MUST be 1.0
    const useThinking = this.getModelConfig().supportsThinking && this.thinkingEnabled;
    const temperature = useThinking ? 1.0 : (options.temperature || 0.7);

    const stream = await this.anthropic.messages.stream({
      model: this.currentModel,
      max_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature,
      system: systemPrompt,
      messages: formattedMessages,
      ...(useThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: 10000,
        },
      }),
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          yield {
            type: 'text',
            content: chunk.delta.text,
          };
        } else if (chunk.delta.type === 'thinking_delta') {
          yield {
            type: 'thinking',
            content: chunk.delta.thinking,
          };
        }
      } else if (chunk.type === 'message_stop') {
        yield { type: 'done' };
      }
    }
  }

  /**
   * Stream from OpenAI (Responses API)
   */
  private async *streamOpenAIMessage(
    messages: Message[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): AsyncGenerator<StreamChunk> {
    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');

    const input: any[] = [];
    if (systemPrompt) {
      input.push({ role: 'developer', content: systemPrompt });
    }

    for (const msg of userMessages) {
      if (msg.role === 'user') {
        input.push({
          role: 'user',
          content: [{ type: 'input_text', text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        input.push({
          role: 'assistant',
          content: [{ type: 'output_text', text: msg.content }],
        });
      }
    }

    const stream = await this.openai.responses.create({
      model: this.currentModel,
      input: input.length === 1 ? input[0].content[0].text : input,
      max_output_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: options.temperature || 0.7,
      stream: true,
      ...(this.lastResponseId && { previous_response_id: this.lastResponseId }),
      ...(this.getModelConfig().supportsReasoning && {
        reasoning: {
          effort: this.reasoningEffort,
          summary: 'concise',
        },
      }),
    } as any);

    for await (const chunk of stream) {
      if (chunk.type === 'response.output_text.delta') {
        yield {
          type: 'text',
          content: (chunk as any).delta,
        };
      } else if (chunk.type === 'response.reasoning_summary_text.delta') {
        yield {
          type: 'reasoning',
          content: (chunk as any).delta,
        };
      } else if (chunk.type === 'response.created') {
        this.lastResponseId = (chunk as any).response.id;
      } else if (chunk.type === 'response.completed') {
        yield { type: 'done' };
      }
    }
  }

  /**
   * Reset conversation chain (clear previous_response_id)
   */
  resetConversation(): void {
    this.lastResponseId = undefined;
  }
}
