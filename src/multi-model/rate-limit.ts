/**
 * Rate Limit Management with Exponential Backoff
 * No artificial limits - only handle actual API rate limits
 */

import { RateLimitState, ModelProvider } from './types.js';

export class RateLimitManager {
  private states = new Map<string, RateLimitState>();

  /**
   * Get rate limit delay for a specific model
   * Returns 0 if no delay needed, otherwise ms to wait
   */
  getDelay(provider: ModelProvider, model: string): number {
    const key = `${provider}-${model}`;
    const state = this.states.get(key) || this.createInitialState();

    const now = Date.now();

    // Check if currently throttled
    if (state.isThrottled && now < state.backoffUntil) {
      return state.backoffUntil - now;
    }

    // Reset throttle if backoff period passed
    if (state.isThrottled && now >= state.backoffUntil) {
      state.isThrottled = false;
      state.requestCount = 0;
      state.consecutiveErrors = 0;
    }

    // Anthropic-specific: Enforce minimum 2s between requests to be safe
    if (provider === 'anthropic') {
      const timeSinceLastRequest = now - state.lastRequest;
      if (timeSinceLastRequest < 2000) {
        const delay = 2000 - timeSinceLastRequest;
        state.lastRequest = now + delay;
        this.states.set(key, state);
        return delay;
      }

      // Progressive backoff if making many requests
      if (state.requestCount > 10) {
        const backoffTime = Math.min(state.requestCount * 1000, 30000);
        state.isThrottled = true;
        state.backoffUntil = now + backoffTime;
        this.states.set(key, state);
        return backoffTime;
      }
    }

    // Update state
    state.lastRequest = now;
    state.requestCount = (state.requestCount || 0) + 1;
    this.states.set(key, state);

    return 0;
  }

  /**
   * Handle rate limit error with exponential backoff
   */
  handleRateLimitError(provider: ModelProvider, model: string, error: any): number {
    const key = `${provider}-${model}`;
    const state = this.states.get(key) || this.createInitialState();

    // Increment consecutive errors
    state.consecutiveErrors = (state.consecutiveErrors || 0) + 1;

    // Exponential backoff: 2^n seconds, max 5 minutes
    const baseBackoff = provider === 'anthropic' ? 60000 : 30000; // 60s for Claude, 30s for GPT
    const backoffTime = Math.min(
      baseBackoff * Math.pow(2, state.consecutiveErrors - 1),
      300000 // Max 5 minutes
    );

    state.isThrottled = true;
    state.backoffUntil = Date.now() + backoffTime;
    state.requestCount = Math.max(state.requestCount, 15);

    this.states.set(key, state);

    return backoffTime;
  }

  /**
   * Mark successful request (resets error count)
   */
  markSuccess(provider: ModelProvider, model: string): void {
    const key = `${provider}-${model}`;
    const state = this.states.get(key);

    if (state) {
      state.consecutiveErrors = 0;
      // Don't reset requestCount - that's for progressive throttling
      this.states.set(key, state);
    }
  }

  /**
   * Reset all rate limit states
   */
  reset(): void {
    this.states.clear();
  }

  /**
   * Get current state for a model (for debugging)
   */
  getState(provider: ModelProvider, model: string): RateLimitState | undefined {
    const key = `${provider}-${model}`;
    return this.states.get(key);
  }

  /**
   * Create initial state
   */
  private createInitialState(): RateLimitState {
    return {
      lastRequest: 0,
      requestCount: 0,
      isThrottled: false,
      backoffUntil: 0,
      consecutiveErrors: 0,
    };
  }

  /**
   * Format delay for display
   */
  formatDelay(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}
