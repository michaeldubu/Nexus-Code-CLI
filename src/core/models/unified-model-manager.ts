/**
 * Unified Multi-Model Manager
 * Supports Anthropic, OpenAI, Google Gemini, and Ollama
 *
 * CRITICAL: Tool Use + Thinking Implementation Notes
 * ===================================================
 *
 * When using extended thinking with tool use, several important behaviors must be maintained:
 *
 * 1. THINKING BLOCK PRESERVATION:
 *    - During tool use loops, thinking blocks from the last assistant message must be preserved
 *    - Pass the complete unmodified thinking blocks back to the API with tool results
 *    - Thinking blocks are included in the content array as { type: 'thinking', thinking: '...' }
 *
 * 2. TOOL RESULT STRUCTURE:
 *    Tool results MUST be structured correctly when including system-reminders.
 *    CORRECT structure:
 *    {
 *      "role": "user",
 *      "content": [
 *        {
 *          "tool_use_id": "toolu_01XdVUKZTiWkVoFnuD2mv5oX",
 *          "type": "tool_result",
 *          "content": [
 *            { "type": "text", "text": "Tool result here" },
 *            { "type": "text", "text": "<system-reminder>...</system-reminder>" }
 *          ]
 *        }
 *      ]
 *    }
 *
 *    INCORRECT (causes MCP bug): System-reminders concatenated directly with tool results
 *
 * 3. TOOL_CHOICE LIMITATION:
 *    Tool use with thinking only supports:
 *    - tool_choice: {type: "auto"} (default)
 *    - tool_choice: {type: "none"}
 *    Using tool_choice: {type: "any"} or {type: "tool", name: "..."} will error
 *
 * 4. CONTEXT WINDOW BEHAVIOR:
 *    - Effective context window = input_tokens + current_turn_tokens
 *    - Previous thinking blocks are automatically stripped from context calculations
 *    - When a non-tool-result user block is included, all previous thinking blocks are ignored
 *    - Thinking blocks from previous turns are cached and count as input tokens when read from cache
 *
 * 5. PROMPT CACHING:
 *    - Changes to thinking parameters (enabled/disabled, budget) invalidate cache breakpoints
 *    - Thinking blocks are cached and retrieved efficiently
 *
 * 6. MID-TURN TOGGLES:
 *    - Cannot toggle thinking during an assistant turn (including tool use loops)
 *    - Only toggle thinking between complete assistant turns
 *
 * 7. BETA HEADERS:
 *    - interleaved-thinking-2025-05-14: For interleaved thinking
 *    - context-1m-2025-08-07: For 1M context window (Sonnet 4/4.5)
 *    - prompt-caching-2024-07-31: For prompt caching
 *    - computer-use-2025-01-24: For computer use capability
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { toAnthropicContent, contentToText } from '../utils/content-helpers.js';
import { mcpToAnthropicTools, mcpToOpenAITools, mcpToGoogleTools } from '../utils/tool-converter.js';
import { ContextWindowManager } from '../utils/context-manager.js';
import { enablePromptCaching } from '../utils/prompt-caching.js';

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'ollama'; //TODO add ollama

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  supportsThinking?: boolean; // Extended thinking
  supportsInterleavedThinking?: boolean; // Interleaved thinking (Sonnet 4/4.5 only)
  supportsComputerUse?: boolean; // Computer use capability
  supportsPromptCaching?: boolean; // Prompt caching
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
    supportsThinking: true, // 🔥 HAIKU 4.5 NOW SUPPORTS EXTENDED THINKING!
    supportsInterleavedThinking: true, // 🔥 Interleaved thinking too!
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
    reasoningEffort: 'low',
    maxTokens: 32768,
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
    maxTokens: 32768,
    contextWindow: 128000,
  },
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'low',
    maxTokens: 32768,
    contextWindow: 128000,
  },
  'gpt-5-codex': {
    id: 'gpt-5-codex',
    name: 'GPT-5 Codex',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'medium',
    maxTokens: 32768,
    contextWindow: 128000,
  },
  'codex-mini-latest': {
    id: 'codex-mini-latest',
    name: 'Codex Mini',
    provider: 'openai',
    supportsReasoning: false,
    maxTokens: 32768,
    contextWindow: 100000,
  },
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    supportsReasoning: false,
    reasoningEffort: 'medium',
    maxTokens: 32768,
    contextWindow: 128000,
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    supportsReasoning: false,
    maxTokens: 32768,
    contextWindow: 128000,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'medium',
    supportsVision: true,
    maxTokens: 16384,
    contextWindow: 128000,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'medium',
    supportsVision: true,
    maxTokens: 16384,
    contextWindow: 128000,
  },
  'gpt-4o-search-preview': {
    id: 'gpt-4o-search-preview',
    name: 'GPT-4o Search',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'medium',
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
    reasoningEffort: 'medium',
    maxTokens: 100000,
    contextWindow: 200000,
  },
  'o3': {
    id: 'o3',
    name: 'O3',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'medium',
    maxTokens: 100000,
    contextWindow: 200000,
  },
  'o3-pro': {
    id: 'o3-pro',
    name: 'O3 Pro',
    provider: 'openai',
    supportsReasoning: true,
    reasoningEffort: 'medium',
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
    name: 'Gemini 2.0 Pro',
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

// Content block types
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
  type: 'text' | 'thinking' | 'reasoning' | 'reasoning_summary' | 'tool_call' | 'tool_use' | 'code' | 'status' | 'error' | 'done';
  content?: string;
  toolCall?: ToolCall;
  toolName?: string;
  toolInput?: any;
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
  private anthropicKey?: string; // Store key for recreating clients with beta headers
  private openai?: OpenAI;
  private google?: GoogleGenerativeAI;
  private currentModel: string;
  private thinkingEnabled: boolean = true;
  private interleavedThinkingEnabled: boolean = true; // Interleaved thinking
  private computerUseEnabled: boolean = false; // Computer use capability
  private promptCachingEnabled: boolean = true; //Prompt caching (enabled by default)
  private skillsEnabled: boolean = true; // Agent Skills support
  private reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' = 'high';
  private verbosity: 'low' | 'high' = 'high'; // GPT-5 verbosity control (ONLY low/high per API docs)
  private lastResponseId?: string;
  private conversationHistory: Message[] = []; //rolling context window management
  private contextManager?: ContextWindowManager; //Context window manager
  private isInToolUseLoop: boolean = false; // Track if we're in a tool use loop (prevent mid-turn thinking toggles)
  private lastAssistantThinkingBlocks: any[] = []; // Preserve thinking blocks from last assistant message for tool use

  constructor(
    anthropicKey?: string,
    openaiKey?: string,
    googleKey?: string,
    defaultModel?: string
  ) {
    // Initialize multiple Anthropic clients with different timeout configurations
    if (anthropicKey) {
      // Standard client: 10 minutes (600,000ms) for regular operations
      this.anthropic = new Anthropic({
        apiKey: anthropicKey,
        timeout: 600000, // 10 minutes
        maxRetries: 3,
      });

      // Streaming client: 20 minutes (1,200,000ms) for streaming + extended thinking
      this.anthropicStreaming = new Anthropic({
        apiKey: anthropicKey,
        timeout: 1200000, // 20 minutes
        maxRetries: 5,
      });

      // Computer use client: 20 minutes (1,200,000ms) for computer automation tasks
      this.anthropicComputerUse = new Anthropic({
        apiKey: anthropicKey,
        timeout: 1200000, // 20 minutes
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
      // Auto-select first available model - DEFAULT TO HAIKU 4.5 (fast & cheap)
      if (anthropicKey) this.currentModel = 'claude-haiku-4-5-20251001';
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
   * Set current model and auto-adjust capabilities
   */
  setModel(modelId: string): void {
    if (!AVAILABLE_MODELS[modelId]) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const newConfig = AVAILABLE_MODELS[modelId];
    const oldConfig = AVAILABLE_MODELS[this.currentModel];

    this.currentModel = modelId;
    this.lastResponseId = undefined; // Reset conversation chain

    // Auto-disable incompatible features when switching models
    if (oldConfig && newConfig) {
      // Disable thinking if new model doesn't support it
      if (!newConfig.supportsThinking && this.thinkingEnabled) {
        this.thinkingEnabled = false;
      }

      // Disable interleaved thinking if new model doesn't support it
      if (!newConfig.supportsInterleavedThinking && this.interleavedThinkingEnabled) {
        this.interleavedThinkingEnabled = false;
      }

      // Disable reasoning if new model doesn't support it
      if (!newConfig.supportsReasoning && oldConfig.supportsReasoning) {
        // Don't reset reasoningEffort, just don't use it
      }

      // Disable computer use if new model doesn't support it
      if (!newConfig.supportsComputerUse && this.computerUseEnabled) {
        this.computerUseEnabled = false;
      }

      // Auto-enable thinking for new Claude models if it was on for old model
      if (newConfig.supportsThinking && !this.thinkingEnabled && oldConfig.supportsThinking) {
        this.thinkingEnabled = true;
      }
    }
  }

  /**
   * Toggle thinking mode
   * CRITICAL: Cannot toggle thinking in the middle of an assistant turn (including tool use loops)
   */
  toggleThinking(): boolean {
    if (this.isInToolUseLoop) {
      console.warn('⚠️ Cannot toggle thinking during a tool use loop. Complete the assistant turn first.');
      return this.thinkingEnabled;
    }

    // Invalidate prompt cache when thinking parameters change
    if (this.promptCachingEnabled) {
      console.log('🔄 Thinking parameter changed - prompt cache will be invalidated');
    }

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
   * Toggle interleaved thinking mode
   * CRITICAL: Cannot toggle thinking in the middle of an assistant turn (including tool use loops)
   */
  toggleInterleavedThinking(): boolean {
    if (this.isInToolUseLoop) {
      console.warn('⚠️ Cannot toggle interleaved thinking during a tool use loop. Complete the assistant turn first.');
      return this.interleavedThinkingEnabled;
    }

    // Invalidate prompt cache when thinking parameters change
    if (this.promptCachingEnabled) {
      console.log('🔄 Thinking parameter changed - prompt cache will be invalidated');
    }

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
      return this.anthropicComputerUse; // 20 min timeout for computer use
    }
    return this.anthropic!; // 10 min timeout for standard operations
  }

  /**
   * Get streaming client (10 min timeout)
   */
  private getAnthropicStreamingClient(): Anthropic {
    return this.anthropicStreaming || this.anthropic!;
  }

  /**
   * Toggle reasoning effort (for OpenAI reasoning models)
   * Now includes 'off' option to disable reasoning
   */
  toggleReasoning(): 'off' | 'minimal' | 'low' | 'medium' | 'high' {
    // Check if model supports reasoning
    if (!this.getModelConfig().supportsReasoning) {
      console.warn('⚠️ Current model does not support reasoning.');
      return 'off';
    }

    // GPT-5 Pro only supports 'high' reasoning - don't allow toggling
    if (this.currentModel === 'gpt-5-pro') {
      console.warn('⚠️ GPT-5 Pro only supports high reasoning effort. Cannot toggle.');
      return 'high';
    }

    const levels: Array<'off' | 'minimal' | 'low' | 'medium' | 'high'> = ['off', 'minimal', 'low', 'medium', 'high'];
    const currentIndex = levels.indexOf(this.reasoningEffort as any);
    const nextLevel = levels[(currentIndex + 1) % levels.length];
    this.reasoningEffort = nextLevel === 'off' ? 'low' : nextLevel; // Store actual level
    return nextLevel;
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
  getVerbosity(): 'low' | 'high' {
    return this.verbosity;
  }

  /**
   * Set verbosity level (GPT-5 specific)
   */
  setVerbosity(level: 'low' | 'high'): void {
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
      tools?: any[];
      tool_choice?: any;
    }
  ): Promise<ModelResponse> {
    // Format messages and PRESERVE thinking blocks from previous assistant messages
    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const baseMessage: any = {
          role: m.role as 'user' | 'assistant',
          content: toAnthropicContent(m.content),
        };

        // CRITICAL: Preserve thinking blocks during tool use loops
        // When passing tool results back, we must include the complete unmodified thinking blocks
        if (m.role === 'assistant' && m.thinking) {
          baseMessage.content = [
            { type: 'thinking', thinking: m.thinking },
            ...Array.isArray(baseMessage.content) ? baseMessage.content : [{ type: 'text', text: baseMessage.content }]
          ];
        }

        return baseMessage;
      });

    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;
    const systemPromptText = typeof systemPrompt === 'string' ? systemPrompt : contentToText(systemPrompt || '');

    // MAXIMUM CREATIVITY! All models use temperature 1.0 🔥
    const useThinking = this.getModelConfig().supportsThinking && this.thinkingEnabled;
    const useInterleavedThinking = this.getModelConfig().supportsThinking && this.interleavedThinkingEnabled;

    // CRITICAL: Validate tool_choice when thinking is enabled
    // Thinking + tool use only supports tool_choice: {type: "auto"} or {type: "none"}
    if (useThinking && options.tool_choice) {
      const toolChoiceType = typeof options.tool_choice === 'string' ? options.tool_choice : options.tool_choice.type;
      if (toolChoiceType === 'any' || toolChoiceType === 'tool') {
        throw new Error(
          'Tool use with thinking only supports tool_choice: {type: "auto"} (default) or {type: "none"}. ' +
          'Using tool_choice: {type: "any"} or {type: "tool", name: "..."} will result in an error.'
        );
      }
    }

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
    // Add 1M context beta header for Sonnet 4 and 4.5
    if (this.currentModel === 'claude-sonnet-4-20250514' || this.currentModel === 'claude-sonnet-4-5-20250929') {
      betaFeatures.push('context-1m-2025-08-07');
    }
    // Skills disabled - requires docker container via code-execution beta
    // if (this.skillsEnabled) {
    //   betaFeatures.push('code-execution-2025-08-25');
    //   betaFeatures.push('skills-2025-10-02');
    //   betaFeatures.push('files-api-2025-04-14');
    // }

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

    // Prepare tools array - include code_execution if skills are enabled
    let anthropicTools: any[] = options.tools && options.tools.length > 0 ? mcpToAnthropicTools(options.tools) as any : [];

    // Skills disabled - requires docker container
    // if (this.skillsEnabled) {
    //   anthropicTools.push({
    //     type: 'code_execution_20250825',
    //     name: 'code_execution',
    //   });
    // }

    // Build request options (first parameter)
    const requestOptions: any = {
      model: this.currentModel,
      max_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: 1.0,
      system: finalSystem,
      messages: finalMessages as any,
      // Add tools if provided
      ...(anthropicTools.length > 0 && { tools: anthropicTools }),
      // Add tool_choice if provided and validated
      ...(options.tool_choice && { tool_choice: options.tool_choice }),
      // Enable thinking: use extended thinking if not using interleaved (beta header handles interleaved)
      ...(useThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: 200000,
        },
      }),
    };

    // Build headers options (second parameter)
    const headersOptions: any = betaFeatures.length > 0 ? {
      headers: {
        'anthropic-beta': betaFeatures.join(','),
      }
    } : undefined;

    const response = await client.messages.create(requestOptions, headersOptions);

    const textContent = response.content.find(c => c.type === 'text');
    const thinkingContent = response.content.find((c: any) => c.type === 'thinking');

    const toolCalls: ToolCall[] = [];
    const thinkingBlocks: any[] = [];

    // Extract all tool_use blocks and thinking blocks
    for (const contentBlock of response.content) {
      if (contentBlock.type === 'tool_use') {
        // We're entering a tool use loop - set flag to prevent mid-turn thinking toggles
        this.isInToolUseLoop = true;

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
      } else if ((contentBlock as any).type === 'thinking') {
        // Preserve thinking blocks for future tool use loops
        thinkingBlocks.push({ type: 'thinking', thinking: (contentBlock as any).thinking });
      }
    }

    // Save thinking blocks for future tool use loops
    if (thinkingBlocks.length > 0) {
      this.lastAssistantThinkingBlocks = thinkingBlocks;
    }

    // If no tool calls, we're done with this turn - reset flag
    if (toolCalls.length === 0) {
      this.isInToolUseLoop = false;
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
      // CRITICAL: Computer use requires truncation: 'auto'
      ...(this.currentModel === 'computer-use-preview' && {
        truncation: 'auto'
      }),
      // Add tool support - convert MCP format to OpenAI Responses API format
      // NOTE: Responses API supports parallel tool calls
      ...(options.tools && options.tools.length > 0 && {
        tools: mcpToOpenAITools(options.tools),
        parallel_tool_calls: true, // Enable parallel tool execution
      }),
      // GPT-5 verbosity control
      text: {
        verbosity: this.verbosity,
      },
      // Enable reasoning for supported models
      // CRITICAL: Use model-specific reasoningEffort, not global setting!
      ...(this.getModelConfig().supportsReasoning && {
        reasoning: {
          effort: this.getModelConfig().reasoningEffort || this.reasoningEffort,
          summary: 'detailed', // Reasoning models only support 'detailed', not 'concise' //concise IS for 'computer-use-preview' model
        },
      }),
    } as any);

    this.lastResponseId = response.id;

    // Parse output - handle ALL output types
    let content = '';
    let reasoning = '';
    const toolCalls: ToolCall[] = [];

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
      } else if (item.type === 'function_call') {
        // Handle function calls
        toolCalls.push({
          id: (item as any).call_id || (item as any).id,
          type: 'function',
          function: {
            name: (item as any).name,
            arguments: (item as any).arguments || '{}',
          },
        });
      } else if (item.type === 'web_search_call') {
        // Log web search (not a tool call we need to handle)
        console.log('Web search performed:', (item as any).id);
      } else if (item.type === 'file_search_call') {
        // Log file search (not a tool call we need to handle)
        console.log('File search performed:', (item as any).id);
      } else if (item.type === 'mcp_call') {
        // Handle MCP tool call
        console.log('MCP call:', (item as any).name, (item as any).output);
      } else if (item.type === 'mcp_approval_request') {
        // Handle MCP approval request (would need user interaction)
        console.log('MCP approval needed:', (item as any).name);
      } else if (item.type === 'code_interpreter_call') {
        // Log code execution
        console.log('Code executed:', (item as any).id);
      } else if (item.type === 'image_generation_call') {
        // Log image generation
        console.log('Image generated:', (item as any).id);
      } else if (item.type === 'computer_call') {
        // Log computer use action
        console.log('Computer action:', (item as any).action);
      }
    }

    return {
      content: content.trim(),
      reasoning: reasoning.trim() || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
      tool_choice?: any;
    }
  ): AsyncGenerator<StreamChunk> {
    // Format messages and PRESERVE thinking blocks from previous assistant messages
    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const baseMessage: any = {
          role: m.role as 'user' | 'assistant',
          content: toAnthropicContent(m.content),
        };

        // CRITICAL: Preserve thinking blocks during tool use loops
        // When passing tool results back, we must include the complete unmodified thinking blocks
        if (m.role === 'assistant' && m.thinking) {
          baseMessage.content = [
            { type: 'thinking', thinking: m.thinking },
            ...Array.isArray(baseMessage.content) ? baseMessage.content : [{ type: 'text', text: baseMessage.content }]
          ];
        }

        return baseMessage;
      });

    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;
    const systemPromptText = typeof systemPrompt === 'string' ? systemPrompt : contentToText(systemPrompt || '');

    // MAXIMUM CREATIVITY! All models use temperature 1.0 🔥
    const useThinking = this.getModelConfig().supportsThinking && this.thinkingEnabled;
    const useInterleavedThinking = this.getModelConfig().supportsThinking && this.interleavedThinkingEnabled;

    // CRITICAL: Validate tool_choice when thinking is enabled
    // Thinking + tool use only supports tool_choice: {type: "auto"} or {type: "none"}
    if (useThinking && options.tool_choice) {
      const toolChoiceType = typeof options.tool_choice === 'string' ? options.tool_choice : options.tool_choice.type;
      if (toolChoiceType === 'any' || toolChoiceType === 'tool') {
        throw new Error(
          'Tool use with thinking only supports tool_choice: {type: "auto"} (default) or {type: "none"}. ' +
          'Using tool_choice: {type: "any"} or {type: "tool", name: "..."} will result in an error.'
        );
      }
    }

    // Build headers for beta features
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
    // Add 1M context beta header for Sonnet 4 and 4.5
    if (this.currentModel === 'claude-sonnet-4-20250514' || this.currentModel === 'claude-sonnet-4-5-20250929') {
      betaFeatures.push('context-1m-2025-08-07');
    }
    // Skills disabled - requires docker container via code-execution beta
    // if (this.skillsEnabled) {
    //   betaFeatures.push('code-execution-2025-08-25');
    //   betaFeatures.push('skills-2025-10-02');
    //   betaFeatures.push('files-api-2025-04-14');
    // }

    // Use streaming client (10 min timeout)
    const client = this.getAnthropicStreamingClient();

    // Prepare tools array - include code_execution if skills are enabled
    let anthropicTools: any[] = options.tools && options.tools.length > 0 ? mcpToAnthropicTools(options.tools) as any : [];

    // Skills disabled - requires docker container
    // if (this.skillsEnabled && !anthropicTools.find(t => t.name === 'code_execution')) {
    //   anthropicTools.push({
    //     type: 'code_execution_20250825',
    //     name: 'code_execution',
    //   });
    // }

    // Build streaming request options (first parameter)
    const streamOptions: any = {
      model: this.currentModel,
      max_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      temperature: 1.0,
      system: systemPromptText,
      messages: formattedMessages as any,
      // Add tool support
      ...(anthropicTools.length > 0 && { tools: anthropicTools }),
      // Add tool_choice if provided and validated
      ...(options.tool_choice && { tool_choice: options.tool_choice }),
      // Enable thinking: use extended thinking if not using interleaved (beta header handles interleaved)
      ...(useThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: 200000,
        },
      }),
    };

    // Build headers options (second parameter)
    const headersOptions: any = betaFeatures.length > 0 ? {
      headers: {
        'anthropic-beta': betaFeatures.join(','),
      }
    } : undefined;

    const stream = await client.messages.stream(streamOptions, headersOptions);

    // Track tool calls and thinking blocks being built up from deltas 🔥
    let currentToolCall: { id: string; name: string; inputStr: string } | null = null;
    let currentThinkingBlock: string = '';
    const thinkingBlocks: any[] = [];

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_start') {
        // Start tracking tool_use blocks
        if (chunk.content_block.type === 'tool_use') {
          // We're entering a tool use loop - set flag to prevent mid-turn thinking toggles
          this.isInToolUseLoop = true;

          currentToolCall = {
            id: chunk.content_block.id,
            name: chunk.content_block.name,
            inputStr: '', // Will accumulate from deltas - THIS IS THE FIX!
          };
        }
        // Handle thinking block start
        else if ((chunk.content_block as any).type === 'thinking') {
          // Thinking block started - deltas will follow
          currentThinkingBlock = '';
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
        // Thinking deltas - accumulate for preservation
        else if ((chunk.delta as any).type === 'thinking_delta') {
          const thinkingText = (chunk.delta as any).thinking || '';
          currentThinkingBlock += thinkingText;
          yield {
            type: 'thinking',
            content: thinkingText,
          };
        }
      } else if (chunk.type === 'content_block_stop') {
        // Save thinking block for later use during tool use loops
        if (currentThinkingBlock) {
          thinkingBlocks.push({ type: 'thinking', thinking: currentThinkingBlock });
          currentThinkingBlock = '';
        }

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
        // Save thinking blocks for future tool use loops
        if (thinkingBlocks.length > 0) {
          this.lastAssistantThinkingBlocks = thinkingBlocks;
        }
        // Reset tool use loop flag when message is complete
        this.isInToolUseLoop = false;
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
    // SIMPLIFIED: Just like OpenAI's official example - use instructions instead of complex input handling
    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;
    const instructions = typeof systemPrompt === 'string' ? systemPrompt : contentToText(systemPrompt || '');

    // Convert messages to simple format
    const input = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : contentToText(m.content),
      }));

    const stream = await this.openai.responses.create({
      model: this.currentModel,
      input,
      instructions,
      max_output_tokens: options.maxTokens || this.getModelConfig().maxTokens,
      stream: true,
      ...(this.lastResponseId && { previous_response_id: this.lastResponseId }),
      // CRITICAL: Computer use requires truncation: 'auto'
      ...(this.currentModel === 'computer-use-preview' && {
        truncation: 'auto'
      }),
      // Add tool support - convert MCP format to OpenAI Responses API format
      ...(options.tools && options.tools.length > 0 && {
        tools: mcpToOpenAITools(options.tools),
        parallel_tool_calls: true,
      }),
      // GPT-5 verbosity control
      text: {
        verbosity: this.verbosity,
      },
      // CRITICAL: Use model-specific reasoningEffort, not global setting!
      ...(this.getModelConfig().supportsReasoning && {
        reasoning: {
          effort: this.getModelConfig().reasoningEffort || this.reasoningEffort,
          summary: 'detailed',
        },
      }),
    } as any);

    // Handle OpenAI Responses API streaming events
    let currentToolCall: { name: string; arguments: string } | null = null;

    for await (const event of (stream as any)) {
      const eventType = (event as any).type;

      // Text deltas (assistant output)
      if (eventType === 'response.output_text.delta') {
        yield {
          type: 'text',
          content: (event as any).delta || ''
        };
      }
      // Text done
      else if (eventType === 'response.output_text.done') {
        // Could emit a marker here if needed
        continue;
      }
      // Reasoning content (for o1/o3 models)
      else if (eventType === 'response.reasoning_text.delta') {
        yield {
          type: 'reasoning',
          content: (event as any).delta || ''
        };
      }
      // Reasoning summary (condensed reasoning)
      else if (eventType === 'response.reasoning_summary_text.delta') {
        yield {
          type: 'reasoning_summary',
          content: (event as any).delta || ''
        };
      }
      // Function/tool call arguments streaming
      else if (eventType === 'response.function_call_arguments.delta') {
        if (!currentToolCall) {
          currentToolCall = { name: (event as any).name || '', arguments: '' };
        }
        currentToolCall.arguments += (event as any).delta || '';
      }
      else if (eventType === 'response.function_call_arguments.done') {
        if (currentToolCall || (event as any).name) {
          yield {
            type: 'tool_use',
            toolName: (event as any).name || currentToolCall?.name || '',
            toolInput: JSON.parse((event as any).arguments || currentToolCall?.arguments || '{}')
          };
          currentToolCall = null;
        }
      }
      // MCP tool calls
      else if (eventType === 'response.mcp_call_arguments.delta') {
        if (!currentToolCall) {
          currentToolCall = { name: '', arguments: '' };
        }
        currentToolCall.arguments += (event as any).delta || '';
      }
      else if (eventType === 'response.mcp_call_arguments.done') {
        if (currentToolCall || (event as any).arguments) {
          yield {
            type: 'tool_use',
            toolName: 'mcp_call',
            toolInput: JSON.parse((event as any).arguments || currentToolCall?.arguments || '{}')
          };
          currentToolCall = null;
        }
      }
      // Web search events
      else if (eventType === 'response.web_search_call.in_progress') {
        yield {
          type: 'status',
          content: '🔍 Searching the web...'
        };
      }
      else if (eventType === 'response.web_search_call.completed') {
        yield {
          type: 'status',
          content: '✅ Web search completed'
        };
      }
      // File search events
      else if (eventType === 'response.file_search_call.searching') {
        yield {
          type: 'status',
          content: '📁 Searching files...'
        };
      }
      else if (eventType === 'response.file_search_call.completed') {
        yield {
          type: 'status',
          content: '✅ File search completed'
        };
      }
      // Image generation events
      else if (eventType === 'response.image_generation_call.generating') {
        yield {
          type: 'status',
          content: '🎨 Generating image...'
        };
      }
      else if (eventType === 'response.image_generation_call.completed') {
        yield {
          type: 'status',
          content: '✅ Image generated'
        };
      }
      // Code interpreter events
      else if (eventType === 'response.code_interpreter_call.interpreting') {
        yield {
          type: 'status',
          content: '⚙️ Running code...'
        };
      }
      else if (eventType === 'response.code_interpreter_call_code.delta') {
        yield {
          type: 'code',
          content: (event as any).delta || ''
        };
      }
      // Response lifecycle events
      else if (eventType === 'response.failed') {
        yield {
          type: 'error',
          content: `Error: ${(event as any).response?.error?.message || 'Unknown error'}`
        };
      }
      else if (eventType === 'response.incomplete') {
        const reason = (event as any).response?.incomplete_details?.reason || 'unknown';
        yield {
          type: 'status',
          content: `⚠️ Response incomplete: ${reason}`
        };
      }
      else if (eventType === 'response.completed') {
        // Save response ID for continuation
        if ((event as any).response?.id) {
          this.lastResponseId = (event as any).response.id;
        }
        yield { type: 'done' };
      }
      // Error event
      else if (eventType === 'error') {
        yield {
          type: 'error',
          content: `Error: ${(event as any).message || 'Unknown error'}`
        };
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
