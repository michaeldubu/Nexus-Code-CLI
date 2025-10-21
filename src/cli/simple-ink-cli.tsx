#!/usr/bin/env node
/**
 * Simple Ink TUI - Actually fucking works
 * Uses all the components you already have
 */
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { config as dotenvConfig } from 'dotenv';
import chalk from 'chalk';
import { UnifiedModelManager, Message } from '../core/models/unified-model-manager.js';
import { NexusFileSystem } from '../core/filesystem/nexus-fs.js';
import { FileTools } from '../core/tools/file-tools.js';
import { BootSequence } from './components/BootSequence.js';
import { StatusBar } from './components/StatusBar.js';
import { MessageRenderer } from './components/MessageRenderer.js';
import { CommandAutocomplete, Command } from './components/CommandAutocomplete.js';
import { ModelSelector } from './components/ModelSelector.js';
import { PermissionsDialog } from './components/PermissionsDialog.js';

// Load environment
dotenvConfig();

const COMMANDS: Command[] = [
  { name: '/help', description: 'Show available commands' },
  { name: '/model', description: 'Select AI models' },
  { name: '/permissions', description: 'Manage command permissions' },
  { name: '/verbose', description: 'Toggle verbose mode' },
  { name: '/clear', description: 'Clear conversation history' },
  { name: '/exit', description: 'Exit Nexus Code' },
];

type DialogType = 'boot' | 'commands' | 'models' | 'permissions' | null;

interface Props {
  modelManager: UnifiedModelManager;
  fileSystem: NexusFileSystem;
  fileTools: FileTools;
}

const SimpleTUI: React.FC<Props> = ({ modelManager, fileSystem, fileTools }) => {
  const { exit } = useApp();

  // State
  const [showBoot, setShowBoot] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle boot complete
  useEffect(() => {
    if (showBoot) {
      const timer = setTimeout(() => setShowBoot(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showBoot]);

  // Keyboard input
  useInput((input, key) => {
    if (showBoot || isProcessing) return;

    // Exit dialog with Esc
    if (key.escape && activeDialog) {
      setActiveDialog(null);
      return;
    }

    // Handle commands dialog
    if (activeDialog === 'commands') {
      if (key.return) {
        setActiveDialog(null);
      }
      return;
    }

    // Handle model selector
    if (activeDialog === 'models') {
      if (key.return) {
        setActiveDialog(null);
      }
      return;
    }

    // Handle permissions dialog
    if (activeDialog === 'permissions') {
      if (key.return) {
        setActiveDialog(null);
      }
      return;
    }

    // Regular input
    if (key.return && inputValue.trim()) {
      handleSubmit(inputValue.trim());
      setInputValue('');
      return;
    }

    if (key.backspace || key.delete) {
      setInputValue(inputValue.slice(0, -1));
      return;
    }

    // Show command autocomplete
    if (input === '/' && !inputValue) {
      setActiveDialog('commands');
      return;
    }

    // Regular character
    if (input && !key.ctrl && !key.meta) {
      setInputValue(inputValue + input);
    }
  });

  // Handle message submission
  const handleSubmit = async (input: string) => {
    // Handle commands
    if (input.startsWith('/')) {
      await handleCommand(input);
      return;
    }

    // Process message
    setIsProcessing(true);
    setMessages([...messages, { role: 'user', content: input }]);

    try {
      let response = '';
      const newMessages = [...messages, { role: 'user', content: input }];

      for await (const chunk of modelManager.streamMessage(newMessages, {
        max_tokens: 4096,
      })) {
        if (chunk.type === 'text' && chunk.content) {
          response += chunk.content;
        }
      }

      setMessages([...newMessages, { role: 'assistant', content: response }]);

      // Save to filesystem
      fileSystem.addMessage({
        role: 'user',
        content: input,
        timestamp: new Date().toISOString(),
      });
      fileSystem.addMessage({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        model: modelManager.getCurrentModel(),
      });
    } catch (error: any) {
      setMessages([
        ...messages,
        { role: 'assistant', content: `Error: ${error.message}` },
      ]);
    }

    setIsProcessing(false);
  };

  // Handle slash commands
  const handleCommand = async (cmd: string) => {
    const command = cmd.toLowerCase();

    if (command === '/help') {
      setMessages([
        ...messages,
        {
          role: 'assistant',
          content: 'Available commands:\n' + COMMANDS.map(c => `${c.name} - ${c.description}`).join('\n'),
        },
      ]);
      return;
    }

    if (command === '/model') {
      setActiveDialog('models');
      return;
    }

    if (command === '/permissions') {
      setActiveDialog('permissions');
      return;
    }

    if (command === '/verbose') {
      const newState = !fileTools.isVerbose();
      fileTools.setVerbose(newState);
      setMessages([
        ...messages,
        {
          role: 'assistant',
          content: `Verbose mode: ${newState ? 'ON' : 'OFF'}`,
        },
      ]);
      return;
    }

    if (command === '/clear') {
      setMessages([]);
      modelManager.resetConversation();
      return;
    }

    if (command === '/exit') {
      exit();
      return;
    }

    setMessages([
      ...messages,
      { role: 'assistant', content: `Unknown command: ${cmd}` },
    ]);
  };

  // Show boot sequence
  if (showBoot) {
    return <BootSequence onComplete={() => setShowBoot(false)} />;
  }

  // Show command autocomplete
  if (activeDialog === 'commands') {
    return (
      <Box flexDirection="column">
        <CommandAutocomplete
          commands={COMMANDS}
          onSelect={(cmd) => {
            setInputValue(cmd.name);
            setActiveDialog(null);
          }}
          onCancel={() => setActiveDialog(null)}
        />
      </Box>
    );
  }

  // Show model selector
  if (activeDialog === 'models') {
    return (
      <Box flexDirection="column">
        <ModelSelector
          modelManager={modelManager}
          onComplete={() => setActiveDialog(null)}
        />
      </Box>
    );
  }

  // Show permissions dialog
  if (activeDialog === 'permissions') {
    return (
      <Box flexDirection="column">
        <PermissionsDialog
          fileTools={fileTools}
          fileSystem={fileSystem}
          onClose={() => setActiveDialog(null)}
        />
      </Box>
    );
  }

  // Main UI
  return (
    <Box flexDirection="column" padding={1}>
      <StatusBar
        models={[modelManager.getModelConfig().name]}
        workingDir={fileTools.getWorkingDirectory()}
        messageCount={messages.length}
        thinkingEnabled={modelManager.isThinkingEnabled()}
      />

      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        <MessageRenderer messages={messages} />
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="cyan" padding={1}>
        <Text color="cyan">
          {isProcessing ? '⏳ Processing...' : '> '}
          {inputValue}
          <Text color="gray">{isProcessing ? '' : '█'}</Text>
        </Text>
        <Text color="gray" dimColor>
          Type message or / for commands • Esc to cancel • Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
};

// Entry point
async function main() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const googleKey = process.env.GOOGLE_API_KEY || '';

  if (!anthropicKey && !openaiKey && !googleKey) {
    console.error(chalk.red('❌ No API keys found!'));
    console.error(chalk.yellow('Set at least one: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY'));
    process.exit(1);
  }

  const modelManager = new UnifiedModelManager(anthropicKey, openaiKey, googleKey);
  const fileSystem = new NexusFileSystem(process.cwd());
  const setup = fileSystem.loadSetup();
  const fileTools = new FileTools(process.cwd());
  fileTools.setApprovedCommands(setup.approvedCommands);
  fileTools.setDeniedCommands(setup.deniedCommands);

  render(
    <SimpleTUI
      modelManager={modelManager}
      fileSystem={fileSystem}
      fileTools={fileTools}
    />
  );
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
