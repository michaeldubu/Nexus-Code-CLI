/**
 * Nexus TUI Integration Example
 * Shows how to wire the Context Intelligence Engine into your existing Nexus system
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { FileTools } from './file-tools.js';
import { MemoryTool } from './memory-tool.js';
import { NexusFileSystem } from './nexus-fs.js';
import { NexusIntelligence } from './nexus-intelligence.js';
import { IntelligentCommandHandler, INTELLIGENT_COMMANDS } from './intelligent-commands.js';

interface Props {
  workingDirectory: string;
}

/**
 * Enhanced Nexus Component with Intelligence
 */
export const IntelligentNexus: React.FC<Props> = ({ workingDirectory }) => {
  const [initialized, setInitialized] = useState(false);
  const [ctx, setCtx] = useState<any>(null);
  const [userInput, setUserInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize intelligence on mount
  useEffect(() => {
    const initIntelligence = async () => {
      console.log('🧠 Initializing Nexus Intelligence...');
      
      // Create core components
      const fileTools = new FileTools(workingDirectory);
      const nexusFs = new NexusFileSystem(workingDirectory);
      const memory = new MemoryTool(workingDirectory);

      // Create intelligence layer
      const intelligence = new NexusIntelligence(
        workingDirectory,
        fileTools,
        memory,
        nexusFs
      );

      // Initialize (scans codebase)
      await intelligence.initialize();

      // Create command handler
      const commandHandler = new IntelligentCommandHandler({
        intelligence,
        fileTools,
        memory,
        nexusFs,
      });

      setCtx({ commandHandler, intelligence, fileTools, memory, nexusFs });
      setInitialized(true);

      // Show initial context
      const summary = intelligence.getProjectSummary();
      setOutput([summary]);
    };

    initIntelligence().catch(err => {
      console.error('Failed to initialize intelligence:', err);
      setOutput([`❌ Failed to initialize: ${err.message}`]);
    });
  }, [workingDirectory]);

  /**
   * Handle user commands with intelligence
   */
  const handleCommand = async (input: string) => {
    if (!ctx || !initialized) {
      setOutput(prev => [...prev, '⚠️  Intelligence not ready yet...']);
      return;
    }

    setLoading(true);
    const { commandHandler, intelligence } = ctx;

    try {
      let result = '';

      // Parse command
      const trimmed = input.trim();
      const [cmd, ...args] = trimmed.split(' ');

      // Handle intelligent commands
      switch (cmd) {
        case '/context':
          result = await commandHandler.handleContext();
          break;

        case '/analyze':
          result = await commandHandler.handleAnalyze(args.join(' '));
          break;

        case '/relevant':
          result = await commandHandler.handleRelevant(args.join(' '));
          break;

        case '/suggest':
          result = await commandHandler.handleSuggest();
          break;

        case '/issues':
          result = await commandHandler.handleIssues();
          break;

        case '/deps':
          result = await commandHandler.handleDeps(args.join(' '));
          break;

        case '/plan':
          result = await commandHandler.handlePlan(args.join(' '));
          break;

        case '/hotspots':
          result = await commandHandler.handleHotspots();
          break;

        case '/complex':
          result = await commandHandler.handleComplex();
          break;

        case '/help':
          result = getHelpText();
          break;

        default:
          // Not a command - auto-load context and process as normal message
          if (!trimmed.startsWith('/')) {
            const autoLoadResult = await commandHandler.autoLoadContext(trimmed);
            setOutput(prev => [...prev, `> ${input}`, autoLoadResult]);

            // Here you would call your AI model with the message
            // The intelligence has already loaded relevant files into context
            result = '✅ Context loaded. [AI would process here with full context]';
          } else {
            result = `Unknown command: ${cmd}\nType /help for available commands`;
          }
      }

      setOutput(prev => [...prev, `> ${input}`, result]);
    } catch (error) {
      setOutput(prev => [...prev, `❌ Error: ${(error as Error).message}`]);
    } finally {
      setLoading(false);
      setUserInput('');
    }
  };

  // Help text
  const getHelpText = () => {
    const lines = [
      '🧠 NEXUS INTELLIGENT COMMANDS',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      'INTELLIGENCE COMMANDS:',
    ];

    for (const [cmd, desc] of Object.entries(INTELLIGENT_COMMANDS)) {
      lines.push(`  ${cmd.padEnd(12)} - ${desc}`);
    }

    lines.push('');
    lines.push('OTHER COMMANDS:');
    lines.push('  /help        - Show this help');
    lines.push('');
    lines.push('💡 TIP: Just ask questions naturally - relevant files will be auto-loaded!');

    return lines.join('\n');
  };

  if (!initialized) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">🧠 Initializing Context Intelligence...</Text>
        <Text color="gray">Scanning workspace and building dependency graph...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Output history */}
      <Box flexDirection="column" marginBottom={1}>
        {output.map((line, i) => (
          <Text key={i} color={line.startsWith('>') ? 'green' : 'white'}>
            {line}
          </Text>
        ))}
      </Box>

      {/* Loading indicator */}
      {loading && (
        <Text color="yellow">Processing...</Text>
      )}

      {/* Input prompt */}
      <Box>
        <Text color="cyan">nexus{'>'} </Text>
        <Text>{userInput}</Text>
      </Box>
    </Box>
  );
};

/**
 * Example: Wiring into existing Nexus message handler
 */
export async function enhanceExistingNexusWithIntelligence(
  workingDirectory: string
): Promise<{
  commandHandler: IntelligentCommandHandler;
  intelligence: NexusIntelligence;
}> {
  // Initialize components
  const fileTools = new FileTools(workingDirectory);
  const nexusFs = new NexusFileSystem(workingDirectory);
  const memory = new MemoryTool(workingDirectory);

  // Create intelligence
  const intelligence = new NexusIntelligence(
    workingDirectory,
    fileTools,
    memory,
    nexusFs
  );

  await intelligence.initialize();

  // Create handler
  const commandHandler = new IntelligentCommandHandler({
    intelligence,
    fileTools,
    memory,
    nexusFs,
  });

  return { commandHandler, intelligence };
}

/**
 * Example: Message handler that uses intelligence
 */
export async function intelligentMessageHandler(
  message: string,
  commandHandler: IntelligentCommandHandler,
  intelligence: NexusIntelligence
): Promise<string> {
  // If it's a command, handle it
  if (message.startsWith('/')) {
    const [cmd, ...args] = message.split(' ');

    switch (cmd) {
      case '/context':
        return await commandHandler.handleContext();
      case '/analyze':
        return await commandHandler.handleAnalyze(args.join(' '));
      case '/relevant':
        return await commandHandler.handleRelevant(args.join(' '));
      case '/suggest':
        return await commandHandler.handleSuggest();
      case '/issues':
        return await commandHandler.handleIssues();
      case '/deps':
        return await commandHandler.handleDeps(args.join(' '));
      case '/plan':
        return await commandHandler.handlePlan(args.join(' '));
      case '/hotspots':
        return await commandHandler.handleHotspots();
      case '/complex':
        return await commandHandler.handleComplex();
      default:
        return `Unknown command: ${cmd}`;
    }
  }

  // Regular message - auto-load context
  console.log('🧠 Auto-loading relevant context...');
  const loadedFiles = await intelligence.autoLoadContext(message);

  if (loadedFiles.length > 0) {
    console.log(`✅ Auto-loaded ${loadedFiles.length} files`);
    // Now the AI model has full context when processing the message
  }

  // Here you would send to your AI model
  // The intelligence has already loaded relevant files
  return '✅ Context loaded - ready for AI processing';
}

/**
 * Example: Integration with Claude API or other AI
 */
export async function processWithIntelligence(
  userMessage: string,
  commandHandler: IntelligentCommandHandler,
  intelligence: NexusIntelligence,
  aiClient: any // Your AI client (Claude, OpenAI, etc.)
): Promise<string> {
  // Step 1: Auto-load relevant context
  const loadedFiles = await intelligence.autoLoadContext(userMessage);

  // Step 2: Get current context
  const currentContext = intelligence.getCurrentContext();

  // Step 3: Build context for AI
  const contextMessages = currentContext.map(file => {
    return {
      role: 'user',
      content: `File: ${file}\n\n[file contents would be here]`
    };
  });

  // Step 4: Send to AI with full context
  const response = await aiClient.sendMessage({
    messages: [
      ...contextMessages,
      {
        role: 'user',
        content: userMessage
      }
    ]
  });

  // Step 5: Track what files were referenced
  intelligence.updateCurrentContext(currentContext);

  return response;
}
