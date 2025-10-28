/**
 * Message Renderer Component
 * Displays messages with proper model headers and formatting
 * Supports multipart content (text, images, files)
 */
import React from 'react';
import { Box, Text } from 'ink';
import { Message, ContentBlock } from '../../core/models/unified-model-manager.js';

interface Props {
  messages: Array<Message & { model?: string; timestamp?: string }>;
  currentModel?: string;
}

// Helper to render content (string or content blocks)
const renderContent = (content: string | ContentBlock[]): JSX.Element => {
  // Legacy string content
  if (typeof content === 'string') {
    return <Text color="green">{content}</Text>;
  }

  // New content blocks format
  return (
    <Box flexDirection="column">
      {content.map((block, idx) => {
        if (block.type === 'text') {
          return (
            <Box key={idx}>
              <Text color="green">{block.text}</Text>
            </Box>
          );
        }

        if (block.type === 'image') {
          const sizeKB = Math.round(block.source.data.length * 0.75 / 1024); // Rough base64 to bytes
          return (
            <Box key={idx} flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginY={1}>
              <Text color="cyan" bold>🖼️  Image ({block.source.media_type})</Text>
              <Text color="gray" dimColor>Size: ~{sizeKB}KB</Text>
              <Text color="gray" dimColor>[Image data: {block.source.data.substring(0, 40)}...]</Text>
            </Box>
          );
        }

        if (block.type === 'file') {
          const lines = block.content.split('\n').length;
          return (
            <Box key={idx} flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginY={1}>
              <Text color="yellow" bold>📄 {block.name}</Text>
              <Text color="gray" dimColor>{lines} lines, {block.content.length} chars</Text>
              <Box marginTop={1} flexDirection="column">
                <Text color="white">{block.content.substring(0, 200)}</Text>
                {block.content.length > 200 && <Text color="gray" dimColor>...</Text>}
              </Box>
            </Box>
          );
        }

        return null;
      })}
    </Box>
  );
};

export const MessageRenderer: React.FC<Props> = ({ messages, currentModel }) => {
  return (
    <Box flexDirection="column">
      {messages.map((msg, index) => {
        if (msg.role === 'user') {
          return (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="orange" bold>
                  ●
                </Text>
              </Box>
              <Box marginLeft={2}>
                {renderContent(msg.content)}
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
                   {modelName}:
                </Text>
                {msg.timestamp && (
                  <Text color="green" dimColor>
                    {' '}
                    ({new Date(msg.timestamp).toLocaleTimeString()})
                  </Text>
                )}
              </Box>

              {msg.thinking && (
                <Box marginLeft={2} marginBottom={1}>
                  <Text color="cyan" dimColor>
                    💭 Thinking: {msg.thinking}
                  </Text>
                </Box>
              )}

              <Box marginLeft={2}>
                {renderContent(msg.content)}
              </Box>

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <Box marginLeft={2} marginTop={1}>
                  <Text color="blue">🔧 Tool Calls: {msg.toolCalls.length}</Text>
                </Box>
              )}
            </Box>
          );
        }

        // 🔥 SYSTEM MESSAGES - Tool results, status updates, errors
        if (msg.role === 'system') {
          return (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="cyan" bold>
                  ⚙️ SYSTEM
                </Text>
                {msg.timestamp && (
                  <Text color="cyan" dimColor>
                    {' '}
                    ({new Date(msg.timestamp).toLocaleTimeString()})
                  </Text>
                )}
              </Box>
              <Box marginLeft={2}>
                {typeof msg.content === 'string' ? (
                  <Text color="yellow">{msg.content}</Text>
                ) : (
                  renderContent(msg.content)
                )}
              </Box>
            </Box>
          );
        }

        return null;
      })}
    </Box>
  );
};
