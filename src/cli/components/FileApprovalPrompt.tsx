/**
 * File Approval Prompt Component
 * Shows file operation (write/edit) approval dialog
 */
import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  operation: string;
  filePath: string;
  details?: string;
}

export const FileApprovalPrompt: React.FC<Props> = ({ operation, filePath, details }) => {
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Box>
        <Text color="cyan" bold>
          📝  File Operation Approval Required
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="white">Operation: </Text>
        <Text color="yellow" bold>
          {operation.toUpperCase()}
        </Text>
      </Box>

      <Box>
        <Text color="white">File: </Text>
        <Text color="cyan" bold>
          {filePath}
        </Text>
      </Box>

      {details && (
        <Box marginTop={1}>
          <Text color="gray">{details}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color="green">y - Approve once</Text>
        <Text color="green">a - Always approve (add directory to workspace)</Text>
        <Text color="red">n - Deny once</Text>
        <Text color="red">d - Always deny (block directory)</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press y/a/n/d to respond
        </Text>
      </Box>
    </Box>
  );
};
