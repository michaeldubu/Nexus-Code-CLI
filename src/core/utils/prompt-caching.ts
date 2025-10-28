/**
 * Prompt Caching Utilities
 * Reduces costs and latency by caching frequently used context
 * Uses Anthropic's cache_control feature
 */

import { Message, ContentBlock } from '../models/unified-model-manager.js';

/**
 * Content block with cache control
 */
export type CachedContentBlock = ContentBlock & {
  cache_control?: {
    type: 'ephemeral';
  };
};

/**
 * System message with cache control
 */
export interface CachedSystemMessage {
  type: 'text';
  text: string;
  cache_control?: {
    type: 'ephemeral';
  };
}

/**
 * Add cache control to a content block
 */
export function addCacheControl(block: ContentBlock): CachedContentBlock {
  return {
    ...block,
    cache_control: {
      type: 'ephemeral',
    },
  };
}

/**
 * Add cache control to system prompt
 */
export function addSystemCacheControl(systemPrompt: string): CachedSystemMessage[] {
  return [
    {
      type: 'text',
      text: systemPrompt,
      cache_control: {
        type: 'ephemeral',
      },
    },
  ];
}

/**
 * Strategy: Cache system prompts and tool definitions
 * These rarely change and are perfect candidates for caching
 */
export function enablePromptCaching(
  systemPrompt: string | undefined,
  messages: Message[]
): {
  system: CachedSystemMessage[] | string;
  messages: Message[];
} {
  // If no system prompt, return as-is
  if (!systemPrompt) {
    return {
      system: systemPrompt || '',
      messages,
    };
  }

  // Add cache control to system prompt
  const cachedSystem = addSystemCacheControl(systemPrompt);

  // Optionally cache early conversation context
  // Strategy: Cache the first few messages (common context)
  const cachedMessages: Message[] = messages.map((msg, idx) => {
    // Cache the first 2 user messages (common setup context)
    if (idx < 2 && msg.role === 'user' && typeof msg.content !== 'string') {
      return {
        ...msg,
        content: msg.content.map((block, blockIdx) =>
          blockIdx === msg.content.length - 1 ? addCacheControl(block) as ContentBlock : block
        ) as ContentBlock[],
      } as Message;
    }
    return msg;
  });

  return {
    system: cachedSystem,
    messages: cachedMessages,
  };
}

/**
 * Calculate estimated cache savings
 * Cache hits reduce both cost and latency
 */
export function estimateCacheSavings(
  systemPromptTokens: number,
  cachedContextTokens: number,
  requestCount: number
): {
  totalTokensSaved: number;
  costSavingsPercent: number;
  latencySavingsMs: number;
} {
  // Cached tokens cost 10% of regular tokens
  const cacheCostMultiplier = 0.1;

  // First request: full cost
  // Subsequent requests: only cache refresh cost
  const regularCost = (systemPromptTokens + cachedContextTokens) * requestCount;
  const cachedCost = (systemPromptTokens + cachedContextTokens) +
                     (systemPromptTokens + cachedContextTokens) * cacheCostMultiplier * (requestCount - 1);

  const totalTokensSaved = regularCost - cachedCost;
  const costSavingsPercent = (totalTokensSaved / regularCost) * 100;

  // Cache hits are ~2x faster (rough estimate)
  const latencySavingsMs = (requestCount - 1) * 500; // ~500ms per cache hit

  return {
    totalTokensSaved,
    costSavingsPercent,
    latencySavingsMs,
  };
}

/**
 * Prompt Caching Manager
 * Tracks cache usage and provides analytics
 */
export class PromptCachingManager {
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private totalTokensCached: number = 0;

  /**
   * Record a cache hit
   */
  recordCacheHit(tokens: number): void {
    this.cacheHits++;
    this.totalTokensCached += tokens;
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    totalTokensCached: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
      totalTokensCached: this.totalTokensCached,
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalTokensCached = 0;
  }
}
