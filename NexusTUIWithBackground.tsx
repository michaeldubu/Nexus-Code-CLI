/**
 * Nexus TUI with Animated Background
 * Integrates particle background with the main TUI interface
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { BootSequence, NEXUS_ART } from './BootSequence';
import TerminalParticleBackground from './TerminalParticleBackground';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface NexusTUIProps {
  onExit?: () => void;
  enableBackground?: boolean;
  useKittyProtocol?: boolean;
  useSixel?: boolean;
  particleCount?: number;
  fps?: number;
}

type AppState = 'boot' | 'running' | 'exiting';

export const NexusTUIWithBackground: React.FC<NexusTUIProps> = ({
  onExit,
  enableBackground = true,
  useKittyProtocol = false,
  useSixel = false,
  particleCount = 200,
  fps = 30,
}) => {
  const { exit } = useApp();
  const [appState, setAppState] = useState<AppState>('boot');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const [showBackground, setShowBackground] = useState(false);

  // Handle boot completion
  const handleBootComplete = () => {
    setAppState('running');
    setShowBackground(enableBackground);
    
    setMessages([
      {
        role: 'system',
        content: '🔥 NEXUS ONLINE - Type your message and press Enter. Ctrl+C to exit.',
        timestamp: new Date(),
      },
    ]);
  };

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Handle keyboard input
  useInput((inputChar, key) => {
    if (appState !== 'running') return;

    if (key.return) {
      if (input.trim()) {
        // Add user message
        const userMessage: Message = {
          role: 'user',
          content: input.trim(),
          timestamp: new Date(),
        };
        
        setMessages((prev) => [...prev, userMessage]);

        // Simulate assistant response (replace with actual API call)
        setTimeout(() => {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `Echo: ${input.trim()}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }, 100);

        setInput('');
      }
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (key.ctrl && inputChar === 'c') {
      setAppState('exiting');
      if (onExit) {
        onExit();
      } else {
        exit();
      }
    } else if (key.ctrl && inputChar === 'b') {
      // Toggle background
      setShowBackground((prev) => !prev);
    } else if (key.ctrl && inputChar === 'l') {
      // Clear messages
      setMessages([
        {
          role: 'system',
          content: '🔥 NEXUS ONLINE - Screen cleared.',
          timestamp: new Date(),
        },
      ]);
    } else if (inputChar && !key.ctrl && !key.meta) {
      setInput((prev) => prev + inputChar);
    }
  });

  if (appState === 'boot') {
    return <BootSequence onComplete={handleBootComplete} />;
  }

  if (appState === 'exiting') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="orange" bold>
          ⚡ NEXUS SHUTTING DOWN...
        </Text>
        <Text color="green">Later gator! 🔥</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Background layer */}
      {showBackground && (
        <TerminalParticleBackground
          particleCount={particleCount}
          connectionDistance={25}
          useKittyProtocol={useKittyProtocol}
          useSixel={useSixel}
          fps={fps}
        />
      )}

      {/* Content layer */}
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        {/* Header */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color="orange" bold>
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          </Text>
          <Text color="green" bold>
            NEXUS CODE | SAAAM LLC
          </Text>
          <Text color="orange" bold>
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          </Text>
        </Box>

        {/* Messages */}
        <Box flexDirection="column" marginBottom={1}>
          {messages.slice(-10).map((msg, index) => (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Text color={msg.role === 'user' ? 'cyan' : msg.role === 'assistant' ? 'green' : 'orange'}>
                {msg.role === 'user' ? '👤 YOU' : msg.role === 'assistant' ? '🤖 NEXUS' : '⚡ SYSTEM'}:{' '}
                {msg.content}
              </Text>
            </Box>
          ))}
        </Box>

        {/* Input */}
        <Box>
          <Text color="white" bold>
            {'> '}
          </Text>
          <Text color="green">{input}</Text>
          <Text color="green">{cursorVisible ? '█' : ' '}</Text>
        </Box>

        {/* Footer */}
        <Box marginTop={1}>
          <Text color="orange" dimColor>
            Ctrl+C: Exit | Ctrl+B: Toggle BG | Ctrl+L: Clear | Background: {showBackground ? 'ON' : 'OFF'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

export default NexusTUIWithBackground;
