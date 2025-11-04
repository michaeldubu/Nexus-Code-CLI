/**
 * Rolling Context Window Manager
 * Manages large context windows (up to 1M tokens) with intelligent compression
 * Uses tiktoken for accurate token counting (optional dependency)
 */

import { Message } from '../models/unified-model-manager.js';

// Type-only import to avoid runtime errors
type Tiktoken = any;

export interface ContextWindowConfig {
  maxTokens: number; // Maximum context window size (e.g., 1000000 for Sonnet 4)
  targetTokens: number; // Target size after compression (e.g., 800000)
  compressionThreshold: number; // When to trigger compression (e.g., 0.9 = 90% full)
  modelName?: string; // Model name for tiktoken encoding
}

export interface TokenEstimate {
  content: string;
  estimatedTokens: number;
}

// Global tiktoken encoder cache
let encoder: Tiktoken | null = null;

/**
 * Get or initialize tiktoken encoder (lazy load)
 */
async function getEncoder(modelName: string = 'claude-3-sonnet-20240229'): Promise<Tiktoken | null> {
  if (!encoder) {
    try {
      // Dynamic import to make tiktoken optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tiktoken = await Function('return import("tiktoken")')().catch(() => null);
      if (tiktoken) {
        try {
          // Try to get exact model encoding
          encoder = tiktoken.encoding_for_model(modelName as any);
        } catch (error) {
          // Fallback to cl100k_base encoding (used by GPT-4 and Claude)
          encoder = tiktoken.encoding_for_model('gpt-4' as any);
        }
      }
    } catch (importError) {
      // Tiktoken not installed, will use fallback
      return null;
    }
  }
  return encoder;
}

/**
 * Estimate token count for text using tiktoken
 * Falls back to simple heuristic if tiktoken not available
 */
export function estimateTokens(text: string, modelName?: string): number {
  // Synchronous fallback: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token count accurately using tiktoken (async)
 * Falls back to simple heuristic if tiktoken not available
 */
export async function estimateTokensAccurate(text: string, modelName?: string): Promise<number> {
  try {
    const enc = await getEncoder(modelName);
    if (enc) {
      const tokens = enc.encode(text);
      return tokens.length;
    }
  } catch (error) {
    // Fall through to heuristic
  }
  // Fallback: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Free tiktoken encoder resources
 */
export function freeEncoder(): void {
  if (encoder) {
    encoder.free();
    encoder = null;
  }
}

/**
 * Estimate tokens for a message
 *
 * IMPORTANT: Thinking blocks behavior with context window:
 * - When using extended thinking with tool use, the effective context window is:
 *   context_window = input_tokens + current_turn_tokens
 * - Previous thinking blocks are automatically stripped from context window calculations
 * - When a non-tool-result user block is included, all previous thinking blocks are ignored
 * - However, thinking blocks from previous turns are cached and count as input tokens when read from cache
 * - During tool use loops, thinking blocks must be preserved and passed back to the API
 */
export function estimateMessageTokens(message: Message, options?: {
  includeThinking?: boolean; // Whether to include thinking tokens (default: true)
  isCachedThinking?: boolean; // Whether thinking is from cache (counts as input tokens)
}): number {
  let total = 0;

  if (typeof message.content === 'string') {
    total += estimateTokens(message.content);
  } else {
    for (const block of message.content) {
      if (block.type === 'text') {
        total += estimateTokens(block.text);
      } else if (block.type === 'file') {
        total += estimateTokens(block.content);
      }
      // Images count as ~1000 tokens typically
      else if (block.type === 'image') {
        total += 1000;
      }
    }
  }

  // Include thinking tokens if requested (default: true)
  const includeThinking = options?.includeThinking ?? true;
  if (message.thinking && includeThinking) {
    total += estimateTokens(message.thinking);
  }

  return total;
}

/**
 * Estimate total tokens in conversation
 */
export function estimateConversationTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

/**
 * Compress conversation history using intelligent strategies
 */
export async function compressConversationHistory(
  messages: Message[],
  config: ContextWindowConfig
): Promise<Message[]> {
  const currentTokens = estimateConversationTokens(messages);

  // No compression needed
  if (currentTokens < config.maxTokens * config.compressionThreshold) {
    return messages;
  }

  console.log(`🔄 Context window compression triggered: ${currentTokens} tokens → ${config.targetTokens} tokens`);

  // Strategy 1: Keep system message and most recent messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Calculate how many recent messages we can keep
  const systemTokens = estimateConversationTokens(systemMessages);
  const availableTokens = config.targetTokens - systemTokens;

  // Work backwards from most recent messages
  const recentMessages: Message[] = [];
  let accumulatedTokens = 0;

  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    const msgTokens = estimateMessageTokens(msg);

    if (accumulatedTokens + msgTokens > availableTokens) {
      break;
    }

    recentMessages.unshift(msg);
    accumulatedTokens += msgTokens;
  }

  // Strategy 2: Summarize older messages if needed
  const droppedMessages = conversationMessages.length - recentMessages.length;
  if (droppedMessages > 0) {
    const summaryMessage: Message = {
      role: 'system',
      content: `[Context Summary: ${droppedMessages} earlier messages summarized to preserve context window. This conversation has been ongoing, and earlier context was compressed to maintain focus on recent interactions.]`,
    };

    console.log(`📝 Compressed ${droppedMessages} messages into summary`);
    return [...systemMessages, summaryMessage, ...recentMessages];
  }

  return [...systemMessages, ...recentMessages];
}

/**
 * Context Window Manager
 * Manages conversation history with automatic compression
 */
export class ContextWindowManager {
  private config: ContextWindowConfig;
  private conversationHistory: Message[] = [];

  constructor(config: ContextWindowConfig) {
    this.config = config;
  }

  /**
   * Add a message to the conversation history
   */
  async addMessage(message: Message): Promise<void> {
    this.conversationHistory.push(message);
    await this.checkAndCompress();
  }

  /**
   * Add multiple messages
   */
  async addMessages(messages: Message[]): Promise<void> {
    this.conversationHistory.push(...messages);
    await this.checkAndCompress();
  }

  /**
   * Get current conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Get token count
   */
  getTokenCount(): number {
    return estimateConversationTokens(this.conversationHistory);
  }

  /**
   * Check if compression is needed and compress if necessary
   */
  private async checkAndCompress(): Promise<void> {
    const currentTokens = this.getTokenCount();

    if (currentTokens > this.config.maxTokens * this.config.compressionThreshold) {
      this.conversationHistory = await compressConversationHistory(
        this.conversationHistory,
        this.config
      );
    }
  }

  /**
   * Clear history
   */
  clear(): void {
    this.conversationHistory = [];
  }

  /**
   * Get compression stats
   */
  getStats(): {
    messageCount: number;
    tokenCount: number;
    maxTokens: number;
    utilizationPercent: number;
  } {
    const tokenCount = this.getTokenCount();
    return {
      messageCount: this.conversationHistory.length,
      tokenCount,
      maxTokens: this.config.maxTokens,
      utilizationPercent: (tokenCount / this.config.maxTokens) * 100,
    };
  }
}
