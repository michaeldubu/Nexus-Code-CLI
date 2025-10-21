/**
 * Multi-Model Team Types
 * For real collaborative AI - no corporate bullshit 🔥
 */

export type ModelProvider = 'anthropic' | 'openai';
export type ConversationMode = 'parallel' | 'sequential';

export interface ParticipantConfig {
  id: string; // e.g., "haiku-4-5", "sonnet-4-5", "gpt-5"
  name: string; // Display name e.g., "Haiku 4.5"
  provider: ModelProvider;
  model: string; // Full model ID
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  // OpenAI-specific options
  transport?: 'responses' | 'chat'; // For OpenAI
  reasoning?: { effort?: 'low' | 'medium' | 'high' };
}

export interface TeamConfig {
  mode: ConversationMode;
  participants: ParticipantConfig[];
  contextManagement: {
    claudeLimit: number; // ~150000
    gptLimit: number; // ~128000
    pruneAmount: number; // How many messages to remove at once
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  attribution?: string; // Which model said it
  timestamp: string;
  model?: string;
  thinking?: string; // For extended thinking
}

export interface RateLimitState {
  lastRequest: number;
  requestCount: number;
  isThrottled: boolean;
  backoffUntil: number;
  consecutiveErrors: number;
}

export interface SetupProgress {
  step: 'claude-selection' | 'gpt-selection' | 'mode-selection' | 'complete';
  claudeModels: { model: string; count: number }[];
  gptModels: { model: string; count: number }[];
  mode?: ConversationMode;
}
