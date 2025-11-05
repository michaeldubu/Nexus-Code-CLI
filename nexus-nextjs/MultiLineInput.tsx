/**
 * Multi-Line Input Component - Next.js Version
 * Supports newlines, file uploads, and keyboard navigation
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface ContentBlock {
  type: 'text' | 'image' | 'file';
  content: string;
  text?: string;
  mimeType?: string;
  fileName?: string;
}

interface MultiLineInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (content: ContentBlock[] | string) => void;
  placeholder?: string;
  disabled?: boolean;
  history?: string[];
  historyIndex?: number;
  onHistoryChange?: (index: number) => void;
}

export const MultiLineInput: React.FC<MultiLineInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type your message...',
  disabled = false,
  history = [],
  historyIndex = -1,
  onHistoryChange,
}) => {
  const [attachedFiles, setAttachedFiles] = useState<ContentBlock[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without shift = submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Ctrl+D = Remove last attachment
    if (e.key === 'd' && e.ctrlKey && attachedFiles.length > 0) {
      e.preventDefault();
      setAttachedFiles(prev => prev.slice(0, -1));
      return;
    }

    // Up arrow at start of input = history navigation
    if (e.key === 'ArrowUp' && textareaRef.current?.selectionStart === 0 && history.length > 0 && onHistoryChange) {
      e.preventDefault();
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      onHistoryChange(newIndex);
      if (history[newIndex]) {
        onChange(history[newIndex]);
      }
      return;
    }

    // Down arrow at end of input = history navigation
    if (e.key === 'ArrowDown' && textareaRef.current?.selectionStart === value.length && history.length > 0 && onHistoryChange) {
      e.preventDefault();
      if (historyIndex === -1) return;

      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        onHistoryChange(-1);
        onChange('');
      } else {
        onHistoryChange(newIndex);
        if (history[newIndex]) {
          onChange(history[newIndex]);
        }
      }
      return;
    }
  };

  const handleSubmit = () => {
    const contentBlocks: ContentBlock[] = [];

    // Add text content if present
    if (value.trim()) {
      contentBlocks.push({
        type: 'text',
        content: value,
        text: value,
      });
    }

    // Add attached files/images
    contentBlocks.push(...attachedFiles);

    if (contentBlocks.length > 0) {
      onSubmit(contentBlocks.length === 1 && contentBlocks[0].type === 'text' ? value : contentBlocks);
      onChange('');
      setAttachedFiles([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ContentBlock[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      // Image files
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
      if (imageExts.includes(ext)) {
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            const base64Data = base64.split(',')[1]; // Remove data URL prefix
            newAttachments.push({
              type: 'image',
              content: base64Data,
              mimeType: file.type,
              fileName,
            });
            resolve();
          };
          reader.readAsDataURL(file);
        });
      } else {
        // Text files
        const textExts = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp'];
        if (textExts.includes(ext) && file.size < 1024 * 1024) {
          const text = await file.text();
          newAttachments.push({
            type: 'file',
            content: text,
            fileName,
          });
        }
      }
    }

    setAttachedFiles(prev => [...prev, ...newAttachments]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const lines = value.split('\n');

  return (
    <div className="multiline-input-container">
      <style jsx>{`
        .multiline-input-container {
          position: relative;
        }

        .attachments-preview {
          margin-bottom: 12px;
          padding: 12px;
          background: #0d1117;
          border: 2px solid #00d4ff;
          border-radius: 8px;
        }

        .attachments-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .attachments-title {
          color: #00d4ff;
          font-weight: bold;
          font-size: 14px;
        }

        .attachments-hint {
          color: #b3b9c5;
          opacity: 0.6;
          font-size: 11px;
        }

        .attachments-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .attachment-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #1a1f2e;
          border-radius: 6px;
        }

        .attachment-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #b3b9c5;
          font-size: 13px;
        }

        .attachment-icon {
          font-size: 16px;
        }

        .remove-button {
          padding: 4px 8px;
          background: #3a1a1a;
          border: 1px solid #ff4444;
          border-radius: 4px;
          color: #ff4444;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .remove-button:hover {
          background: #ff4444;
          color: #0a0e14;
        }

        .input-wrapper {
          position: relative;
          background: #1a1f2e;
          border: 2px solid #30363d;
          border-radius: 8px;
          padding: 12px;
          transition: border-color 0.2s;
        }

        .input-wrapper:focus-within {
          border-color: #ff9500;
        }

        .input-wrapper.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .prompt-symbol {
          color: #ff9500;
          font-weight: bold;
          font-size: 16px;
          position: absolute;
          left: 12px;
          top: 12px;
        }

        .textarea {
          width: 100%;
          min-height: 60px;
          max-height: 300px;
          padding-left: 20px;
          background: transparent;
          border: none;
          color: #ffffff;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          line-height: 1.6;
          resize: none;
          outline: none;
        }

        .textarea::placeholder {
          color: #b3b9c5;
          opacity: 0.5;
        }

        .textarea:disabled {
          cursor: not-allowed;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
        }

        .toolbar-left {
          display: flex;
          gap: 12px;
        }

        .attach-button {
          padding: 6px 12px;
          background: #1a3a1a;
          border: 1px solid #00ff9f;
          border-radius: 6px;
          color: #00ff9f;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .attach-button:hover {
          background: #00ff9f;
          color: #0a0e14;
        }

        .info-text {
          color: #b3b9c5;
          opacity: 0.7;
          font-size: 12px;
        }

        .line-info {
          color: #b3b9c5;
          opacity: 0.6;
          font-size: 11px;
        }

        .hidden-file-input {
          display: none;
        }
      `}</style>

      {/* Attachments Preview */}
      {attachedFiles.length > 0 && (
        <div className="attachments-preview">
          <div className="attachments-header">
            <span className="attachments-title">
              📎 Attachments ({attachedFiles.length})
            </span>
            <span className="attachments-hint">Ctrl+D to remove last</span>
          </div>
          <div className="attachments-list">
            {attachedFiles.map((file, idx) => (
              <div key={idx} className="attachment-item">
                <div className="attachment-info">
                  <span className="attachment-icon">
                    {file.type === 'image' ? '🖼️' : '📄'}
                  </span>
                  <span>{file.fileName || `attachment-${idx + 1}`}</span>
                </div>
                <button
                  className="remove-button"
                  onClick={() => removeAttachment(idx)}
                >
                  ✗ Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className={`input-wrapper ${disabled ? 'disabled' : ''}`}>
        <span className="prompt-symbol">&gt;</span>
        <textarea
          ref={textareaRef}
          className="textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button
            className="attach-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <span>📎</span>
            <span>Attach File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden-file-input"
            onChange={handleFileUpload}
            multiple
            accept="image/*,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.go,.rs,.java,.c,.cpp,.h,.hpp"
          />
        </div>

        <div className="info-text">
          Enter = send | Shift+Enter = new line | Esc = cancel
        </div>
      </div>

      {/* Line Info */}
      {lines.length > 1 && (
        <div className="line-info">
          {lines.length} lines | {value.length} chars
        </div>
      )}
    </div>
  );
};
