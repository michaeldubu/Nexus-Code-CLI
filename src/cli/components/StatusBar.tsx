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
}

export const StatusBar: React.FC<Props> = ({
  models,
  workingDir,
  messageCount,
  thinkingEnabled,
  reasoningLevel,
  mode,
}) => {
  // Truncate working directory if too long
  const truncatedDir = workingDir.length > 30 ? '...' + workingDir.slice(-27) : workingDir;

  return (
    <Box borderStyle="single" borderColor="green" paddingX={1}>
      {/* Horizontal layout - everything in one line */}
      <Text color="green" bold>{'>'} </Text>

      {/* Model(s) */}
      <Text color="green">Model: </Text>
      <Text color="greenBright" bold>{models.join('+')}</Text>
      <Text color="green"> │ </Text>

      {/* Working Directory */}
      <Text color="green">Dir: </Text>
      <Text color="gray" dimColor>{truncatedDir}</Text>
      <Text color="green"> │ </Text>

      {/* Messages */}
      <Text color="green">Msgs: </Text>
      <Text color="gray">{messageCount}</Text>

      {/* Thinking/Reasoning */}
      {thinkingEnabled !== undefined && (
        <>
          <Text color="green"> │ Thinking: </Text>
          <Text color={thinkingEnabled ? 'greenBright' : 'gray'} bold={thinkingEnabled}>
            {thinkingEnabled ? 'ON' : 'OFF'}
          </Text>
        </>
      )}

      {reasoningLevel && (
        <>
          <Text color="green"> │ Reasoning: </Text>
          <Text color="greenBright" bold>{reasoningLevel.toUpperCase()}</Text>
        </>
      )}

      {/* Mode */}
      {mode && (
        <>
          <Text color="green"> │ Mode: </Text>
          <Text
            color={mode === 'yolo' ? 'red' : mode === 'plan' ? 'cyan' : mode === 'autoedit' ? 'yellow' : 'white'}
            bold={mode !== 'normal'}
          >
            {mode.toUpperCase()}
          </Text>
        </>
      )}

      <Text color="gray" dimColor> │ Tab=toggle | Shift+Tab=mode</Text>
    </Box>
  );
};
