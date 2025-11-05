/**
 * Multi-Model Manager Component
 * Adds multi-model capabilities on top of existing UnifiedModelManager
 */
import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
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

export type MultiModelState = {
  activeModels: string[];
  activeAgents: string[];
  conversationMode: ConversationMode;
};

export type MultiModelManagerProps = {
  modelManager: UnifiedModelManager;
  baseSystemPrompt: string;
  onStateChange?: (state: MultiModelState) => void;
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
 * Stream message to multiple models based on conversation mode
 * Yields chunks as they come in for live updates!
 */
export async function* streamMultiModelMessage(
  modelManager: UnifiedModelManager,
  activeModels: string[],
  conversationHistory: Message[],
  systemPrompt: string,
  conversationMode: ConversationMode,
  activeAgents: string[],
  tools?: any[]
): AsyncGenerator<{
  type: 'start' | 'chunk' | 'complete' | 'tool_call';
  modelId: string;
  modelName: string;
  content?: string;
  thinking?: string;
  isThinking?: boolean;
  toolCall?: any;
  message?: Message & { model: string; agent?: string; timestamp: string };
}> {
  const enhancedPrompt = buildEnhancedSystemPrompt(systemPrompt, activeAgents);
  const agentEmojis = activeAgents.map(id => AGENT_ROLES[id]?.emoji).filter(Boolean).join('');

  switch (conversationMode) {
    case 'single':
      // Stream from first model only
      if (activeModels.length > 0) {
        const modelId = activeModels[0];
        const modelName = AVAILABLE_MODELS[modelId]?.name || modelId;
        // Only switch if different model - prevents resetting thinking state
        if (modelManager.getCurrentModel() !== modelId) {
          modelManager.setModel(modelId);
        }

        yield { type: 'start', modelId, modelName };

        let fullContent = '';
        let fullThinking = '';

        for await (const chunk of modelManager.streamMessage(conversationHistory, { systemPrompt: enhancedPrompt, tools })) {
          if (chunk.type === 'text') {
            fullContent += chunk.content;
            yield {
              type: 'chunk',
              modelId,
              modelName,
              content: chunk.content,
              isThinking: false,
            };
          } else if (chunk.type === 'thinking' || chunk.type === 'reasoning') {
            fullThinking += chunk.content;
            yield {
              type: 'chunk',
              modelId,
              modelName,
              thinking: chunk.content,
              isThinking: true,
            };
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            yield {
              type: 'tool_call',
              modelId,
              modelName,
              toolCall: chunk.toolCall,
            };
          }
        }

        yield {
          type: 'complete',
          modelId,
          modelName,
          message: {
            role: 'assistant',
            content: fullContent,
            thinking: fullThinking || undefined,
            model: modelName,
            agent: agentEmojis || undefined,
            timestamp: new Date().toISOString(),
          },
        };
      }
      break;

    case 'round-robin':
      // Each model streams in order, seeing previous complete responses
      let workingHistory = [...conversationHistory];
      for (const modelId of activeModels) {
        const modelName = AVAILABLE_MODELS[modelId]?.name || modelId;
        // Only switch if different model - prevents resetting thinking state
        if (modelManager.getCurrentModel() !== modelId) {
          modelManager.setModel(modelId);
        }

        yield { type: 'start', modelId, modelName };

        let fullContent = '';
        let fullThinking = '';

        for await (const chunk of modelManager.streamMessage(workingHistory, { systemPrompt: enhancedPrompt, tools })) {
          if (chunk.type === 'text') {
            fullContent += chunk.content;
            yield {
              type: 'chunk',
              modelId,
              modelName,
              content: chunk.content,
              isThinking: false,
            };
          } else if (chunk.type === 'thinking' || chunk.type === 'reasoning') {
            fullThinking += chunk.content;
            yield {
              type: 'chunk',
              modelId,
              modelName,
              thinking: chunk.content,
              isThinking: true,
            };
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            yield {
              type: 'tool_call',
              modelId,
              modelName,
              toolCall: chunk.toolCall,
            };
          }
        }

        const assistantMsg = {
          role: 'assistant' as const,
          content: fullContent,
          thinking: fullThinking || undefined,
          model: modelName,
          agent: agentEmojis || undefined,
          timestamp: new Date().toISOString(),
        };

        yield {
          type: 'complete',
          modelId,
          modelName,
          message: assistantMsg,
        };

        // Add to history for next model
        workingHistory = [...workingHistory, assistantMsg];
      }
      break;

    case 'sequential':
    case 'parallel':
      // Stream from all models (sequential processes one at a time, parallel would be more complex)
      for (const modelId of activeModels) {
        const modelName = AVAILABLE_MODELS[modelId]?.name || modelId;
        // Only switch if different model - prevents resetting thinking state
        if (modelManager.getCurrentModel() !== modelId) {
          modelManager.setModel(modelId);
        }

        yield { type: 'start', modelId, modelName };

        let fullContent = '';
        let fullThinking = '';

        for await (const chunk of modelManager.streamMessage(conversationHistory, { systemPrompt: enhancedPrompt, tools })) {
          if (chunk.type === 'text') {
            fullContent += chunk.content;
            yield {
              type: 'chunk',
              modelId,
              modelName,
              content: chunk.content,
              isThinking: false,
            };
          } else if (chunk.type === 'thinking' || chunk.type === 'reasoning') {
            fullThinking += chunk.content;
            yield {
              type: 'chunk',
              modelId,
              modelName,
              thinking: chunk.content,
              isThinking: true,
            };
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            yield {
              type: 'tool_call',
              modelId,
              modelName,
              toolCall: chunk.toolCall,
            };
          }
        }

        yield {
          type: 'complete',
          modelId,
          modelName,
          message: {
            role: 'assistant',
            content: fullContent,
            thinking: fullThinking || undefined,
            model: modelName,
            agent: agentEmojis || undefined,
            timestamp: new Date().toISOString(),
          },
        };
      }
      break;
  }
}

/**
 * Mode Selector Dialog Component
 */
export type ModeSelectorProps = {
  currentMode: ConversationMode;
  cursorIndex: number;
  onSelect: (mode: ConversationMode) => void;
  onCancel: () => void;
};

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  cursorIndex,
  onSelect,
  onCancel,
}) => {
  const modes: ConversationMode[] = ['single', 'round-robin', 'sequential', 'parallel'];

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green" padding={1} marginBottom={1}>
      <Text color="green" bold>Select Conversation Mode</Text>
      <Box marginTop={1}>
        <Text color="gray" dimColor>How should models respond?</Text>
      </Box>

      {modes.map((mode, idx) => {
        const isCursor = idx === cursorIndex;
        const isActive = mode === currentMode;
        const descriptions: Record<ConversationMode, string> = {
          single: 'Use first model only',
          'round-robin': 'Models respond in order, seeing each other',
          sequential: 'All models respond independently',
          parallel: 'All models respond simultaneously',
        };

        return (
          <Box key={mode} marginTop={1} flexDirection="column">
            <Box>
              <Text color={isCursor ? 'green' : isActive ? 'yellow' : 'white'}>
                {isCursor ? '> ' : '  '}
                {isActive ? '✓ ' : '  '}
                {mode}
              </Text>
            </Box>
            <Box marginLeft={4}>
              <Text color="gray" dimColor>{descriptions[mode]}</Text>
            </Box>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color="gray" dimColor>↑↓ Navigate | Enter = Select | Esc = Cancel</Text>
      </Box>
    </Box>
  );
};

/**
 * Agent Selector Dialog Component
 */
export type AgentSelectorProps = {
  activeAgents: string[];
  cursorIndex: number;
  onToggle: (agentId: string) => void;
  onCancel: () => void;
};

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  activeAgents,
  cursorIndex,
  onToggle,
  onCancel,
}) => {
  const agents = Object.values(AGENT_ROLES);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green" padding={1} marginBottom={1}>
      <Text color="green" bold>Select Agent Roles (System Prompt Overlays)</Text>
      <Box marginTop={1}>
        <Text color="gray" dimColor>These add specialized perspectives to the models</Text>
      </Box>

      {agents.map((agent, idx) => {
        const isSelected = activeAgents.includes(agent.id);
        const isCursor = idx === cursorIndex;

        return (
          <Box key={agent.id} marginTop={1} flexDirection="column">
            <Box>
              <Text color={isCursor ? 'green' : 'white'}>
                {isCursor ? '> ' : '  '}
                {isSelected ? '☑' : '☐'} {agent.emoji} {agent.name}
              </Text>
            </Box>
            <Box marginLeft={4}>
              <Text color="gray" dimColor>{agent.systemPrompt.substring(0, 70)}...</Text>
            </Box>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ Navigate | Space/Enter = Toggle | C = Confirm | Esc = Cancel
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Quick model switch helper
 */
export const QUICK_SWITCHES: Record<string, string> = {
  // Claude (one shortcut per model)
  '/sonnet': 'claude-sonnet-4-5-20250929',
  '/sonnet4': 'claude-sonnet-4-20250514',
  '/opus': 'claude-opus-4-1-20250805',
  '/haiku': 'claude-haiku-4-5-20251001',

  // OpenAI (all different models)
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

export function handleQuickSwitch(
  command: string,
  modelManager: UnifiedModelManager,
  setActiveModels: (models: string[]) => void
): boolean {
  const modelId = QUICK_SWITCHES[command.toLowerCase()];
  if (modelId && AVAILABLE_MODELS[modelId]) {
    setActiveModels([modelId]);
    modelManager.setModel(modelId);
    return true;
  }
  return false;
}
