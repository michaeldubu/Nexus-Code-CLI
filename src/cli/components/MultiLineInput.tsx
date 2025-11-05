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
  const [cursorOffset, setCursorOffset] = useState(value.length); // Start at end
  const [attachedFiles, setAttachedFiles] = useState<ContentBlock[]>([]);
  const [showFullContent, setShowFullContent] = useState(true); // For paste truncation

  // Sync cursor with value length when value changes externally (like after submit)
  React.useEffect(() => {
    if (value === '') {
      setCursorOffset(0);
      setShowFullContent(true);
    }
  }, [value]);

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
        setShowFullContent(true); // Show full when user edits
        return;
      }

      // Backslash+Enter = New line (like Claude Code! 🔥)
      if (key.return && value[cursorOffset - 1] === '\\') {
        // Remove the backslash and add newline
        const newValue =
          value.slice(0, cursorOffset - 1) + '\n' + value.slice(cursorOffset);
        onChange(newValue);
        setCursorOffset(cursorOffset);
        setShowFullContent(true);
        return;
      }

      // Regular Enter = Submit (send the message)
      if (key.return) {
        handleSubmit();
        return;
      }

      // Backspace (backward delete)
      if (key.backspace) {
        if (cursorOffset > 0) {
          const newValue =
            value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
          onChange(newValue);
          setCursorOffset(cursorOffset - 1);
          setShowFullContent(true);
        }
        return;
      }

      // Delete (forward delete)
      if (key.delete) {
        if (cursorOffset < value.length) {
          const newValue =
            value.slice(0, cursorOffset) + value.slice(cursorOffset + 1);
          onChange(newValue);
          setShowFullContent(true);
          // Cursor stays in same position
        }
        return;
      }

      // Arrow keys for cursor movement - SIMPLIFIED!
      if (key.leftArrow) {
        setCursorOffset(Math.max(0, cursorOffset - 1));
        return;
      }

      if (key.rightArrow) {
        setCursorOffset(Math.min(value.length, cursorOffset + 1));
        return;
      }

      if (key.upArrow) {
        // Move cursor up one line
        const beforeCursor = value.slice(0, cursorOffset);
        const lines = beforeCursor.split('\n');

        if (lines.length > 1) {
          // Get current position in line
          const currentLineStart = beforeCursor.lastIndexOf('\n', cursorOffset - 1);
          const currentCol = cursorOffset - currentLineStart - 1;

          // Find previous line start
          const prevLineEnd = currentLineStart;
          const prevLineStart = beforeCursor.lastIndexOf('\n', prevLineEnd - 1);
          const prevLineLength = prevLineEnd - prevLineStart - 1;

          // Move to same column in previous line (or end if shorter)
          const targetCol = Math.min(currentCol, prevLineLength);
          const newOffset = prevLineStart + 1 + targetCol;

          setCursorOffset(Math.max(0, newOffset));
        }
        return;
      }

      if (key.downArrow) {
        // Move cursor down one line
        const afterCursor = value.slice(cursorOffset);
        const nextNewlineIdx = afterCursor.indexOf('\n');

        if (nextNewlineIdx !== -1) {
          // Get current position in line
          const beforeCursor = value.slice(0, cursorOffset);
          const currentLineStart = beforeCursor.lastIndexOf('\n') + 1;
          const currentCol = cursorOffset - currentLineStart;

          // Find next line
          const nextLineStart = cursorOffset + nextNewlineIdx + 1;
          const restOfText = value.slice(nextLineStart);
          const nextLineEnd = restOfText.indexOf('\n');
          const nextLineLength = nextLineEnd !== -1 ? nextLineEnd : restOfText.length;

          // Move to same column in next line (or end if shorter)
          const targetCol = Math.min(currentCol, nextLineLength);
          const newOffset = nextLineStart + targetCol;

          setCursorOffset(Math.min(value.length, newOffset));
        }
        return;
      }

      // Home key - start of line
      if (key.home) {
        const beforeCursor = value.slice(0, cursorOffset);
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        setCursorOffset(lineStart);
        return;
      }

      // End key - end of line
      if (key.end) {
        const afterCursor = value.slice(cursorOffset);
        const lineEnd = afterCursor.indexOf('\n');
        const newOffset = lineEnd === -1 ? value.length : cursorOffset + lineEnd;
        setCursorOffset(newOffset);
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        // Detect large paste (>100 chars at once)
        const isPaste = input.length > 100;

        const newValue =
          value.slice(0, cursorOffset) + input + value.slice(cursorOffset);
        onChange(newValue);
        setCursorOffset(cursorOffset + input.length);

        // If large paste, hide full content initially
        if (isPaste) {
          setShowFullContent(false);
        } else {
          setShowFullContent(true);
        }

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

  // Determine display value (truncated for large pastes)
  let displayValue = value;
  let isTruncated = false;

  if (!showFullContent && value.length > 0) {
    const lines = value.split('\n');
    if (lines.length > 10) {
      // Show first 3 lines and last 2 lines with summary in between
      const firstLines = lines.slice(0, 3).join('\n');
      const lastLines = lines.slice(-2).join('\n');
      const lineCount = lines.length;
      displayValue = `${firstLines}\n\n[pasted content...${lineCount} lines]\n\n${lastLines}`;
      isTruncated = true;
    } else if (value.length > 500) {
      // Just show first 500 chars
      displayValue = value.substring(0, 500) + `\n\n[pasted content...${value.length} chars]`;
      isTruncated = true;
    }
  }

  // Split value into lines for display
  const lines = displayValue.split('\n');
  const currentLine = isTruncated ? 0 : value.slice(0, cursorOffset).split('\n').length - 1;
  const currentColumn = isTruncated ? 0 : value.slice(0, cursorOffset).split('\n').pop()?.length || 0;

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

      {/* Truncation hint */}
      {isTruncated && (
        <Box marginBottom={1}>
          <Text color="yellow" dimColor>
            💡 Large content pasted - showing preview. Full content will be sent. (Start typing to see all)
          </Text>
        </Box>
      )}

      {/* Input area */}
      <Box flexDirection="column" borderStyle="round" borderColor="orange" paddingX={1}>
        {lines.map((line, idx) => {
          // Render line with cursor if this is the current line (only when not truncated)
          if (!isTruncated && idx === currentLine) {
            const beforeCursor = line.slice(0, currentColumn);
            const atCursor = line[currentColumn] || ' ';
            const afterCursor = line.slice(currentColumn + 1);

            return (
              <Box key={idx}>
                <Text color="orange" bold>{idx === 0 ? '> ' : '  '}</Text>
                <Text color="white">
                  {beforeCursor}
                  <Text backgroundColor="orange" color="black">{atCursor}</Text>
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
          Enter = send | \+Enter = new line | ↑↓←→ = navigate | Home/End = line start/end
        </Text>
      </Box>

      {/* Line info */}
      {!isTruncated && lines.length > 1 && (
        <Box marginTop={0}>
          <Text color="gray" dimColor>
            Line {currentLine + 1}/{lines.length}, Col {currentColumn + 1} | {value.length} chars
          </Text>
        </Box>
      )}
      {isTruncated && (
        <Box marginTop={0}>
          <Text color="gray" dimColor>
            {value.split('\n').length} lines, {value.length} chars (preview mode)
          </Text>
        </Box>
      )}
    </Box>
  );
};
