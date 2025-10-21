/**
 * Message Renderer Component
 * Displays messages with proper model headers and formatting
 */
import React from 'react';
import { Box, Text } from 'ink';
import { Message } from '../../core/models/unified-model-manager.js';

interface Props {
  messages: Array<Message & { model?: string; timestamp?: string }>;
  currentModel?: string;
}

export const MessageRenderer: React.FC<Props> = ({ messages, currentModel }) => {
  return (
    <Box flexDirection="column">
      {messages.map((msg, index) => {
        if (msg.role === 'user') {
          return (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="cyan" bold>
                  You:
                </Text>
              </Box>
              <Box marginLeft={2}>
                <Text color="white">{msg.content}</Text>
              </Box>
            </Box>
          );
        }

        if (msg.role === 'assistant') {
          const modelName = msg.model || currentModel || 'AI';

          return (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="green" bold>
                  🤖 {modelName}:
                </Text>
                {msg.timestamp && (
                  <Text color="gray" dimColor>
                    {' '}
                    ({new Date(msg.timestamp).toLocaleTimeString()})
                  </Text>
                )}
              </Box>

              {msg.thinking && (
                <Box marginLeft={2} marginBottom={1}>
                  <Text color="gray" dimColor>
                    💭 Thinking: {msg.thinking.substring(0, 200)}
                    {msg.thinking.length > 200 ? '...' : ''}
                  </Text>
                </Box>
              )}

              <Box marginLeft={2}>
                <Text color="white">{msg.content}</Text>
              </Box>

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <Box marginLeft={2} marginTop={1}>
                  <Text color="yellow">🔧 Tool Calls: {msg.toolCalls.length}</Text>
                </Box>
              )}
            </Box>
          );
        }

        return null;
      })}
    </Box>
  );
};
