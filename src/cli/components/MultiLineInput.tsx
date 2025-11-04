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
  history?: string[]; // Command history for up/down navigation
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
  const [cursorOffset, setCursorOffset] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<ContentBlock[]>([]);
  const [lastInputLength, setLastInputLength] = useState(0);

  // Safety net: keep cursor within bounds when value changes externally
  useEffect(() => {
    if (cursorOffset > value.length) {
      setCursorOffset(value.length);
    }
  }, [value.length]);

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (disabled) return;

      // Ctrl+D = Remove last attachment
      if (key.ctrl && input === 'd' && attachedFiles.length > 0) {
        setAttachedFiles(prev => prev.slice(0, -1));
        return;
      }

      // Shift+Enter = newline (the CORRECT way)
      if (key.return && key.shift) {
        const newValue =
          value.slice(0, cursorOffset) + '\n' + value.slice(cursorOffset);
        onChange(newValue);
        setCursorOffset(cursorOffset + 1);
        return;
      }

      // Backslash+Enter = newline (bandaid, but keeping it since it works)
      if (key.return && value[cursorOffset - 1] === '\\') {
        // Remove the backslash and add newline
        const newValue =
          value.slice(0, cursorOffset - 1) + '\n' + value.slice(cursorOffset);
        onChange(newValue);
        setCursorOffset(cursorOffset);
        return;
      }

      // Regular Enter = Submit (send the message)
      if (key.return) {
        handleSubmit();
        return;
      }

      // Backspace - delete character BEFORE cursor
      // Note: Most terminals send backspace as charCode 127, which Ink interprets as key.delete
      // So we treat both key.backspace and key.delete as backwards delete (like the original)
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
        const lines = value.split('\n');
        const currentLineIndex = value.slice(0, cursorOffset).split('\n').length - 1;

        // If on first line and we have history, navigate history
        if (currentLineIndex === 0 && history.length > 0 && onHistoryChange) {
          const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
          onHistoryChange(newIndex);
          if (history[newIndex]) {
            onChange(history[newIndex]);
            setCursorOffset(history[newIndex].length);
          }
        } else if (currentLineIndex > 0) {
          // Move cursor to previous line within multi-line input
          const linesBefore = value.slice(0, cursorOffset).split('\n');
          const currentLinePos = linesBefore[linesBefore.length - 1].length;
          const prevLineLength = linesBefore[linesBefore.length - 2].length;
          const newOffset = cursorOffset - currentLinePos - 1 - Math.min(currentLinePos, prevLineLength);
          setCursorOffset(Math.max(0, newOffset));
        }
        return;
      }

      if (key.downArrow) {
        const lines = value.split('\n');
        const currentLineIndex = value.slice(0, cursorOffset).split('\n').length - 1;

        // If on last line and we have history, navigate forward
        if (currentLineIndex === lines.length - 1 && history.length > 0 && onHistoryChange) {
          if (historyIndex === -1) return; // Already at current input

          const newIndex = historyIndex + 1;
          if (newIndex >= history.length) {
            // Return to current input
            onHistoryChange(-1);
            onChange('');
            setCursorOffset(0);
          } else {
            onHistoryChange(newIndex);
            if (history[newIndex]) {
              onChange(history[newIndex]);
              setCursorOffset(history[newIndex].length);
            }
          }
        } else {
          // Move cursor to next line within multi-line input
          const afterCursor = value.slice(cursorOffset);
          const nextNewline = afterCursor.indexOf('\n');
          if (nextNewline !== -1) {
            const linesBefore = value.slice(0, cursorOffset).split('\n');
            const currentLinePos = linesBefore[linesBefore.length - 1].length;
            const nextLine = afterCursor.slice(nextNewline + 1);
            const nextNewline2 = nextLine.indexOf('\n');
            const nextLineLength = nextNewline2 !== -1 ? nextNewline2 : nextLine.length;
            const newOffset = cursorOffset + nextNewline + 1 + Math.min(currentLinePos, nextLineLength);
            setCursorOffset(Math.min(value.length, newOffset));
          }
        }
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        // Detect paste (large input at once)
        const isPaste = input.length > 50; // More than 50 chars = probably a paste
        const pastedLines = input.split('\n');
        const isPasteMultiline = pastedLines.length > 3;

        let finalInput = input;

        // Wrap large pastes in [Pasted X Lines] format
        if (isPaste && isPasteMultiline) {
          finalInput = `[Pasted ${pastedLines.length} Lines]\n${input}`;
        }

        const newValue =
          value.slice(0, cursorOffset) + finalInput + value.slice(cursorOffset);
        const newCursor = cursorOffset + finalInput.length;

        onChange(newValue);
        setCursorOffset(newCursor);
        setLastInputLength(newValue.length);

        // Auto-detect file paths when user types/pastes them
        // Look for patterns like /path/to/file.png or ./relative/path.jpg
        const pathPattern = /(?:\.\/|\/|~\/)[^\s]+\.(png|jpg|jpeg|gif|webp|bmp|txt|md|json|js|ts|tsx|jsx|py|go|rs)/gi;
        const matches = newValue.match(pathPattern);

        if (matches && matches.length > 0) {
          // Get the last match (most recently typed/pasted path)
          const lastPath = matches[matches.length - 1];

          // Check if we haven't already attached this file
          const alreadyAttached = attachedFiles.some(f => f.fileName === path.basename(lastPath));

          if (!alreadyAttached && fs.existsSync(lastPath)) {
            // Auto-attach the file and remove the path from text
            setTimeout(() => {
              attachFile(lastPath);
              // Remove the file path from the input text
              const cleanedValue = newValue.replace(lastPath, '').trim();
              onChange(cleanedValue);
              setCursorOffset(cleanedValue.length);
            }, 10);
          }
        }
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

        setAttachedFiles(prev => [
          ...prev,
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
          setAttachedFiles(prev => [
            ...prev,
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
          <Text color="cyan" bold>📎 Attachments ({attachedFiles.length}) - Ctrl+D to remove last</Text>
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
        {lines.map((line, idx) => {
          // Render line with cursor if this is the current line
          if (idx === currentLine) {
            const beforeCursor = line.slice(0, currentColumn);
            const afterCursor = line.slice(currentColumn);

            return (
              <Box key={idx}>
                <Text color="orange" bold>{idx === 0 ? '> ' : '  '}</Text>
                <Text color="white">
                  {beforeCursor}
                  <Text color="green" bold>▋</Text>
                  {afterCursor}
                </Text>
              </Box>
            );
          } else {
            // Regular line without cursor
            return (
              <Box key={idx}>
                <Text color="orange" bold>{idx === 0 ? '> ' : '  '}</Text>
                <Text color="white">
                  {line || (idx === 0 && !value ? <Text dimColor>{placeholder}</Text> : ' ')}
                </Text>
              </Box>
            );
          }
        })}
      </Box>

      {/* Help text */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Enter = send | \+Enter = new line | Esc = cancel
        </Text>
      </Box>

      {/* Line info */}
      {lines.length > 1 && (
        <Box marginTop={0}>
          <Text color="gray" dimColor>
            Line {currentLine + 1}, Col {currentColumn + 1} | {value.length} chars
          </Text>
        </Box>
      )}
    </Box>
  );
};
