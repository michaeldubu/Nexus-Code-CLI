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
}

export const StatusBar: React.FC<Props> = ({
  models,
  workingDir,
  messageCount,
  thinkingEnabled,
  reasoningLevel,
}) => {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green" padding={1}>
      <Box>
        <Text color="green" bold>
          {'>'} STATUS REPORT:
        </Text>
      </Box>

      <Box marginLeft={2}>
        <Text color="green">└─ Model(s): </Text>
        <Text color="greenBright" bold>
          {models.join(' + ')}
        </Text>
      </Box>

      <Box marginLeft={2}>
        <Text color="green">└─ Working Dir: </Text>
        <Text color="gray" dimColor>
          {workingDir}
        </Text>
      </Box>

      {thinkingEnabled !== undefined && (
        <Box marginLeft={2}>
          <Text color="green">└─ Extended Thinking: </Text>
          <Text color={thinkingEnabled ? 'greenBright' : 'gray'} bold={thinkingEnabled}>
            {thinkingEnabled ? 'ON' : 'OFF'}
          </Text>
          <Text color="gray" dimColor>
            {' '}
            (Tab to toggle)
          </Text>
        </Box>
      )}

      {reasoningLevel && (
        <Box marginLeft={2}>
          <Text color="green">└─ Reasoning: </Text>
          <Text color="greenBright" bold>
            {reasoningLevel.toUpperCase()}
          </Text>
          <Text color="gray" dimColor>
            {' '}
            (Tab to toggle)
          </Text>
        </Box>
      )}

      <Box marginLeft={2}>
        <Text color="green">└─ Messages: </Text>
        <Text color="gray">{messageCount}</Text>
      </Box>
    </Box>
  );
};
