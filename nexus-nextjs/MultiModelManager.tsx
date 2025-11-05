/**
 * Multi-Model Manager Component - Next.js Version
 * Adds multi-model capabilities on top of existing UnifiedModelManager
 */
'use client';

import React from 'react';

// Import types - these should match your core types
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
 * Stream message to multiple models - Generator function for async streaming
 * This should be used with your existing UnifiedModelManager
 */
export async function* streamMultiModelMessage(
  conversationHistory: any[],
  selectedModels: string[],
  modelManager: any,
  fileTools: any,
  toolDefinitions: any[],
  onChunk: (modelId: string, chunk: string) => void,
  shouldAbort: () => boolean
): AsyncGenerator<void> {
  // Implementation depends on your UnifiedModelManager
  // This is a placeholder that maintains the interface
  for (const modelId of selectedModels) {
    if (shouldAbort()) break;
    
    modelManager.setModel(modelId);
    
    try {
      await modelManager.streamMessage(
        conversationHistory,
        (chunk: string) => {
          if (!shouldAbort()) {
            onChunk(modelId, chunk);
          }
        },
        toolDefinitions
      );
    } catch (error) {
      console.error(`Error streaming from ${modelId}:`, error);
    }
    
    yield;
  }
}

/**
 * Mode Selector Dialog Component - Next.js Version
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

  const descriptions: Record<ConversationMode, string> = {
    single: 'Use first model only',
    'round-robin': 'Models respond in order, seeing each other',
    sequential: 'All models respond independently',
    parallel: 'All models respond simultaneously',
  };

  return (
    <div className="mode-selector-container">
      <style jsx>{`
        .mode-selector-container {
          background: #1a1f2e;
          border: 2px solid #00ff9f;
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
        }

        .header {
          color: #00ff9f;
          font-weight: bold;
          font-size: 18px;
          margin-bottom: 8px;
        }

        .subtitle {
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .mode-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mode-item {
          padding: 16px;
          background: #0d1117;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          border: 2px solid transparent;
        }

        .mode-item:hover {
          background: #252a35;
        }

        .mode-item.cursor {
          border-color: #00ff9f;
          background: #1a3a1a;
        }

        .mode-item.active {
          background: #1a3a1a;
        }

        .mode-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .mode-indicator {
          font-size: 16px;
          min-width: 24px;
        }

        .mode-name {
          font-weight: bold;
          font-size: 15px;
        }

        .mode-item.cursor .mode-name {
          color: #00ff9f;
        }

        .mode-item.active:not(.cursor) .mode-name {
          color: #ffcc00;
        }

        .mode-item:not(.active):not(.cursor) .mode-name {
          color: #ffffff;
        }

        .mode-description {
          color: #b3b9c5;
          opacity: 0.8;
          font-size: 13px;
          margin-left: 36px;
        }

        .help-text {
          margin-top: 20px;
          text-align: center;
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 12px;
        }

        .button-row {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .action-button {
          flex: 1;
          padding: 10px 20px;
          border: 2px solid;
          border-radius: 8px;
          font-size: 13px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-button:hover {
          transform: translateY(-2px);
        }

        .cancel-button {
          background: #1a1a2e;
          border-color: #b3b9c5;
          color: #b3b9c5;
        }

        .cancel-button:hover {
          background: #b3b9c5;
          color: #0a0e14;
        }
      `}</style>

      <div className="header">Select Conversation Mode</div>
      <div className="subtitle">How should models respond?</div>

      <div className="mode-list">
        {modes.map((mode, idx) => {
          const isCursor = idx === cursorIndex;
          const isActive = mode === currentMode;

          return (
            <div
              key={mode}
              className={`mode-item ${isCursor ? 'cursor' : ''} ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(mode)}
            >
              <div className="mode-header">
                <span className="mode-indicator">{isCursor ? '>' : ' '}</span>
                <span className="mode-indicator">{isActive ? '✓' : ' '}</span>
                <span className="mode-name">{mode}</span>
              </div>
              <div className="mode-description">{descriptions[mode]}</div>
            </div>
          );
        })}
      </div>

      <div className="button-row">
        <button className="action-button cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="help-text">
        ↑↓ Navigate | Enter/Click = Select | Esc = Cancel
      </div>
    </div>
  );
};

/**
 * Agent Selector Dialog Component - Next.js Version
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
    <div className="agent-selector-container">
      <style jsx>{`
        .agent-selector-container {
          background: #1a1f2e;
          border: 2px solid #00ff9f;
          border-radius: 12px;
          padding: 24px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .header {
          color: #00ff9f;
          font-weight: bold;
          font-size: 18px;
          margin-bottom: 8px;
        }

        .subtitle {
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .agent-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .agent-item {
          padding: 16px;
          background: #0d1117;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          border: 2px solid transparent;
        }

        .agent-item:hover {
          background: #252a35;
        }

        .agent-item.cursor {
          border-color: #00ff9f;
          background: #1a3a1a;
        }

        .agent-item.selected {
          background: #1a3a1a;
        }

        .agent-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .agent-indicator {
          font-size: 16px;
          min-width: 24px;
        }

        .agent-checkbox {
          font-size: 18px;
          min-width: 24px;
        }

        .agent-emoji {
          font-size: 20px;
        }

        .agent-name {
          font-weight: bold;
          font-size: 15px;
          flex: 1;
        }

        .agent-item.cursor .agent-name {
          color: #00ff9f;
        }

        .agent-item:not(.cursor) .agent-name {
          color: #ffffff;
        }

        .agent-description {
          color: #b3b9c5;
          opacity: 0.8;
          font-size: 13px;
          margin-left: 72px;
          line-height: 1.5;
        }

        .help-text {
          margin-top: 20px;
          text-align: center;
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 12px;
        }

        .button-row {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .action-button {
          flex: 1;
          padding: 10px 20px;
          border: 2px solid;
          border-radius: 8px;
          font-size: 13px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-button:hover {
          transform: translateY(-2px);
        }

        .confirm-button {
          background: #1a3a1a;
          border-color: #00ff9f;
          color: #00ff9f;
        }

        .confirm-button:hover {
          background: #00ff9f;
          color: #0a0e14;
        }

        .cancel-button {
          background: #1a1a2e;
          border-color: #b3b9c5;
          color: #b3b9c5;
        }

        .cancel-button:hover {
          background: #b3b9c5;
          color: #0a0e14;
        }
      `}</style>

      <div className="header">Select Agent Roles</div>
      <div className="subtitle">These add specialized perspectives to the models</div>

      <div className="agent-list">
        {agents.map((agent, idx) => {
          const isSelected = activeAgents.includes(agent.id);
          const isCursor = idx === cursorIndex;

          return (
            <div
              key={agent.id}
              className={`agent-item ${isCursor ? 'cursor' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => onToggle(agent.id)}
            >
              <div className="agent-header">
                <span className="agent-indicator">{isCursor ? '>' : ' '}</span>
                <span className="agent-checkbox">{isSelected ? '☑' : '☐'}</span>
                <span className="agent-emoji">{agent.emoji}</span>
                <span className="agent-name">{agent.name}</span>
              </div>
              <div className="agent-description">{agent.systemPrompt}</div>
            </div>
          );
        })}
      </div>

      <div className="button-row">
        <button className="action-button cancel-button" onClick={onCancel}>
          Done
        </button>
      </div>

      <div className="help-text">
        ↑↓ Navigate | Space/Enter/Click = Toggle | Esc = Done
      </div>
    </div>
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
  modelManager: any,
  setMessages: (fn: (prev: any[]) => any[]) => void
): { modelId: string } | null {
  const modelId = QUICK_SWITCHES[command.toLowerCase()];
  if (modelId) {
    modelManager.setModel(modelId);
    setMessages(prev => [...prev, {
      role: 'system' as const,
      content: `Switched to ${modelId}`,
      timestamp: new Date().toISOString(),
    }]);
    return { modelId };
  }
  return null;
}
