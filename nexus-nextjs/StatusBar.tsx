/**
 * Status Bar Component - Next.js Version
 * Shows current model(s), working directory, and session info
 */
'use client';

import React from 'react';

interface Props {
  models: string[];
  workingDir: string;
  messageCount: number;
  thinkingEnabled?: boolean;
  reasoningLevel?: string;
  mode?: string; // Editing mode: normal, plan, autoedit, yolo
  mcpConnected?: boolean;
}

export const StatusBar: React.FC<Props> = ({
  models,
  workingDir,
  messageCount,
  thinkingEnabled,
  reasoningLevel,
  mode,
  mcpConnected,
}) => {
  // Truncate working directory if too long
  const truncatedDir = workingDir.length > 30 ? '...' + workingDir.slice(-27) : workingDir;

  return (
    <div className="status-bar">
      <style jsx>{`
        .status-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 20px;
          background: #0d1117;
          border-top: 2px solid #00ff9f;
          font-size: 13px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          flex-wrap: wrap;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-label {
          color: #00ff9f;
        }

        .status-value {
          color: #ffffff;
          font-weight: bold;
        }

        .status-divider {
          color: #00ff9f;
          opacity: 0.5;
        }

        .model-value {
          color: #00ff9f;
        }

        .dir-value {
          color: #b3b9c5;
          opacity: 0.8;
        }

        .thinking-on {
          color: #00ff9f;
          font-weight: bold;
        }

        .thinking-off {
          color: #b3b9c5;
          opacity: 0.5;
        }

        .reasoning-value {
          color: #00ff9f;
          font-weight: bold;
        }

        .mode-normal {
          color: #ffffff;
        }

        .mode-plan {
          color: #00d4ff;
        }

        .mode-autoedit {
          color: #ffcc00;
        }

        .mode-yolo {
          color: #ff4444;
          font-weight: bold;
        }

        .mcp-connected {
          color: #00ff9f;
          font-weight: bold;
        }

        .mcp-disconnected {
          color: #b3b9c5;
          opacity: 0.5;
        }

        .help-hint {
          margin-left: auto;
          color: #b3b9c5;
          opacity: 0.6;
          font-size: 11px;
        }

        @media (max-width: 768px) {
          .status-bar {
            font-size: 11px;
            gap: 12px;
            padding: 10px 16px;
          }

          .help-hint {
            display: none;
          }
        }
      `}</style>

      <span className="status-label">❯</span>

      {/* Model(s) */}
      <div className="status-item">
        <span className="status-label">Model:</span>
        <span className="status-value model-value">{models.join('+')}</span>
      </div>

      <span className="status-divider">│</span>

      {/* Working Directory */}
      <div className="status-item">
        <span className="status-label">Dir:</span>
        <span className="status-value dir-value">{truncatedDir}</span>
      </div>

      <span className="status-divider">│</span>

      {/* Messages */}
      <div className="status-item">
        <span className="status-label">Msgs:</span>
        <span className="status-value">{messageCount}</span>
      </div>

      {/* Thinking/Reasoning */}
      {thinkingEnabled !== undefined && (
        <>
          <span className="status-divider">│</span>
          <div className="status-item">
            <span className="status-label">Thinking:</span>
            <span className={thinkingEnabled ? 'thinking-on' : 'thinking-off'}>
              {thinkingEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </>
      )}

      {reasoningLevel && (
        <>
          <span className="status-divider">│</span>
          <div className="status-item">
            <span className="status-label">Reasoning:</span>
            <span className="reasoning-value">{reasoningLevel.toUpperCase()}</span>
          </div>
        </>
      )}

      {/* Mode */}
      {mode && (
        <>
          <span className="status-divider">│</span>
          <div className="status-item">
            <span className="status-label">Mode:</span>
            <span
              className={
                mode === 'yolo'
                  ? 'mode-yolo'
                  : mode === 'plan'
                  ? 'mode-plan'
                  : mode === 'autoedit'
                  ? 'mode-autoedit'
                  : 'mode-normal'
              }
            >
              {mode.toUpperCase()}
            </span>
          </div>
        </>
      )}

      {/* MCP Status */}
      {mcpConnected !== undefined && (
        <>
          <span className="status-divider">│</span>
          <div className="status-item">
            <span className={mcpConnected ? 'mcp-connected' : 'mcp-disconnected'}>
              {mcpConnected ? '🧠 MCP' : '⚪ MCP'}
            </span>
          </div>
        </>
      )}

      {/* Help hint */}
      <span className="help-hint">Tab=toggle | Shift+Tab=mode</span>
    </div>
  );
};
