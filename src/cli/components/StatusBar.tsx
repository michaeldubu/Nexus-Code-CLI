/**
 * Status Bar Component
 * Shows current model(s), working directory, and session info
 */
import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  models: string[];
  workingDir: string;
  messageCount: number;
  thinkingEnabled?: boolean;
  reasoningLevel?: string;
  mode?: string; // Editing mode: normal, plan, autoedit, yolo
  mcpConnected?: boolean; // JetBrains plugin connection status
}

export const StatusBar: React.FC<Props> = ({
  models,
  workingDir,
  messageCount,
  thinkingEnabled,
  reasoningLevel,
  mode,
  mcpConnected,
}) => {
  // Truncate working directory if too long
  const truncatedDir = workingDir.length > 30 ? '...' + workingDir.slice(-27) : workingDir;

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="row">
        {/* Horizontal layout - everything in one line */}
        <Text color="cyan" bold>{'>'} </Text>

        {/* Model(s) */}
        <Text color="cyan">Model: </Text>
        <Text color="cyanBright" bold>{models.join('+')}</Text>
        <Text color="gray"> │ </Text>

        {/* Working Directory */}
        <Text color="cyan">Dir: </Text>
        <Text color="gray" dimColor>{truncatedDir}</Text>
        <Text color="gray"> │ </Text>

        {/* Messages */}
        <Text color="cyan">Msgs: </Text>
        <Text color="white">{messageCount}</Text>

        {/* Thinking/Reasoning */}
        {thinkingEnabled !== undefined && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="cyan">Thinking: </Text>
            <Text color={thinkingEnabled ? 'green' : 'gray'} bold={thinkingEnabled}>
              {thinkingEnabled ? 'ON' : 'OFF'}
            </Text>
          </>
        )}

        {reasoningLevel && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="cyan">Reasoning: </Text>
            <Text color="green" bold>{reasoningLevel.toUpperCase()}</Text>
          </>
        )}

        {/* Mode */}
        {mode && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="cyan">Mode: </Text>
            <Text
              color={mode === 'yolo' ? 'red' : mode === 'plan' ? 'cyan' : mode === 'autoedit' ? 'yellow' : 'white'}
              bold={mode !== 'normal'}
            >
              {mode.toUpperCase()}
            </Text>
          </>
        )}

        {/* MCP Status */}
        {mcpConnected !== undefined && (
          <>
            <Text color="gray"> │ </Text>
            <Text color={mcpConnected ? 'green' : 'gray'} bold={mcpConnected}>
              {mcpConnected ? '🧠 MCP' : '⚪ MCP'}
            </Text>
          </>
        )}
      </Box>

      {/* Help text below status bar - separate from border */}
      <Box paddingX={2} marginTop={0}>
        <Text color="gray" dimColor>
          Shift+Enter=newline │ Tab=thinking │ Ctrl+R=reasoning │ Shift+Tab=mode
        </Text>
      </Box>
    </Box>
  );
};
