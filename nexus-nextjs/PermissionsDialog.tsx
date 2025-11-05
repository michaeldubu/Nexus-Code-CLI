/**
 * Permissions Dialog Component - Next.js Version
 * Manage allowed/denied bash commands
 */
'use client';

import React from 'react';

interface Props {
  approvedCommands: string[];
  deniedCommands: string[];
  selectedTab: 'allow' | 'ask' | 'deny' | 'workspace';
  selectedIndex: number;
  onAddApproved: () => void;
  onAddDenied: () => void;
  onRemove: (type: 'approved' | 'denied', index: number) => void;
  onCancel: () => void;
}

export const PermissionsDialog: React.FC<Props> = ({
  approvedCommands,
  deniedCommands,
  selectedTab,
  selectedIndex,
  onAddApproved,
  onAddDenied,
  onRemove,
  onCancel,
}) => {
  const tabs = [
    { id: 'allow', label: 'Allow' },
    { id: 'ask', label: 'Ask' },
    { id: 'deny', label: 'Deny' },
    { id: 'workspace', label: 'Workspace' },
  ];

  return (
    <div className="permissions-container">
      <style jsx>{`
        .permissions-container {
          background: #1a1f2e;
          border: 2px solid #ff9500;
          border-radius: 12px;
          padding: 24px;
          max-width: 700px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .header-border {
          color: #ff9500;
          font-weight: bold;
          text-align: center;
          margin-bottom: 8px;
        }

        .header-title {
          color: #00ff9f;
          font-weight: bold;
          font-size: 18px;
          text-align: center;
          margin-bottom: 16px;
        }

        .tabs-container {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 2px solid #30363d;
        }

        .tab-label {
          color: #ff9500;
          margin-right: 8px;
        }

        .tab {
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: bold;
          font-size: 14px;
        }

        .tab:hover {
          background: #252a35;
        }

        .tab.active {
          background: #00ff9f;
          color: #0a0e14;
        }

        .tab:not(.active) {
          color: #ff9500;
          border: 1px solid #30363d;
        }

        .tab-hint {
          color: #ff9500;
          opacity: 0.6;
          font-size: 12px;
          margin-top: 8px;
          text-align: right;
        }

        .content-section {
          min-height: 300px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .section-icon {
          color: #00d4ff;
        }

        .section-title {
          font-weight: bold;
          font-size: 16px;
        }

        .section-title.allow {
          color: #00ff9f;
        }

        .section-title.deny {
          color: #ff4444;
        }

        .section-title.workspace {
          color: #00ff9f;
        }

        .command-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .command-item {
          padding: 12px 16px;
          background: #0d1117;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .command-item:hover {
          background: #252a35;
        }

        .command-item.selected {
          background: #1a3a1a;
          border: 2px solid #00ff9f;
        }

        .command-cursor {
          font-size: 16px;
          min-width: 20px;
        }

        .command-text {
          flex: 1;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
        }

        .command-item.allow .command-text {
          color: #00d4ff;
        }

        .command-item.deny .command-text {
          color: #00ff9f;
        }

        .empty-state {
          padding: 40px 16px;
          text-align: center;
        }

        .empty-text {
          color: #ff9500;
          font-size: 14px;
        }

        .workspace-content {
          padding: 20px;
        }

        .workspace-item {
          padding: 12px 16px;
          background: #0d1117;
          border-radius: 8px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .workspace-item:hover {
          background: #252a35;
        }

        .workspace-item.selected {
          background: #1a3a1a;
          border: 2px solid #00ff9f;
        }

        .workspace-option {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #00ff9f;
          font-size: 14px;
        }

        .workspace-description {
          color: #00ff9f;
          font-size: 13px;
          margin-top: 12px;
          line-height: 1.6;
        }

        .footer-border {
          color: #ff9500;
          font-weight: bold;
          text-align: center;
          margin-top: 20px;
          margin-bottom: 16px;
        }

        .help-text {
          text-align: center;
          color: #00d4ff;
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

        .add-button {
          background: #1a3a1a;
          border-color: #00ff9f;
          color: #00ff9f;
        }

        .add-button:hover {
          background: #00ff9f;
          color: #0a0e14;
        }

        .close-button {
          background: #1a1a2e;
          border-color: #b3b9c5;
          color: #b3b9c5;
        }

        .close-button:hover {
          background: #b3b9c5;
          color: #0a0e14;
        }
      `}</style>

      <div className="header-border">
        ╔═══════════════════════════════════════════════════════════════╗
      </div>
      <div className="header-title">Command Permissions</div>
      <div className="header-border">
        ╠═══════════════════════════════════════════════════════════════╣
      </div>

      <div className="tabs-container">
        <span className="tab-label">Permissions:</span>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${selectedTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </div>
        ))}
      </div>
      <div className="tab-hint">(tab to cycle)</div>

      <div className="content-section">
        {selectedTab === 'allow' && (
          <>
            <div className="section-header">
              <span className="section-icon">║</span>
              <span className="section-title allow">Approved Commands:</span>
            </div>

            {approvedCommands.length === 0 ? (
              <div className="empty-state">
                <div className="empty-text">(none)</div>
              </div>
            ) : (
              <div className="command-list">
                {approvedCommands.slice(0, 10).map((cmd, index) => (
                  <div
                    key={index}
                    className={`command-item allow ${
                      index === selectedIndex ? 'selected' : ''
                    }`}
                    onClick={() => onRemove('approved', index)}
                  >
                    <span className="command-cursor">
                      {index === selectedIndex ? '→' : ' '}
                    </span>
                    <span className="command-text">{cmd}</span>
                  </div>
                ))}
                {approvedCommands.length > 10 && (
                  <div className="empty-text">
                    ...and {approvedCommands.length - 10} more
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {selectedTab === 'deny' && (
          <>
            <div className="section-header">
              <span className="section-icon">║</span>
              <span className="section-title deny">Denied Commands:</span>
            </div>

            {deniedCommands.length === 0 ? (
              <div className="empty-state">
                <div className="empty-text">(none)</div>
              </div>
            ) : (
              <div className="command-list">
                {deniedCommands.slice(0, 10).map((cmd, index) => (
                  <div
                    key={index}
                    className={`command-item deny ${
                      index === selectedIndex ? 'selected' : ''
                    }`}
                    onClick={() => onRemove('denied', index)}
                  >
                    <span className="command-cursor">
                      {index === selectedIndex ? '→' : ' '}
                    </span>
                    <span className="command-text">{cmd}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {selectedTab === 'workspace' && (
          <div className="workspace-content">
            <div className="section-header">
              <span className="section-icon">║</span>
              <span className="section-title workspace">Workspace Settings</span>
            </div>

            <div className="workspace-item selected">
              <div className="workspace-option">
                <span>→</span>
                <span>1. Add directory...</span>
              </div>
            </div>

            <div className="workspace-description">
              NEXUS can read files in the workspace, and make edits when 
              auto-accept edits is on.
            </div>
          </div>
        )}

        {selectedTab === 'ask' && (
          <div className="workspace-content">
            <div className="section-header">
              <span className="section-icon">║</span>
              <span className="section-title workspace">Ask Mode</span>
            </div>

            <div className="workspace-description">
              In Ask mode, NEXUS will prompt you for approval before executing
              any bash commands or file operations. This is the default behavior
              for commands not in your Approved or Denied lists.
            </div>
          </div>
        )}
      </div>

      <div className="footer-border">
        ╚═══════════════════════════════════════════════════════════════╝
      </div>

      <div className="button-row">
        {selectedTab === 'allow' && (
          <button className="action-button add-button" onClick={onAddApproved}>
            + Add Approved Command
          </button>
        )}
        {selectedTab === 'deny' && (
          <button className="action-button add-button" onClick={onAddDenied}>
            + Add Denied Command
          </button>
        )}
        <button className="action-button close-button" onClick={onCancel}>
          Close
        </button>
      </div>

      <div className="help-text">
        Tab = Cycle tabs | ↑↓ = Navigate | a = Add approved | d = Add denied | Esc = Close
      </div>
    </div>
  );
};
