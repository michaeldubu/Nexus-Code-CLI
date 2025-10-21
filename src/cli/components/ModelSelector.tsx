/**
 * Model Selector Component
 * Multi-select model chooser with checkboxes
 */
import React from 'react';
import { Box, Text } from 'ink';
import { ModelConfig } from '../../core/models/unified-model-manager.js';

interface Props {
  models: ModelConfig[];
  selectedModels: string[];
  cursorIndex: number;
  onToggle: (modelId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ModelSelector: React.FC<Props> = ({
  models,
  selectedModels,
  cursorIndex,
}) => {
  // Group by provider
  const anthropicModels = models.filter((m) => m.provider === 'anthropic');
  const openaiModels = models.filter((m) => m.provider === 'openai');
  const googleModels = models.filter((m) => m.provider === 'google');

  let currentIndex = 0;

  const renderModel = (model: ModelConfig) => {
    const isSelected = selectedModels.includes(model.id);
    const isCursor = currentIndex === cursorIndex;
    const checkbox = isSelected ? '☑' : '☐';
    const cursor = isCursor ? '→' : ' ';
    const nameColor = isCursor ? 'green' : isSelected ? 'cyan' : 'white';

    const features = [];
    if (model.supportsThinking) features.push('Thinking');
    if (model.supportsReasoning) features.push('Reasoning');
    if (model.supportsVision) features.push('Vision');

    const result = (
      <Box key={model.id} marginLeft={1}>
        <Text color="cyan">║ </Text>
        <Text color={nameColor}>
          {cursor} {checkbox} {model.name.padEnd(25)}
        </Text>
        <Text color="gray">{features.join(', ').padEnd(25)}</Text>
        <Text color="cyan">║</Text>
      </Box>
    );

    currentIndex++;
    return result;
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="cyan" bold>
          ╔═══════════════════════════════════════════════════════════════╗
        </Text>
      </Box>
      <Box>
        <Text color="cyan" bold>
          ║  Select Models (Multi-Select){' '.repeat(32)}║
        </Text>
      </Box>
      <Box>
        <Text color="cyan" bold>
          ╠═══════════════════════════════════════════════════════════════╣
        </Text>
      </Box>

      {anthropicModels.length > 0 && (
        <>
          <Box marginLeft={1} marginTop={1}>
            <Text color="cyan">║ </Text>
            <Text color="yellow" bold>
              Anthropic Models:
            </Text>
          </Box>
          {anthropicModels.map(renderModel)}
        </>
      )}

      {openaiModels.length > 0 && (
        <>
          <Box marginLeft={1} marginTop={1}>
            <Text color="cyan">║ </Text>
            <Text color="yellow" bold>
              OpenAI Models:
            </Text>
          </Box>
          {openaiModels.map(renderModel)}
        </>
      )}

      {googleModels.length > 0 && (
        <>
          <Box marginLeft={1} marginTop={1}>
            <Text color="cyan">║ </Text>
            <Text color="yellow" bold>
              Google Models:
            </Text>
          </Box>
          {googleModels.map(renderModel)}
        </>
      )}

      <Box marginTop={1}>
        <Text color="cyan" bold>
          ╚═══════════════════════════════════════════════════════════════╝
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="green">
          Selected: {selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ Navigate | Space = Toggle | Enter = Confirm | Esc = Cancel
        </Text>
      </Box>
    </Box>
  );
};
