/**
 * Bash Approval Prompt Component - Next.js Version
 * Shows bash command approval dialog with interactive buttons
 */
'use client';

import React from 'react';

interface Props {
  command: string;
  onApprove: () => void;
  onDeny: () => void;
  onAlwaysApprove: () => void;
  onAlwaysDeny: () => void;
}

export const BashApprovalPrompt: React.FC<Props> = ({ 
  command, 
  onApprove, 
  onDeny, 
  onAlwaysApprove, 
  onAlwaysDeny 
}) => {
  return (
    <div className="bash-approval-container">
      <style jsx>{`
        .bash-approval-container {
          background: #1a1f2e;
          border: 2px solid #ff9500;
          border-radius: 12px;
          padding: 24px;
          max-width: 600px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .header-text {
          color: #ff9500;
          font-size: 18px;
          font-weight: bold;
        }

        .command-section {
          margin-bottom: 24px;
          padding: 16px;
          background: #0d1117;
          border-radius: 8px;
          border-left: 4px solid #ff9500;
        }

        .command-label {
          color: #00ff9f;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .command-text {
          color: #ff9500;
          font-size: 16px;
          font-weight: bold;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          word-break: break-all;
        }

        .button-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .action-button {
          padding: 12px 20px;
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

        .action-button:active {
          transform: translateY(0);
        }

        .approve-once {
          background: #1a3a1a;
          border-color: #00ff9f;
          color: #00ff9f;
        }

        .approve-once:hover {
          background: #00ff9f;
          color: #0a0e14;
        }

        .approve-always {
          background: #1a3a1a;
          border-color: #00ff9f;
          color: #00ff9f;
        }

        .approve-always:hover {
          background: #00ff9f;
          color: #0a0e14;
        }

        .deny-once {
          background: #3a1a1a;
          border-color: #ff4444;
          color: #ff4444;
        }

        .deny-once:hover {
          background: #ff4444;
          color: #0a0e14;
        }

        .deny-always {
          background: #3a1a1a;
          border-color: #ff4444;
          color: #ff4444;
        }

        .deny-always:hover {
          background: #ff4444;
          color: #0a0e14;
        }

        .help-text {
          text-align: center;
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 12px;
        }

        .button-label {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
        }

        @media (max-width: 600px) {
          .button-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="header">
        <span style={{ fontSize: '24px' }}>⚠️</span>
        <span className="header-text">Bash Command Approval Required</span>
      </div>

      <div className="command-section">
        <div className="command-label">Command:</div>
        <div className="command-text">{command}</div>
      </div>

      <div className="button-grid">
        <button className="action-button approve-once" onClick={onApprove}>
          <div className="button-label">
            <span>✓</span>
            <span>Approve Once</span>
          </div>
        </button>

        <button className="action-button approve-always" onClick={onAlwaysApprove}>
          <div className="button-label">
            <span>✓✓</span>
            <span>Always Approve</span>
          </div>
        </button>

        <button className="action-button deny-once" onClick={onDeny}>
          <div className="button-label">
            <span>✗</span>
            <span>Deny Once</span>
          </div>
        </button>

        <button className="action-button deny-always" onClick={onAlwaysDeny}>
          <div className="button-label">
            <span>✗✗</span>
            <span>Always Deny</span>
          </div>
        </button>
      </div>

      <div className="help-text">
        Click a button or press 1-4 to respond
      </div>
    </div>
  );
};
