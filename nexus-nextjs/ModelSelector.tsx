/**
 * Model Selector Component - Next.js Version
 * Multi-select model chooser with checkboxes
 */
'use client';

import React from 'react';

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google';
  supportsThinking?: boolean;
  supportsReasoning?: boolean;
  supportsVision?: boolean;
}

interface Props {
  models: ModelConfig[];
  selectedModels: string[];
  cursorIndex: number;
  onToggle: (modelId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ModelSelector: React.FC<Props> = ({
  models,
  selectedModels,
  cursorIndex,
  onToggle,
  onConfirm,
  onCancel,
}) => {
  // Group by provider
  const anthropicModels = models.filter((m) => m.provider === 'anthropic');
  const openaiModels = models.filter((m) => m.provider === 'openai');
  const googleModels = models.filter((m) => m.provider === 'google');

  let currentIndex = 0;

  const renderModel = (model: ModelConfig) => {
    const isSelected = selectedModels.includes(model.id);
    const isCursor = currentIndex === cursorIndex;
    const features = [];
    if (model.supportsThinking) features.push('Thinking');
    if (model.supportsReasoning) features.push('Reasoning');
    if (model.supportsVision) features.push('Vision');

    const element = (
      <div
        key={model.id}
        className={`model-item ${isCursor ? 'cursor' : ''} ${isSelected ? 'selected' : ''}`}
        onClick={() => onToggle(model.id)}
      >
        <style jsx>{`
          .model-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            margin: 4px 0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s;
          }

          .model-item:hover {
            background: #252a35;
          }

          .model-item.cursor {
            background: #1a3a1a;
            border: 2px solid #00ff9f;
          }

          .cursor-indicator {
            font-size: 16px;
            min-width: 20px;
          }

          .checkbox {
            font-size: 18px;
            min-width: 24px;
          }

          .model-name {
            flex: 1;
            font-size: 14px;
            font-weight: bold;
            min-width: 200px;
          }

          .model-item.cursor .model-name {
            color: #00ff9f;
          }

          .model-item.selected:not(.cursor) .model-name {
            color: #00d4ff;
          }

          .model-item:not(.selected):not(.cursor) .model-name {
            color: #ffffff;
          }

          .model-features {
            color: #b3b9c5;
            font-size: 12px;
            min-width: 200px;
          }
        `}</style>

        <span className="cursor-indicator">{isCursor ? '→' : ' '}</span>
        <span className="checkbox">{isSelected ? '☑' : '☐'}</span>
        <span className="model-name">{model.name}</span>
        <span className="model-features">{features.join(', ') || 'Standard'}</span>
      </div>
    );

    currentIndex++;
    return element;
  };

  return (
    <div className="model-selector-container">
      <style jsx>{`
        .model-selector-container {
          background: #1a1f2e;
          border: 2px solid #00d4ff;
          border-radius: 12px;
          padding: 24px;
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .header-border {
          color: #00d4ff;
          font-weight: bold;
          font-size: 14px;
          text-align: center;
          margin-bottom: 8px;
        }

        .header-title {
          color: #00d4ff;
          font-weight: bold;
          font-size: 18px;
          text-align: center;
          margin-bottom: 16px;
        }

        .divider {
          height: 2px;
          background: linear-gradient(to right, transparent, #00d4ff, transparent);
          margin: 20px 0;
        }

        .provider-section {
          margin-bottom: 24px;
        }

        .provider-header {
          color: #ffcc00;
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 12px;
          padding-left: 16px;
        }

        .selection-count {
          text-align: center;
          color: #00ff9f;
          font-size: 14px;
          margin-top: 20px;
          padding: 12px;
          background: #0d1117;
          border-radius: 8px;
        }

        .help-text {
          text-align: center;
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 12px;
          margin-top: 16px;
        }

        .button-row {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .action-button {
          flex: 1;
          padding: 12px 24px;
          border: 2px solid;
          border-radius: 8px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }

        .action-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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

      <div className="header-border">
        ╔═══════════════════════════════════════════════════════════════╗
      </div>
      <div className="header-title">
        Select Models (Multi-Select)
      </div>
      <div className="header-border">
        ╠═══════════════════════════════════════════════════════════════╣
      </div>

      {anthropicModels.length > 0 && (
        <div className="provider-section">
          <div className="provider-header">Anthropic Models:</div>
          {anthropicModels.map(renderModel)}
        </div>
      )}

      {openaiModels.length > 0 && (
        <div className="provider-section">
          <div className="provider-header">OpenAI Models:</div>
          {openaiModels.map(renderModel)}
        </div>
      )}

      {googleModels.length > 0 && (
        <div className="provider-section">
          <div className="provider-header">Google Models:</div>
          {googleModels.map(renderModel)}
        </div>
      )}

      <div className="header-border">
        ╚═══════════════════════════════════════════════════════════════╝
      </div>

      <div className="selection-count">
        Selected: {selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''}
      </div>

      <div className="button-row">
        <button className="action-button confirm-button" onClick={onConfirm}>
          ✓ Confirm Selection
        </button>
        <button className="action-button cancel-button" onClick={onCancel}>
          ✗ Cancel
        </button>
      </div>

      <div className="help-text">
        ↑↓ Navigate | Space/Click = Toggle | Enter = Confirm | Esc = Cancel
      </div>
    </div>
  );
};
