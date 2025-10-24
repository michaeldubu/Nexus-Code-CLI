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
        <Text color="green">y - Approve once</Text>
        <Text color="green">a - Always approve this command</Text>
        <Text color="red">n - Deny once</Text>
        <Text color="red">d - Always deny this command</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press y/a/n/d to respond
        </Text>
      </Box>
    </Box>
  );
};
