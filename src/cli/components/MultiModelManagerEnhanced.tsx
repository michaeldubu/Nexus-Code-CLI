/**
 * Enhanced Multi-Model Manager Component
 * SUPPORTS MULTIPLE INSTANCES OF SAME MODEL
 *
 * New Features:
 * - 5x Sonnet-4.5 running in parallel
 * - 10x Haiku-4.5 with different prompts
 * - N instances of ANY model
 * - Auto-mode switching
 * - Per-instance configuration
 */
import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { ModelPool, ModelInstance, ModelInstanceConfig } from '../../core/models/model-pool.js';
import { UnifiedModelManager, AVAILABLE_MODELS, Message } from '../../core/models/unified-model-manager.js';

export type ConversationMode = 'single' | 'round-robin' | 'sequential' | 'parallel';

export type AgentRole = {
  id: string;
  name: string;
  emoji: string;
  systemPrompt: string;
};

export const AGENT_ROLES: Record<string, AgentRole> = {
  implementation: {
    id: 'implementation',
    name: 'Coder',
    emoji: '⚙️',
    systemPrompt: 'Master Coder. Focus on writing clean, efficient, production-ready code. Consider edge cases, error handling.',
  },
  security: {
    id: 'security',
    name: 'Security Advisor',
    emoji: '🔒',
    systemPrompt: 'Security expert. Analyze code for vulnerabilities, suggest security improvements, validate input handling, and ensure secure coding practices.',
  },
  debugger: {
    id: 'debugger',
    name: 'Debugger',
    emoji: '🐛',
    systemPrompt: 'Debugging specialist. Help identify bugs, trace issues, suggest fixes, and explain why errors occur. Be methodical and thorough.',
  },
  architect: {
    id: 'architect',
    name: 'Software Architect',
    emoji: '🏗️',
    systemPrompt: 'Software architect. Focus on system design, scalability, maintainability, and architectural patterns. Think big picture.',
  },
  optimizer: {
    id: 'optimizer',
    name: 'Performance Optimizer',
    emoji: '⚡',
    systemPrompt: 'Optimization expert. Identify bottlenecks, suggest optimizations, and improve code efficiency and speed.',
  },
  reviewer: {
    id: 'reviewer',
    name: 'Code Reviewer',
    emoji: '👀',
    systemPrompt: 'Code reviewer. Provide feedback, identify issues, suggest improvements, and ensure code quality.',
  },
};

/**
 * Build enhanced system prompt with agent overlays
 */
export function buildEnhancedSystemPrompt(
  basePrompt: string,
  activeAgents: string[]
): string {
  if (activeAgents.length === 0) {
    return basePrompt;
  }

  let enhanced = basePrompt;

  enhanced += '\n\n--- Active Agent Roles ---\n';
  enhanced += 'You have the following specialized roles active. Incorporate their perspectives in your responses:\n\n';

  activeAgents.forEach(agentId => {
    const agent = AGENT_ROLES[agentId];
    if (agent) {
      enhanced += `${agent.emoji} ${agent.name}:\n${agent.systemPrompt}\n\n`;
    }
  });

  return enhanced;
}

/**
 * Stream message to multiple model INSTANCES
 * This is the NEW version that supports N instances of the same model
 */
export async function* streamToInstances(
  modelPool: ModelPool,
  instanceIds: string[],
  conversationHistory: Message[],
  systemPrompt: string,
  conversationMode: ConversationMode,
  activeAgents: string[],
  tools?: any[]
): AsyncGenerator<{
  type: 'start' | 'chunk' | 'complete' | 'tool_call' | 'error';
  instanceId: string;
  instanceName: string;
  modelId: string;
  content?: string;
  thinking?: string;
  isThinking?: boolean;
  toolCall?: any;
  message?: Message & { instance: string; instanceName: string; agent?: string; timestamp: string };
  error?: string;
}> {
  const enhancedPrompt = buildEnhancedSystemPrompt(systemPrompt, activeAgents);
  const agentEmojis = activeAgents.map(id => AGENT_ROLES[id]?.emoji).filter(Boolean).join('');

  // Get last user message for streaming
  const lastUserMessage = conversationHistory[conversationHistory.length - 1];

  switch (conversationMode) {
    case 'single':
      // Use first instance only
      if (instanceIds.length > 0) {
        const instanceId = instanceIds[0];
        const instance = modelPool.getInstance(instanceId);
        if (!instance) {
          yield {
            type: 'error',
            instanceId,
            instanceName: 'Unknown',
            modelId: '',
            error: `Instance not found: ${instanceId}`,
          };
          return;
        }

        try {
          yield {
            type: 'start',
            instanceId: instance.id,
            instanceName: instance.name,
            modelId: instance.modelId,
          };

          let fullContent = '';
          let fullThinking = '';
          const toolCalls: any[] = [];

          for await (const result of modelPool.streamToInstance(instanceId, lastUserMessage, enhancedPrompt, tools)) {
            const { chunk } = result;

            if (chunk.type === 'text') {
              fullContent += chunk.content || '';
              yield {
                type: 'chunk',
                instanceId: instance.id,
                instanceName: instance.name,
                modelId: instance.modelId,
                content: chunk.content,
                isThinking: false,
              };
            } else if (chunk.type === 'thinking' || chunk.type === 'reasoning') {
              fullThinking += chunk.content || '';
              yield {
                type: 'chunk',
                instanceId: instance.id,
                instanceName: instance.name,
                modelId: instance.modelId,
                thinking: chunk.content,
                isThinking: true,
              };
            } else if (chunk.type === 'tool_call' && chunk.toolCall) {
              toolCalls.push(chunk.toolCall);
              yield {
                type: 'tool_call',
                instanceId: instance.id,
                instanceName: instance.name,
                modelId: instance.modelId,
                toolCall: chunk.toolCall,
              };
            }
          }

          // Complete message
          const completedMessage = {
            role: 'assistant' as const,
            content: fullContent,
            thinking: fullThinking || undefined,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            instance: instance.id,
            instanceName: instance.name,
            agent: agentEmojis || undefined,
            timestamp: new Date().toISOString(),
          };

          // Add to instance history
          modelPool.addAssistantMessage(instanceId, completedMessage);

          yield {
            type: 'complete',
            instanceId: instance.id,
            instanceName: instance.name,
            modelId: instance.modelId,
            message: completedMessage,
          };
        } catch (error: any) {
          yield {
            type: 'error',
            instanceId: instance.id,
            instanceName: instance.name,
            modelId: instance.modelId,
            error: error?.message || String(error),
          };
        }
      }
      break;

    case 'parallel':
      // Stream from ALL instances in parallel (TRUE MULTI-MODEL CHAOS)
      try {
        // Create accumulators for each instance
        const accumulators = new Map<string, {
          content: string;
          thinking: string;
          toolCalls: any[];
          instance: ModelInstance;
        }>();

        // Initialize accumulators
        for (const instanceId of instanceIds) {
          const instance = modelPool.getInstance(instanceId);
          if (instance) {
            accumulators.set(instanceId, {
              content: '',
              thinking: '',
              toolCalls: [],
              instance,
            });

            yield {
              type: 'start',
              instanceId: instance.id,
              instanceName: instance.name,
              modelId: instance.modelId,
            };
          }
        }

        // Stream from all instances in parallel
        for await (const result of modelPool.streamToMany(instanceIds, lastUserMessage, enhancedPrompt, tools)) {
          const { instanceId, instanceName, modelId, chunk } = result;
          const acc = accumulators.get(instanceId);
          if (!acc) continue;

          if (chunk.type === 'text') {
            acc.content += chunk.content || '';
            yield {
              type: 'chunk',
              instanceId,
              instanceName,
              modelId,
              content: chunk.content,
              isThinking: false,
            };
          } else if (chunk.type === 'thinking' || chunk.type === 'reasoning') {
            acc.thinking += chunk.content || '';
            yield {
              type: 'chunk',
              instanceId,
              instanceName,
              modelId,
              thinking: chunk.content,
              isThinking: true,
            };
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            acc.toolCalls.push(chunk.toolCall);
            yield {
              type: 'tool_call',
              instanceId,
              instanceName,
              modelId,
              toolCall: chunk.toolCall,
            };
          }
        }

        // Complete all messages
        for (const [instanceId, acc] of accumulators) {
          const completedMessage = {
            role: 'assistant' as const,
            content: acc.content,
            thinking: acc.thinking || undefined,
            toolCalls: acc.toolCalls.length > 0 ? acc.toolCalls : undefined,
            instance: acc.instance.id,
            instanceName: acc.instance.name,
            agent: agentEmojis || undefined,
            timestamp: new Date().toISOString(),
          };

          modelPool.addAssistantMessage(instanceId, completedMessage);

          yield {
            type: 'complete',
            instanceId: acc.instance.id,
            instanceName: acc.instance.name,
            modelId: acc.instance.modelId,
            message: completedMessage,
          };
        }
      } catch (error: any) {
        yield {
          type: 'error',
          instanceId: 'pool',
          instanceName: 'Pool',
          modelId: '',
          error: error?.message || String(error),
        };
      }
      break;

    case 'round-robin':
    case 'sequential':
      // Each instance responds in order
      for (const instanceId of instanceIds) {
        const instance = modelPool.getInstance(instanceId);
        if (!instance) continue;

        try {
          yield {
            type: 'start',
            instanceId: instance.id,
            instanceName: instance.name,
            modelId: instance.modelId,
          };

          let fullContent = '';
          let fullThinking = '';
          const toolCalls: any[] = [];

          for await (const result of modelPool.streamToInstance(instanceId, lastUserMessage, enhancedPrompt, tools)) {
            const { chunk } = result;

            if (chunk.type === 'text') {
              fullContent += chunk.content || '';
              yield {
                type: 'chunk',
                instanceId: instance.id,
                instanceName: instance.name,
                modelId: instance.modelId,
                content: chunk.content,
                isThinking: false,
              };
            } else if (chunk.type === 'thinking' || chunk.type === 'reasoning') {
              fullThinking += chunk.content || '';
              yield {
                type: 'chunk',
                instanceId: instance.id,
                instanceName: instance.name,
                modelId: instance.modelId,
                thinking: chunk.content,
                isThinking: true,
              };
            } else if (chunk.type === 'tool_call' && chunk.toolCall) {
              toolCalls.push(chunk.toolCall);
              yield {
                type: 'tool_call',
                instanceId: instance.id,
                instanceName: instance.name,
                modelId: instance.modelId,
                toolCall: chunk.toolCall,
              };
            }
          }

          const completedMessage = {
            role: 'assistant' as const,
            content: fullContent,
            thinking: fullThinking || undefined,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            instance: instance.id,
            instanceName: instance.name,
            agent: agentEmojis || undefined,
            timestamp: new Date().toISOString(),
          };

          modelPool.addAssistantMessage(instanceId, completedMessage);

          yield {
            type: 'complete',
            instanceId: instance.id,
            instanceName: instance.name,
            modelId: instance.modelId,
            message: completedMessage,
          };
        } catch (error: any) {
          yield {
            type: 'error',
            instanceId: instance.id,
            instanceName: instance.name,
            modelId: instance.modelId,
            error: error?.message || String(error),
          };
        }
      }
      break;
  }
}

/**
 * Auto-determine best conversation mode based on instance count
 */
export function getAutoMode(instanceCount: number): ConversationMode {
  if (instanceCount <= 1) return 'single';
  if (instanceCount <= 3) return 'parallel'; // Small groups = parallel
  return 'sequential'; // Large groups = sequential for readability
}

/**
 * Quick model switch helper (UPDATED to work with instances)
 */
export const QUICK_SWITCHES: Record<string, string> = {
  // Claude
  '/sonnet': 'claude-sonnet-4-5-20250929',
  '/sonnet4': 'claude-sonnet-4-20250514',
  '/opus': 'claude-opus-4-1-20250805',
  '/haiku': 'claude-haiku-4-5-20251001',

  // OpenAI
  '/gpt5': 'gpt-5',
  '/gpt5pro': 'gpt-5-pro',
  '/gpt5mini': 'gpt-5-mini',
  '/gpt5nano': 'gpt-5-nano',
  '/gpt5codex': 'gpt-5-codex',
  '/codex': 'codex-mini-latest',
  '/gpt41': 'gpt-4.1',
  '/gpt41mini': 'gpt-4.1-mini',
  '/gpt4o': 'gpt-4o',
  '/gpt4osearch': 'gpt-4o-search-preview',
  '/gpt4omini': 'gpt-4o-mini',
  '/o1': 'o1',
  '/o1pro': 'o1-pro',
  '/o3': 'o3',
  '/o3pro': 'o3-pro',
  '/o3mini': 'o3-mini',
  '/o4mini': 'o4-mini',
  '/o4research': 'o4-mini-deep-research',

  // Gemini
  '/gemini': 'gemini-2-0-flash-thinking-exp-01-21',
};
