/**
 * Unified Multi-Model Manager
 * Supports Anthropic, OpenAI, Google Gemini, and Ollama
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { toAnthropicContent, contentToText } from '../utils/content-helpers.js';
import { mcpToAnthropicTools, mcpToOpenAITools, mcpToGoogleTools } from '../utils/tool-converter.js';
import { ContextWindowManager } from '../utils/context-manager.js';
import { enablePromptCaching } from '../utils/prompt-caching.js';

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'ollama';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  supportsThinking?: boolean; // Extended thinking (budget_tokens)
  supportsInterleavedThinking?: boolean; // NEW: Interleaved thinking (Sonnet 4 only)
  supportsComputerUse?: boolean; // NEW: Computer use capability
  supportsPromptCaching?: boolean; // NEW: Prompt caching
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
    supportsInterleavedThinking: true,
    supportsComputerUse: true,
    supportsPromptCaching: true,
    maxTokens: 32000,
    contextWindow: 200000,
  },
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    supportsThinking: true,
    supportsInterleavedThinking: true,
    supportsComputerUse: true,
    supportsPromptCaching: true,
    maxTokens: 64000,
    contextWindow: 1000000,
  },
  'claude-sonnet-4-5-20250929': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    supportsThinking: true,
    supportsInterleavedThinking: true,
    supportsComputerUse: true,
    supportsPromptCaching: true,
    maxTokens: 64000,
    contextWindow: 1000000,
  },
  'claude-haiku-4-5-20251001': {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    supportsThinking: false,
    supportsInterleavedThinking: false,
    supportsComputerUse: true,
    supportsPromptCaching: true,
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
  'gpt-5-pro': {
    id: 'gpt-5-pro',
    name: 'GPT-5 Pro',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'high', // Only supports high
    maxTokens: 32768,
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
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    supportsReasoning: false,
    maxTokens: 8192,
    contextWindow: 128000,
  },
  'gpt-5-codex': {
    id: 'gpt-5-codex',
    name: 'GPT-5 Codex',
    provider: 'openai',
    supportsReasoning: false,
    maxTokens: 16384,
    contextWindow: 128000,
  },
  'codex-mini-latest': {
    id: 'codex-mini-latest',
    name: 'Codex Mini',
    provider: 'openai',
    supportsReasoning: false,
    maxTokens: 8192,
    contextWindow: 100000,
  },
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    supportsReasoning: false,
    maxTokens: 4096,
    contextWindow: 128000,
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    supportsReasoning: false,
    maxTokens: 16384,
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
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    supportsReasoning: false,
    supportsVision: true,
    maxTokens: 16384,
    contextWindow: 128000,
  },
  'gpt-4o-search-preview': {
    id: 'gpt-4o-search-preview',
    name: 'GPT-4o Search',
    provider: 'openai',
    supportsReasoning: false,
    supportsVision: true,
    maxTokens: 16384,
    contextWindow: 128000,
  },
  'o1': {
    id: 'o1',
    name: 'O1',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'medium',
    maxTokens: 100000,
    contextWindow: 200000,
  },
  'o1-pro': {
    id: 'o1-pro',
    name: 'O1 Pro',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'high',
    maxTokens: 100000,
    contextWindow: 200000,
  },
  'o3': {
    id: 'o3',
    name: 'O3',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'high',
    maxTokens: 100000,
    contextWindow: 200000,
  },
  'o3-pro': {
    id: 'o3-pro',
    name: 'O3 Pro',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'high',
    maxTokens: 100000,
    contextWindow: 200000,
  },
  'o3-mini': {
    id: 'o3-mini',
    name: 'O3 Mini',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'low',
    maxTokens: 65536,
    contextWindow: 200000,
  },
  'o4-mini': {
    id: 'o4-mini',
    name: 'O4 Mini',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'medium',
    maxTokens: 65536,
    contextWindow: 200000,
  },
  'o4-mini-deep-research': {
    id: 'o4-mini-deep-research',
    name: 'O4 Mini Deep Research',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'high',
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
  'gemini-2-0-flash-thinking-exp-01-21': {
    id: 'gemini-2-0-flash-thinking-exp-01-21',
    name: 'Gemini 2.0 Flash Thinking',
    provider: 'google',
    supportsVision: true,
    supportsReasoning: true,
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
  private anthropic?: Anthropic; // Standard client (5 min timeout)
  private anthropicStreaming?: Anthropic; // Streaming client (10 min timeout)
  private anthropicComputerUse?: Anthropic; // Computer use client (15 min timeout)
  private openai?: OpenAI;
  private google?: GoogleGenerativeAI;
  private currentModel: string;
  private thinkingEnabled: boolean = true;
  private interleavedThinkingEnabled: boolean = false; // NEW: Interleaved thinking
  private computerUseEnabled: boolean = false; // NEW: Computer use capability
  private promptCachingEnabled: boolean = true; // NEW: Prompt caching (enabled by default)
  private skillsEnabled: boolean = false; // NEW: Agent Skills support
  private reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' = 'high';
  private verbosity: 'low' | 'medium' | 'high' = 'high'; // GPT-5 verbosity control
  private lastResponseId?: string;
  private conversationHistory: Message[] = []; // NEW: For rolling context window management
  private contextManager?: ContextWindowManager; // NEW: Context window manager

  constructor(
    anthropicKey?: string,
    openaiKey?: string,
    googleKey?: string,
    defaultModel?: string
  ) {
    // Initialize multiple Anthropic clients with different timeout configurations
    if (anthropicKey) {
      // Standard client: 5 minutes (300,000ms) for regular operations
      this.anthropic = new Anthropic({
        apiKey: anthropicKey,
        timeout: 300000, // 5 minutes
        maxRetries: 3,
      });

      // Streaming client: 10 minutes (600,000ms) for streaming + extended thinking
      this.anthropicStreaming = new Anthropic({
        apiKey: anthropicKey,
        timeout: 600000, // 10 minutes
        maxRetries: 5,
      });

      // Computer use client: 15 minutes (900,000ms) for computer automation tasks
      this.anthropicComputerUse = new Anthropic({
        apiKey: anthropicKey,
        timeout: 900000, // 15 minutes
        maxRetries: 5,
      });
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

    // Initialize context manager for models with large context windows
    if (this.currentModel && this.getModelConfig().contextWindow >= 1000000) {
      this.contextManager = new ContextWindowManager({
        maxTokens: this.getModelConfig().contextWindow,
        targetTokens: Math.floor(this.getModelConfig().contextWindow * 0.8),
        compressionThreshold: 0.9,
      });
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
   * Toggle interleaved thinking mode (Sonnet 4 only)
   */
  toggleInterleavedThinking(): boolean {
    this.interleavedThinkingEnabled = !this.interleavedThinkingEnabled;
    return this.interleavedThinkingEnabled;
  }

  /**
   * Get interleaved thinking state
   */
  isInterleavedThinkingEnabled(): boolean {
    return this.interleavedThinkingEnabled;
  }

  /**
   * Toggle computer use capability
   */
  toggleComputerUse(): boolean {
    this.computerUseEnabled = !this.computerUseEnabled;
    return this.computerUseEnabled;
  }

  /**
   * Get computer use state
   */
  isComputerUseEnabled(): boolean {
    return this.computerUseEnabled;
  }

  /**
   * Toggle prompt caching
   */
  togglePromptCaching(): boolean {
    this.promptCachingEnabled = !this.promptCachingEnabled;
    return this.promptCachingEnabled;
  }

  /**
   * Get prompt caching state
   */
  isPromptCachingEnabled(): boolean {
    return this.promptCachingEnabled;
  }

  /**
   * Toggle Agent Skills support
   */
  toggleSkills(): boolean {
    this.skillsEnabled = !this.skillsEnabled;
    return this.skillsEnabled;
  }

  /**
   * Get Agent Skills state
   */
  isSkillsEnabled(): boolean {
    return this.skillsEnabled;
  }

  /**
   * Get the appropriate Anthropic client based on operation type
   */
  private getAnthropicClient(): Anthropic {
    if (this.computerUseEnabled && this.anthropicComputerUse) {
      return this.anthropicComputerUse; // 15 min timeout for computer use
    }
    return this.anthropic!; // 5 min timeout for standard operations
  }

  /**
   * Get streaming client (10 min timeout)
   */
  private getAnthropicStreamingClient(): Anthropic {
    return this.anthropicStreaming || this.anthropic!;
  }

  /**
   * Toggle reasoning effort (for OpenAI reasoning models)
   */
  toggleReasoning(): 'minimal' | 'low' | 'medium' | 'high' {
    // GPT-5 Pro only supports 'high' reasoning - don't allow toggling
    if (this.currentModel === 'gpt-5-pro') {
      console.warn('⚠️ GPT-5 Pro only supports high reasoning effort. Cannot toggle.');
      return 'high';
    }

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
   * Set reasoning effort (with validation for GPT-5 Pro)
   */
  setReasoningEffort(effort: 'minimal' | 'low' | 'medium' | 'high'): void {
    // GPT-5 Pro only supports 'high' reasoning
    if (this.currentModel === 'gpt-5-pro' && effort !== 'high') {
      console.warn('⚠️ GPT-5 Pro only supports high reasoning effort. Ignoring change.');
      return;
    }
    this.reasoningEffort = effort;
  }

  /**
   * Get verbosity level (GPT-5 specific)
   */
  getVerbosity(): 'low' | 'medium' | 'high' {
    return this.verbosity;
  }

  /**
   * Set verbosity level (GPT-5 specific)
   */
  setVerbosity(level: 'low' | 'medium' | 'high'): void {
    this.verbosity = level;
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
    const useInterleavedThinking = this.getModelConfig().supportsThinking && this.interleavedThinkingEnabled;

    // Build extra headers for beta features
    const betaFeatures: string[] = [];

    if (useInterleavedThinking) {
      betaFeatures.push('interleaved-thinking-2025-05-14');
    }
    if (this.computerUseEnabled) {
      betaFeatures.push('computer-use-2025-01-24');
    }
    if (this.promptCachingEnabled) {
      betaFeatures.push('prompt-caching-2024-07-31');
    }
    if (this.skillsEnabled) {
      // Agent Skills requires 3 beta headers
      betaFeatures.push('code-execution-2025-08-25');
      betaFeatures.push('skills-2025-10-02');
      betaFeatures.push('files-api-2025-04-14');
    }

    const extraHeaders: Record<string, string> = {};
    if (betaFeatures.length > 0) {
      extraHeaders['anthropic-beta'] = betaFeatures.join(',');
    }

    // Enable prompt caching if enabled
    let finalSystem: any = systemPromptText;
    let finalMessages = formattedMessages;

    if (this.promptCachingEnabled && systemPromptText) {
      const cached = enablePromptCaching(systemPromptText, messages);
      finalSystem = cached.system;
      finalMessages = cached.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: toAnthropicContent(m.content),
        }));
    }

    // Use appropriate client based on operation type
    const client = this.getAnthropicClient();

    const response = await client.messages.create({
      model: this.currentModel,
      max_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: 1.0,
      system: finalSystem,
      messages: finalMessages as any,
      ...(useThinking && !useInterleavedThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: 200000,
        },
      }),
      ...(Object.keys(extraHeaders).length > 0 && { extra_headers: extraHeaders }),
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
      tools?: any[];
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
      // Add tool support - convert MCP format to OpenAI Responses API format
      // NOTE: Responses API is agentic by default, no parallel_tool_calls param needed
      ...(options.tools && options.tools.length > 0 && {
        tools: mcpToOpenAITools(options.tools),
      }),
      // GPT-5 verbosity control
      text: {
        verbosity: this.verbosity,
      },
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
    const useInterleavedThinking = this.getModelConfig().supportsThinking && this.interleavedThinkingEnabled;

    // Build extra headers for beta features
    const betaFeatures: string[] = [];

    if (useInterleavedThinking) {
      betaFeatures.push('interleaved-thinking-2025-05-14');
    }
    if (this.computerUseEnabled) {
      betaFeatures.push('computer-use-2025-01-24');
    }
    if (this.promptCachingEnabled) {
      betaFeatures.push('prompt-caching-2024-07-31');
    }
    if (this.skillsEnabled) {
      // Agent Skills requires 3 beta headers
      betaFeatures.push('code-execution-2025-08-25');
      betaFeatures.push('skills-2025-10-02');
      betaFeatures.push('files-api-2025-04-14');
    }

    const extraHeaders: Record<string, string> = {};
    if (betaFeatures.length > 0) {
      extraHeaders['anthropic-beta'] = betaFeatures.join(',');
    }

    // Use streaming client (10 min timeout)
    const client = this.getAnthropicStreamingClient();

    const stream = await client.messages.stream({
      model: this.currentModel,
      max_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: 1.0,
      system: systemPromptText,
      messages: formattedMessages as any,
      // Add tool support - convert MCP format to Anthropic format
      ...(options.tools && options.tools.length > 0 && { tools: mcpToAnthropicTools(options.tools) as any }),
      ...(useThinking && !useInterleavedThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: 200000,
        },
      }),
      ...(Object.keys(extraHeaders).length > 0 && { extra_headers: extraHeaders }),
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
      tools?: any[];
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
      // Add tool support - convert MCP format to OpenAI Responses API format
      // NOTE: Responses API is agentic by default, no parallel_tool_calls param needed
      ...(options.tools && options.tools.length > 0 && {
        tools: mcpToOpenAITools(options.tools),
      }),
      // GPT-5 verbosity control
      text: {
        verbosity: this.verbosity,
      },
      ...(this.getModelConfig().supportsReasoning && {
        reasoning: {
          effort: this.reasoningEffort,
          summary: 'detailed', // Reasoning models only support 'detailed', not 'concise'
        },
      }),
    } as any);

    for await (const chunk of (stream as any)) {
      // Log ALL events to debug stream issues
      console.log('📨 OpenAI Event:', chunk.type);

      if (chunk.type === 'response.output_text.delta') {
        yield {
          type: 'text',
          content: (chunk as any).delta,
        };
      } else if (chunk.type === 'response.reasoning_summary_text.delta') {
        // Reasoning summary chunks
        yield {
          type: 'reasoning',
          content: (chunk as any).delta,
        };
      } else if (chunk.type === 'response.reasoning.delta') {
        // Full reasoning chunks (not just summary)
        yield {
          type: 'reasoning',
          content: (chunk as any).delta || (chunk as any).content || '',
        };
      } else if (chunk.type === 'response.reasoning.done') {
        // Reasoning finished - DON'T stop stream, just log
        console.log('✅ Reasoning complete, continuing stream...');
        // Don't yield anything, keep streaming
      } else if (chunk.type === 'response.created') {
        this.lastResponseId = (chunk as any).response.id;
      } else if (chunk.type === 'response.completed') {
        console.log('✅ Response complete');
        yield { type: 'done' };
      } else if (chunk.type && chunk.type.includes('reasoning')) {
        // Catch any other reasoning-related events we might have missed
        console.log('🔍 Unknown reasoning event type:', chunk.type, JSON.stringify(chunk));
        if (chunk.delta || chunk.content) {
          yield {
            type: 'reasoning',
            content: (chunk as any).delta || (chunk as any).content || '',
          };
        }
      } else {
        // Log unhandled events
        console.log('⚠️ Unhandled event type:', chunk.type);
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
    if (this.contextManager) {
      this.contextManager.clear();
    }
  }

  /**
   * Get context window statistics (for large context models)
   */
  getContextStats(): {
    messageCount: number;
    tokenCount: number;
    maxTokens: number;
    utilizationPercent: number;
  } | null {
    return this.contextManager ? this.contextManager.getStats() : null;
  }

  /**
   * Add messages to context manager
   */
  async addToContext(messages: Message[]): Promise<void> {
    if (this.contextManager) {
      await this.contextManager.addMessages(messages);
    }
    this.conversationHistory.push(...messages);
  }
}
