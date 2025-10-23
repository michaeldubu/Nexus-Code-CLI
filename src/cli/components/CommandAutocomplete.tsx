/**
 * Command Autocomplete Component
 * Shows command suggestions when user types "/"
 */
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

export interface Command {
  name: string;
  description: string;
  category?: string;
}

interface Props {
  commands: Command[];
  filter: string;
  selectedIndex: number;
  onSelect: (command: Command) => void;
  onCancel: () => void;
}

export const CommandAutocomplete: React.FC<Props> = ({
  commands,
  filter,
  selectedIndex,
}) => {
  const filtered = commands.filter((cmd) =>
    cmd.name.toLowerCase().startsWith((filter || '').toLowerCase())
  );

  if (filtered.length === 0) {
    return null; // Don't show anything if no matches
  }

  // Show max 10 commands with scrolling window
  const MAX_VISIBLE = 10;
  const startIndex = Math.max(0, Math.min(selectedIndex - 5, filtered.length - MAX_VISIBLE));
  const endIndex = Math.min(filtered.length, startIndex + MAX_VISIBLE);
  const visibleCommands = filtered.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="green">
      <Box marginBottom={1}>
        <Text color="green" bold>
          Available Commands {filtered.length > MAX_VISIBLE ? `(${selectedIndex + 1}/${filtered.length})` : ''}
        </Text>
      </Box>

      {visibleCommands.map((cmd, index) => {
        const actualIndex = startIndex + index;
        const isSelected = actualIndex === selectedIndex;
        const icon = isSelected ? '→' : ' ';
        const nameColor = isSelected ? 'green' : 'white';
        const descColor = isSelected ? 'gray' : 'gray';

        return (
          <Box key={cmd.name} marginLeft={1}>
            <Text color={nameColor}>
              {icon} {cmd.name.padEnd(20)}
            </Text>
            <Text color={descColor}>{cmd.description.substring(0, 50)}</Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ Navigate | Enter = Select | Esc = Cancel | Type to filter
        </Text>
      </Box>
    </Box>
  );
};
