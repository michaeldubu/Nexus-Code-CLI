/**
 * Input Prompt Component
 * Handles user input with "/" command detection
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCommandDetected: (partial: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const InputPrompt: React.FC<Props> = ({
  value,
  onChange,
  onSubmit,
  onCommandDetected,
  placeholder = 'Type your message...',
  disabled = false,
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);

    // Detect "/" commands
    if (newValue.startsWith('/')) {
      onCommandDetected(newValue);
    }
  };

  const handleSubmit = () => {
    if (localValue.trim()) {
      onSubmit(localValue);
      setLocalValue('');
    }
  };

  return (
    <Box>
      <Text color="green" bold>
        {'> '}
      </Text>
      {!disabled ? (
        <TextInput
          value={localValue}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      ) : (
        <Text color="orange" dimColor>
          {placeholder}
        </Text>
      )}
    </Box>
  );
};
