/**
 * Command Autocomplete Component - Next.js Version
 * Shows command suggestions when user types "/"
 */
'use client';

import React from 'react';

export interface Command {
  name: string;
  description: string;
  category?: string;
}

interface Props {
  commands: Command[];
  filter: string;
  selectedIndex: number;
  onSelect: (command: Command) => void;
  onCancel: () => void;
}

export const CommandAutocomplete: React.FC<Props> = ({
  commands,
  filter,
  selectedIndex,
  onSelect,
  onCancel,
}) => {
  const filtered = commands.filter((cmd) =>
    cmd.name.toLowerCase().startsWith((filter || '').toLowerCase())
  );

  if (filtered.length === 0) {
    return null;
  }

  // Show max 10 commands with scrolling window
  const MAX_VISIBLE = 10;
  const startIndex = Math.max(0, Math.min(selectedIndex - 5, filtered.length - MAX_VISIBLE));
  const endIndex = Math.min(filtered.length, startIndex + MAX_VISIBLE);
  const visibleCommands = filtered.slice(startIndex, endIndex);

  return (
    <div className="autocomplete-container">
      <style jsx>{`
        .autocomplete-container {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          margin-bottom: 8px;
          background: #1a1f2e;
          border: 2px solid #00ff9f;
          border-radius: 12px;
          padding: 16px;
          max-height: 500px;
          overflow-y: auto;
          z-index: 1000;
          animation: slideUp 0.2s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #30363d;
        }

        .header-title {
          color: #00ff9f;
          font-weight: bold;
          font-size: 16px;
        }

        .header-count {
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 12px;
        }

        .command-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .command-item {
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .command-item:hover {
          background: #252a35;
        }

        .command-item.selected {
          background: #00ff9f;
          color: #0a0e14;
        }

        .command-icon {
          font-size: 18px;
          min-width: 24px;
        }

        .command-content {
          flex: 1;
          min-width: 0;
        }

        .command-name {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .command-item.selected .command-name {
          color: #0a0e14;
        }

        .command-item:not(.selected) .command-name {
          color: #ffffff;
        }

        .command-description {
          font-size: 12px;
          opacity: 0.8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .command-item.selected .command-description {
          color: #0a0e14;
          opacity: 1;
        }

        .command-item:not(.selected) .command-description {
          color: #b3b9c5;
        }

        .help-text {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
          text-align: center;
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 12px;
        }
      `}</style>

      <div className="header">
        <span className="header-title">Available Commands</span>
        {filtered.length > MAX_VISIBLE && (
          <span className="header-count">
            {selectedIndex + 1} / {filtered.length}
          </span>
        )}
      </div>

      <div className="command-list">
        {visibleCommands.map((cmd, index) => {
          const actualIndex = startIndex + index;
          const isSelected = actualIndex === selectedIndex;

          return (
            <div
              key={cmd.name}
              className={`command-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(cmd)}
            >
              <span className="command-icon">{isSelected ? '→' : ' '}</span>
              <div className="command-content">
                <div className="command-name">{cmd.name}</div>
                <div className="command-description">
                  {cmd.description.substring(0, 60)}
                  {cmd.description.length > 60 ? '...' : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="help-text">
        ↑↓ Navigate | Enter = Select | Esc = Cancel | Type to filter
      </div>
    </div>
  );
};
