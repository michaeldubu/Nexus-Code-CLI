/**
 * Unified Multi-Model Manager
 * Supports Anthropic, OpenAI, Google Gemini, and Ollama
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { toAnthropicContent, contentToText } from '../utils/content-helpers.js';
import { mcpToAnthropicTools, mcpToOpenAITools, mcpToGoogleTools } from '../utils/tool-converter.js';

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'ollama';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  supportsThinking?: boolean;
  supportsReasoning?: boolean;
  supportsVision?: boolean;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  maxTokens: number;
  contextWindow: number;
}

export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // Anthropic Models
  'claude-opus-4-1-20250805': {
    id: 'claude-opus-4-1-20250805',
    name: 'Claude Opus 4.1',
    provider: 'anthropic',
    supportsThinking: true,
    maxTokens: 32000,
    contextWindow: 200000,
  },
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    supportsThinking: true,
    maxTokens: 64000,
    contextWindow: 1000000,
  },
  'claude-sonnet-4-5-20250929': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    supportsThinking: true,
    maxTokens: 64000,
    contextWindow: 1000000,
  },
  'claude-haiku-4-5-20251001': {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    supportsThinking: false,
    maxTokens: 64000,
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
    supportsVision: true,
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

  // Google Gemini Models
  'gemini-2.0-flash-exp': {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    supportsVision: true,
    maxTokens: 8192,
    contextWindow: 1000000,
  },
  'gemini-exp-1206': {
    id: 'gemini-exp-1206',
    name: 'Gemini 2.0 Pro (Exp)',
    provider: 'google',
    supportsVision: true,
    supportsReasoning: true,
    reasoningEffort: 'high',
    maxTokens: 8192,
    contextWindow: 2000000,
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    supportsVision: true,
    maxTokens: 8192,
    contextWindow: 2000000,
  },
};

// Content block types (matching Claude Code's format)
export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ImageContentBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string; // e.g., 'image/png', 'image/jpeg'
    data: string; // base64-encoded image data
  };
}

export interface FileContentBlock {
  type: 'file';
  name: string;
  content: string;
}

export type ContentBlock = TextContentBlock | ImageContentBlock | FileContentBlock;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  // Support both string (legacy) and content blocks (new)
  content: string | ContentBlock[];
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
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private google?: GoogleGenerativeAI;
  private currentModel: string;
  private thinkingEnabled: boolean = true;
  private reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' = 'high';
  private lastResponseId?: string;

  constructor(
    anthropicKey?: string,
    openaiKey?: string,
    googleKey?: string,
    defaultModel?: string
  ) {
    // Initialize only the clients for which we have API keys
    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    }
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
    if (googleKey) {
      this.google = new GoogleGenerativeAI(googleKey);
    }

    // Set default model to first available provider
    if (defaultModel && this.isModelAvailable(defaultModel)) {
      this.currentModel = defaultModel;
    } else {
      // Auto-select first available model
      if (anthropicKey) this.currentModel = 'claude-sonnet-4-5-20250929';
      else if (openaiKey) this.currentModel = 'gpt-5';
      else if (googleKey) this.currentModel = 'gemini-2.0-flash-exp';
      else this.currentModel = ''; // No keys provided
    }
  }

  /**
   * Check if a model is available (has API key)
   */
  private isModelAvailable(modelId: string): boolean {
    const config = AVAILABLE_MODELS[modelId];
    if (!config) return false;

    switch (config.provider) {
      case 'anthropic':
        return !!this.anthropic;
      case 'openai':
        return !!this.openai;
      case 'google':
        return !!this.google;
      default:
        return false;
    }
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
   * List all available models (only those with API keys)
   */
  listModels(): ModelConfig[] {
    return Object.values(AVAILABLE_MODELS).filter(model =>
      this.isModelAvailable(model.id)
    );
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
    } else if (config.provider === 'openai') {
      return this.sendOpenAIMessage(messages, options);
    } else if (config.provider === 'google') {
      return this.sendGeminiMessage(messages, options);
    } else {
      throw new Error(`Unsupported provider: ${config.provider}`);
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
        content: toAnthropicContent(m.content),
      }));

    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;
    const systemPromptText = typeof systemPrompt === 'string' ? systemPrompt : contentToText(systemPrompt || '');

    // MAXIMUM CREATIVITY! All models use temperature 1.0 🔥
    const useThinking = this.getModelConfig().supportsThinking && this.thinkingEnabled;

    const response = await this.anthropic.messages.create({
      model: this.currentModel,
      max_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: 1.0,
      system: systemPromptText,
      messages: formattedMessages as any,
      ...(useThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: 200000,
        },
      }),
    } as any);

    const textContent = response.content.find(c => c.type === 'text');
    const thinkingContent = response.content.find((c: any) => c.type === 'thinking');

    const toolCalls: ToolCall[] = [];

    // Extract all tool_use blocks - THIS IS THE FIX! 🔥
    for (const contentBlock of response.content) {
      if (contentBlock.type === 'tool_use') {
        // Extract input parameters from tool call
        const input = (contentBlock as any).input as Record<string, any>;
        toolCalls.push({
          id: (contentBlock as any).id,
          type: 'tool_use',
          function: {
            name: (contentBlock as any).name,
            arguments: JSON.stringify(input), // Convert to JSON string for consistency
          },
        });
      }
    }

    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      thinking: (thinkingContent as any)?.type === 'thinking' ? (thinkingContent as any).thinking : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined, // Include if any tools called
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
    const systemPromptText = typeof systemPrompt === 'string' ? systemPrompt : contentToText(systemPrompt || '');
    const userMessages = messages.filter(m => m.role !== 'system');

    // Build input array for Responses API
    const input: any[] = [];

    // Add system/developer message if present
    if (systemPromptText) {
      input.push({
        role: 'developer',
        content: systemPromptText,
      });
    }

    // Add user messages - CONVERT ContentBlock[] to string! 🔥
    for (const msg of userMessages) {
      if (msg.role === 'user') {
        const textContent = typeof msg.content === 'string' ? msg.content : contentToText(msg.content);
        input.push({
          role: 'user',
          content: [{ type: 'input_text', text: textContent }],
        });
      } else if (msg.role === 'assistant') {
        const textContent = typeof msg.content === 'string' ? msg.content : contentToText(msg.content);
        input.push({
          role: 'assistant',
          content: [{ type: 'output_text', text: textContent }],
        });
      }
    }

    const response = await this.openai.responses.create({
      model: this.currentModel,
      input: input.length === 1 ? input[0].content[0].text : input,
      max_output_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: 1.0,
      // Use previous_response_id for context chaining
      ...(this.lastResponseId && { previous_response_id: this.lastResponseId }),
      // Enable reasoning for supported models
      ...(this.getModelConfig().supportsReasoning && {
        reasoning: {
          effort: this.reasoningEffort,
          summary: 'detailed', // Reasoning models only support 'detailed', not 'concise'
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
      tools?: any[]; // MCP tool definitions
    } = {}
  ): AsyncGenerator<StreamChunk> {
    const config = this.getModelConfig();

    if (config.provider === 'anthropic') {
      yield* this.streamAnthropicMessage(messages, options);
    } else if (config.provider === 'openai') {
      yield* this.streamOpenAIMessage(messages, options);
    } else if (config.provider === 'google') {
      yield* this.streamGeminiMessage(messages, options);
    } else {
      throw new Error(`Unsupported provider: ${config.provider}`);
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
      tools?: any[];
    }
  ): AsyncGenerator<StreamChunk> {
    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: toAnthropicContent(m.content),
      }));

    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;
    const systemPromptText = typeof systemPrompt === 'string' ? systemPrompt : contentToText(systemPrompt || '');

    // MAXIMUM CREATIVITY! All models use temperature 1.0 🔥
    const useThinking = this.getModelConfig().supportsThinking && this.thinkingEnabled;

    const stream = await this.anthropic.messages.stream({
      model: this.currentModel,
      max_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: 1.0,
      system: systemPromptText,
      messages: formattedMessages as any,
      // Add tool support - convert MCP format to Anthropic format
      ...(options.tools && options.tools.length > 0 && { tools: mcpToAnthropicTools(options.tools) as any }),
      ...(useThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: 200000,
        },
      }),
    } as any);

    // Track tool calls being built up from deltas 🔥
    let currentToolCall: { id: string; name: string; inputStr: string } | null = null;

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_start') {
        // Start tracking tool_use blocks
        if (chunk.content_block.type === 'tool_use') {
          currentToolCall = {
            id: chunk.content_block.id,
            name: chunk.content_block.name,
            inputStr: '', // Will accumulate from deltas - THIS IS THE FIX!
          };
        }
      } else if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          yield {
            type: 'text',
            content: chunk.delta.text,
          };
        }
        // Accumulate tool input JSON from deltas 🎯
        else if (chunk.delta.type === 'input_json_delta' && currentToolCall) {
          currentToolCall.inputStr += chunk.delta.partial_json;
        }
        // Thinking deltas
        else if ((chunk.delta as any).type === 'thinking_delta') {
          yield {
            type: 'thinking',
            content: (chunk.delta as any).thinking,
          };
        }
      } else if (chunk.type === 'content_block_stop') {
        // Finalize the tool call with accumulated parameters
        if (currentToolCall) {
          try {
            const input = JSON.parse(currentToolCall.inputStr);
            yield {
              type: 'tool_call',
              toolCall: {
                id: currentToolCall.id,
                type: 'function',
                function: {
                  name: currentToolCall.name,
                  arguments: currentToolCall.inputStr, // Full JSON string
                },
              },
            };
          } catch (e) {
            console.error(`🔥 Failed to parse tool input: ${currentToolCall.inputStr}`, e);
          }
          currentToolCall = null;
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
    const systemPromptText = typeof systemPrompt === 'string' ? systemPrompt : contentToText(systemPrompt || '');
    const userMessages = messages.filter(m => m.role !== 'system');

    const input: any[] = [];
    if (systemPromptText) {
      input.push({ role: 'developer', content: systemPromptText });
    }

    // CONVERT ContentBlock[] to string! 🔥
    for (const msg of userMessages) {
      if (msg.role === 'user') {
        const textContent = typeof msg.content === 'string' ? msg.content : contentToText(msg.content);
        input.push({
          role: 'user',
          content: [{ type: 'input_text', text: textContent }],
        });
      } else if (msg.role === 'assistant') {
        const textContent = typeof msg.content === 'string' ? msg.content : contentToText(msg.content);
        input.push({
          role: 'assistant',
          content: [{ type: 'output_text', text: textContent }],
        });
      }
    }

    const stream = await this.openai.responses.create({
      model: this.currentModel,
      input: input.length === 1 ? input[0].content[0].text : input,
      max_output_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: 1.0,
      stream: true,
      ...(this.lastResponseId && { previous_response_id: this.lastResponseId }),
      ...(this.getModelConfig().supportsReasoning && {
        reasoning: {
          effort: this.reasoningEffort,
          summary: 'detailed', // Reasoning models only support 'detailed', not 'concise'
        },
      }),
    } as any);

    for await (const chunk of (stream as any)) {
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
   * Send message to Google Gemini
   */
  private async sendGeminiMessage(
    messages: Message[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<ModelResponse> {
    if (!this.google) {
      throw new Error('Google API key not provided');
    }

    const model = this.google.getGenerativeModel({ model: this.currentModel });

    // Build chat history for Gemini
    const history: any[] = [];
    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;

    for (const msg of messages.filter(m => m.role !== 'system')) {
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Remove last message (we'll send it separately)
    const lastMessage = history.pop();

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: options.maxTokens || this.getModelConfig().maxTokens,
      },
      ...(systemPrompt && { systemInstruction: typeof systemPrompt === 'string' ? systemPrompt : contentToText(systemPrompt) }),
    });

    const result = await chat.sendMessage(lastMessage?.parts || [{ text: '' }]);
    const response = result.response;

    return {
      content: response.text(),
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }

  /**
   * Stream from Google Gemini
   */
  private async *streamGeminiMessage(
    messages: Message[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): AsyncGenerator<StreamChunk> {
    if (!this.google) {
      throw new Error('Google API key not provided');
    }

    const model = this.google.getGenerativeModel({ model: this.currentModel });

    const history: any[] = [];
    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;

    for (const msg of messages.filter(m => m.role !== 'system')) {
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    const lastMessage = history.pop();

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: options.maxTokens || this.getModelConfig().maxTokens,
      },
      ...(systemPrompt && { systemInstruction: typeof systemPrompt === 'string' ? systemPrompt : contentToText(systemPrompt) }),
    });

    const result = await chat.sendMessageStream(lastMessage?.parts || [{ text: '' }]);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield {
          type: 'text',
          content: text,
        };
      }
    }

    yield { type: 'done' };
  }

  /**
   * Reset conversation chain (clear previous_response_id)
   */
  resetConversation(): void {
    this.lastResponseId = undefined;
  }
}
