/**
 * Multi-Line Input Component
 * Supports newlines with Enter, submit with Shift+Enter or Ctrl+Enter
 * Supports image/file paste detection
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'fs';
import path from 'path';

export interface ContentBlock {
  type: 'text' | 'image' | 'file';
  content: string;
  mimeType?: string;
  fileName?: string;
}

interface MultiLineInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (content: ContentBlock[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const MultiLineInput: React.FC<MultiLineInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type your message...',
  disabled = false,
}) => {
  const [cursorOffset, setCursorOffset] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<ContentBlock[]>([]);

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (disabled) return;

      // Check for newline character (Shift+Enter produces '\n' in some terminals)
      if (input === '\n' || (input === '\r' && key.shift)) {
        const newValue =
          value.slice(0, cursorOffset) + '\n' + value.slice(cursorOffset);
        onChange(newValue);
        setCursorOffset(cursorOffset + 1);
        return;
      }

      // Shift+Enter = New line (like every chat app)
      if (key.return && key.shift) {
        const newValue =
          value.slice(0, cursorOffset) + '\n' + value.slice(cursorOffset);
        onChange(newValue);
        setCursorOffset(cursorOffset + 1);
        return;
      }

      // Regular Enter = Submit (send the message)
      if (key.return && !key.shift) {
        handleSubmit();
        return;
      }

      // Backspace
      if (key.backspace || key.delete) {
        if (cursorOffset > 0) {
          const newValue =
            value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
          onChange(newValue);
          setCursorOffset(cursorOffset - 1);
        }
        return;
      }

      // Arrow keys for cursor movement
      if (key.leftArrow && cursorOffset > 0) {
        setCursorOffset(cursorOffset - 1);
        return;
      }

      if (key.rightArrow && cursorOffset < value.length) {
        setCursorOffset(cursorOffset + 1);
        return;
      }

      if (key.upArrow) {
        // Move cursor to previous line
        const lines = value.slice(0, cursorOffset).split('\n');
        if (lines.length > 1) {
          const currentLinePos = lines[lines.length - 1].length;
          const prevLineLength = lines[lines.length - 2].length;
          const newOffset = cursorOffset - currentLinePos - 1 - Math.min(currentLinePos, prevLineLength);
          setCursorOffset(Math.max(0, newOffset));
        }
        return;
      }

      if (key.downArrow) {
        // Move cursor to next line
        const afterCursor = value.slice(cursorOffset);
        const nextNewline = afterCursor.indexOf('\n');
        if (nextNewline !== -1) {
          const lines = value.slice(0, cursorOffset).split('\n');
          const currentLinePos = lines[lines.length - 1].length;
          const nextLine = afterCursor.slice(nextNewline + 1);
          const nextNewline2 = nextLine.indexOf('\n');
          const nextLineLength = nextNewline2 !== -1 ? nextNewline2 : nextLine.length;
          const newOffset = cursorOffset + nextNewline + 1 + Math.min(currentLinePos, nextLineLength);
          setCursorOffset(Math.min(value.length, newOffset));
        }
        return;
      }

      // Ctrl+V - Check for file paths in clipboard (simplified detection)
      if (key.ctrl && input === 'v') {
        // In a real implementation, you'd use clipboard libraries
        // For now, we'll handle file path detection differently
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        const newValue =
          value.slice(0, cursorOffset) + input + value.slice(cursorOffset);
        onChange(newValue);
        setCursorOffset(cursorOffset + input.length);
      }
    },
    { isActive: !disabled }
  );

  const handleSubmit = () => {
    const contentBlocks: ContentBlock[] = [];

    // Add text content if present
    if (value.trim()) {
      contentBlocks.push({
        type: 'text',
        content: value,
      });
    }

    // Add attached files/images
    contentBlocks.push(...attachedFiles);

    if (contentBlocks.length > 0) {
      onSubmit(contentBlocks);
      onChange('');
      setCursorOffset(0);
      setAttachedFiles([]);
    }
  };

  // Handle file attachment (called externally or via special command)
  const attachFile = (filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);

      // Image files
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
      if (imageExts.includes(ext)) {
        const imageData = fs.readFileSync(filePath);
        const base64 = imageData.toString('base64');
        const mimeType =
          ext === '.png' ? 'image/png' :
          ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
          ext === '.gif' ? 'image/gif' :
          ext === '.webp' ? 'image/webp' :
          'image/bmp';

        setAttachedFiles([
          ...attachedFiles,
          {
            type: 'image',
            content: base64,
            mimeType,
            fileName,
          },
        ]);
      } else {
        // Text files
        const textExts = ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs'];
        if (textExts.includes(ext) && fs.statSync(filePath).size < 1024 * 1024) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          setAttachedFiles([
            ...attachedFiles,
            {
              type: 'file',
              content: fileContent,
              fileName,
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Error attaching file:', error);
    }
  };

  // Split value into lines for display
  const lines = value.split('\n');
  const currentLine = value.slice(0, cursorOffset).split('\n').length - 1;
  const currentColumn = value.slice(0, cursorOffset).split('\n').pop()?.length || 0;

  return (
    <Box flexDirection="column">
      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text color="cyan" bold>📎 Attachments ({attachedFiles.length}):</Text>
          {attachedFiles.map((file, idx) => (
            <Box key={idx} marginLeft={2}>
              <Text color="gray">
                {file.type === 'image' ? '🖼️' : '📄'} {file.fileName || `attachment-${idx + 1}`}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Input area */}
      <Box flexDirection="column" borderStyle="round" borderColor="orange" paddingX={1}>
        {lines.map((line, idx) => (
          <Box key={idx}>
            <Text color="orange" bold>{idx === 0 ? '> ' : '  '}</Text>
            <Text color="white">
              {line || (idx === 0 && !value ? <Text dimColor>{placeholder}</Text> : ' ')}
              {idx === currentLine && (
                <Text backgroundColor="orange" color="black">
                  {value[cursorOffset] || ' '}
                </Text>
              )}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Help text */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Enter = send | Shift+Enter = new line | Esc = cancel
        </Text>
      </Box>

      {/* Line info */}
      {lines.length > 1 && (
        <Box marginTop={0}>
          <Text color="gray" dimColor>
            Line {currentLine + 1}, Col {currentColumn} | {value.length} chars
          </Text>
        </Box>
      )}
    </Box>
  );
};
