/**
 * Message Renderer Component - Next.js Version
 * Displays messages with proper model headers and formatting
 * Supports multipart content (text, images, files)
 */
'use client';

import React from 'react';

// Type definitions matching the core types
export interface ContentBlock {
  type: 'text' | 'image' | 'file';
  text?: string;
  content?: string;
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
  name?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
  thinking?: string;
  toolCalls?: any[];
  model?: string;
  agent?: string;
  timestamp?: string;
}

interface Props {
  messages: Message[];
  currentModel?: string;
}

// Helper to render content (string or content blocks)
const RenderContent: React.FC<{ content: string | ContentBlock[] }> = ({ content }) => {
  // Legacy string content
  if (typeof content === 'string') {
    return (
      <div className="text-content">
        <style jsx>{`
          .text-content {
            color: #00ff9f;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.6;
          }
        `}</style>
        {content}
      </div>
    );
  }

  // New content blocks format
  return (
    <div className="content-blocks">
      <style jsx>{`
        .content-blocks {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .text-block {
          color: #00ff9f;
          white-space: pre-wrap;
          word-wrap: break-word;
          line-height: 1.6;
        }

        .media-block {
          padding: 16px;
          border: 2px solid;
          border-radius: 8px;
          background: #0d1117;
        }

        .image-block {
          border-color: #00d4ff;
        }

        .file-block {
          border-color: #ffcc00;
        }

        .media-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .media-title {
          font-weight: bold;
          font-size: 14px;
        }

        .image-title {
          color: #00d4ff;
        }

        .file-title {
          color: #ffcc00;
        }

        .media-info {
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .file-preview {
          background: #1a1f2e;
          padding: 12px;
          border-radius: 6px;
          color: #ffffff;
          font-size: 13px;
          line-height: 1.5;
          max-height: 200px;
          overflow-y: auto;
        }

        .preview-more {
          color: #b3b9c5;
          opacity: 0.5;
          margin-top: 8px;
        }
      `}</style>

      {content.map((block, idx) => {
        if (block.type === 'text') {
          return (
            <div key={idx} className="text-block">
              {block.text}
            </div>
          );
        }

        if (block.type === 'image' && block.source) {
          const sizeKB = Math.round(block.source.data.length * 0.75 / 1024);
          return (
            <div key={idx} className="media-block image-block">
              <div className="media-header">
                <span style={{ fontSize: '20px' }}>🖼️</span>
                <span className="media-title image-title">
                  Image ({block.source.media_type})
                </span>
              </div>
              <div className="media-info">Size: ~{sizeKB}KB</div>
              <div className="media-info">
                [Image data: {block.source.data.substring(0, 40)}...]
              </div>
            </div>
          );
        }

        if (block.type === 'file' && block.content) {
          const lines = block.content.split('\n').length;
          return (
            <div key={idx} className="media-block file-block">
              <div className="media-header">
                <span style={{ fontSize: '20px' }}>📄</span>
                <span className="media-title file-title">{block.name || 'File'}</span>
              </div>
              <div className="media-info">
                {lines} lines, {block.content.length} chars
              </div>
              <div className="file-preview">
                {block.content.substring(0, 500)}
                {block.content.length > 500 && (
                  <div className="preview-more">...</div>
                )}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

export const MessageRenderer: React.FC<Props> = ({ messages, currentModel }) => {
  return (
    <div className="message-renderer">
      <style jsx>{`
        .message-renderer {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .message-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .message-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .message-icon {
          font-size: 16px;
        }

        .message-from {
          font-weight: bold;
          font-size: 14px;
        }

        .user-from {
          color: #ff9500;
        }

        .assistant-from {
          color: #00ff9f;
        }

        .system-from {
          color: #00d4ff;
        }

        .message-timestamp {
          color: #b3b9c5;
          opacity: 0.6;
          font-size: 12px;
        }

        .thinking-section {
          padding: 12px;
          background: #0d1117;
          border-left: 4px solid #00d4ff;
          border-radius: 6px;
          margin-left: 32px;
        }

        .thinking-label {
          color: #00d4ff;
          opacity: 0.7;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .thinking-content {
          color: #b3b9c5;
          font-size: 13px;
          line-height: 1.5;
        }

        .message-content {
          margin-left: 32px;
        }

        .tool-calls-section {
          margin-left: 32px;
          margin-top: 12px;
        }

        .tool-calls-text {
          color: #00d4ff;
          font-size: 13px;
        }
      `}</style>

      {messages.map((msg, index) => {
        if (msg.role === 'user') {
          return (
            <div key={index} className="message-container">
              <div className="message-header">
                <span className="message-icon">👤</span>
                <span className="message-from user-from">You</span>
                {msg.timestamp && (
                  <span className="message-timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="message-content">
                <RenderContent content={msg.content} />
              </div>
            </div>
          );
        }

        if (msg.role === 'assistant') {
          const modelName = msg.model || currentModel || 'AI';

          return (
            <div key={index} className="message-container">
              <div className="message-header">
                <span className="message-icon">🤖</span>
                <span className="message-from assistant-from">{modelName}</span>
                {msg.timestamp && (
                  <span className="message-timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {msg.thinking && (
                <div className="thinking-section">
                  <div className="thinking-label">💭 Thinking:</div>
                  <div className="thinking-content">{msg.thinking}</div>
                </div>
              )}

              <div className="message-content">
                <RenderContent content={msg.content} />
              </div>

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="tool-calls-section">
                  <span className="tool-calls-text">
                    🔧 Tool Calls: {msg.toolCalls.length}
                  </span>
                </div>
              )}
            </div>
          );
        }

        // SYSTEM MESSAGES - Tool results, status updates, errors
        if (msg.role === 'system') {
          return (
            <div key={index} className="message-container">
              <div className="message-header">
                <span className="message-icon">⚙️</span>
                <span className="message-from system-from">SYSTEM</span>
                {msg.timestamp && (
                  <span className="message-timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="message-content">
                {typeof msg.content === 'string' ? (
                  <div style={{ color: '#ffcc00' }}>{msg.content}</div>
                ) : (
                  <RenderContent content={msg.content} />
                )}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
