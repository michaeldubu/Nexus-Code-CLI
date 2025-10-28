/**
 * Bash Approval Prompt Component
 * Shows bash command approval dialog
 */
import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  command: string;
  onApprove: () => void;
  onDeny: () => void;
  onAlwaysApprove: () => void;
  onAlwaysDeny: () => void;
}

export const BashApprovalPrompt: React.FC<Props> = ({ command }) => {
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="orange">
      <Box>
        <Text color="orange" bold>
          ⚠️  Bash Command Approval Required
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="green">Command: </Text>
        <Text color="orange" bold>
          {command}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="green">1 - Approve once</Text>
        <Text color="cyan">2 - Approve for this session</Text>
        <Text color="green" bold>3 - Always approve (saved)</Text>
        <Text color="red">4 - Deny once</Text>
        <Text color="magenta">5 - Deny for this session</Text>
        <Text color="red" bold>6 - Always deny (saved)</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press 1-6 to respond
        </Text>
      </Box>
    </Box>
  );
};
