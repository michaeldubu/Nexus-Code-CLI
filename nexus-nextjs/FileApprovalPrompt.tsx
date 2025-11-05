/**
 * File Approval Prompt Component - Next.js Version
 * Shows file operation (write/edit) approval dialog
 */
'use client';

import React from 'react';

interface Props {
  operation: string;
  filePath: string;
  details?: string;
  onApprove?: () => void;
  onDeny?: () => void;
  onAlwaysApprove?: () => void;
  onAlwaysDeny?: () => void;
}

export const FileApprovalPrompt: React.FC<Props> = ({ 
  operation, 
  filePath, 
  details,
  onApprove,
  onDeny,
  onAlwaysApprove,
  onAlwaysDeny,
}) => {
  return (
    <div className="file-approval-container">
      <style jsx>{`
        .file-approval-container {
          background: #1a1f2e;
          border: 2px solid #00d4ff;
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
          color: #00d4ff;
          font-size: 18px;
          font-weight: bold;
        }

        .info-section {
          margin-bottom: 16px;
        }

        .info-row {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
          padding: 12px;
          background: #0d1117;
          border-radius: 8px;
        }

        .info-label {
          color: #ffffff;
          font-size: 14px;
          min-width: 80px;
        }

        .info-value {
          color: #ffcc00;
          font-size: 14px;
          font-weight: bold;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          word-break: break-all;
          flex: 1;
        }

        .operation-value {
          color: #ffcc00;
        }

        .filepath-value {
          color: #00d4ff;
        }

        .details-section {
          margin-bottom: 20px;
          padding: 12px;
          background: #0d1117;
          border-radius: 8px;
          border-left: 4px solid #00d4ff;
        }

        .details-text {
          color: #b3b9c5;
          font-size: 13px;
          line-height: 1.5;
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

        .approve-workspace {
          background: #1a3a1a;
          border-color: #00ff9f;
          color: #00ff9f;
        }

        .approve-workspace:hover {
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

        .deny-directory {
          background: #3a1a1a;
          border-color: #ff4444;
          color: #ff4444;
        }

        .deny-directory:hover {
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
        <span style={{ fontSize: '24px' }}>📝</span>
        <span className="header-text">File Operation Approval Required</span>
      </div>

      <div className="info-section">
        <div className="info-row">
          <span className="info-label">Operation:</span>
          <span className="info-value operation-value">{operation.toUpperCase()}</span>
        </div>
        <div className="info-row">
          <span className="info-label">File:</span>
          <span className="info-value filepath-value">{filePath}</span>
        </div>
      </div>

      {details && (
        <div className="details-section">
          <div className="details-text">{details}</div>
        </div>
      )}

      {(onApprove || onDeny || onAlwaysApprove || onAlwaysDeny) && (
        <div className="button-grid">
          {onApprove && (
            <button className="action-button approve-once" onClick={onApprove}>
              <div className="button-label">
                <span>✓</span>
                <span>Approve Once</span>
              </div>
            </button>
          )}

          {onAlwaysApprove && (
            <button className="action-button approve-workspace" onClick={onAlwaysApprove}>
              <div className="button-label">
                <span>✓✓</span>
                <span>Add to Workspace</span>
              </div>
            </button>
          )}

          {onDeny && (
            <button className="action-button deny-once" onClick={onDeny}>
              <div className="button-label">
                <span>✗</span>
                <span>Deny Once</span>
              </div>
            </button>
          )}

          {onAlwaysDeny && (
            <button className="action-button deny-directory" onClick={onAlwaysDeny}>
              <div className="button-label">
                <span>✗✗</span>
                <span>Block Directory</span>
              </div>
            </button>
          )}
        </div>
      )}

      <div className="help-text">
        Click a button or press y/a/n/d to respond
      </div>
    </div>
  );
};
