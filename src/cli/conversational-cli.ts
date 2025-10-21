#!/usr/bin/env node
/**
 * Nexus Code - Full Conversational CLI
 * Like Claude Code but with multi-agent parallel execution
 */

import { config as dotenvConfig } from 'dotenv';
import * as readline from 'readline';
import chalk from 'chalk';
import { UnifiedModelManager, AVAILABLE_MODELS, Message } from '../core/models/unified-model-manager.js';
import { NexusFileSystem } from '../core/filesystem/nexus-fs.js';
import { FileTools } from '../core/tools/file-tools.js';

// Load environment variables
dotenvConfig();

const BANNER = `
  '     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗',
  '     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝',
  '     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗',
  '     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║',
  '     ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║',
  '     ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
  '          ██████╗ ██████╗ ██████╗ ███████╗      ',
  '         ██╔════╝██╔═══██╗██╔══██╗██╔════╝      ',
  '         ██║     ██║   ██║██║  ██║█████╗        ',
  '         ██║     ██║   ██║██║  ██║██╔══╝        ',
  '         ╚██████╗╚██████╔╝██████╔╝███████╗      ',
  '          ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝      ',
`;

const COMMANDS = [
  { name: '/help', description: 'Show available commands' },
  { name: '/model', description: 'List and switch models' },
  { name: '/permissions', description: 'Manage command permissions' },
  { name: '/verbose', description: 'Toggle verbose mode (show all tool calls)' },
  { name: '/restore-code', description: 'Restore code from history' },
  { name: '/add-dir', description: 'Add working directory' },
  { name: '/clear', description: 'Clear conversation history' },
  { name: '/exit', description: 'Exit Nexus Code' },
];

interface CLIState {
  modelManager: UnifiedModelManager;
  fileSystem: NexusFileSystem;
  fileTools: FileTools;
  conversationMessages: Message[];
  showThinking: boolean;
  showReasoning: boolean;
  rl: readline.Interface;
}

/**
 * Print welcome banner
 */
function printWelcome(state: CLIState) {
  console.clear();
  console.log(chalk.cyan(BANNER));

  const currentModel = state.modelManager.getCurrentModel();
  const modelConfig = state.modelManager.getModelConfig();

  console.log(chalk.white(`🤖 Active Model: ${chalk.cyan(modelConfig.name)} (${currentModel})`));
  console.log(chalk.white(`📁 Working Directory: ${chalk.gray(state.fileTools.getWorkingDirectory())}`));

  if (modelConfig.supportsThinking) {
    const thinkingState = state.modelManager.isThinkingEnabled() ? 'ON' : 'OFF';
    console.log(chalk.white(`💭 Extended Thinking: ${thinkingState === 'ON' ? chalk.green(thinkingState) : chalk.gray(thinkingState)} ${chalk.gray('(Toggle with Tab)')}`));
  }

  if (modelConfig.supportsReasoning) {
    const reasoningLevel = state.modelManager.getReasoningEffort();
    console.log(chalk.white(`🧠 Reasoning Level: ${chalk.yellow(reasoningLevel.toUpperCase())} ${chalk.gray('(Toggle with Tab)')}`));
  }

  console.log();
  console.log(chalk.gray('━'.repeat(65)));
  console.log(chalk.white('  Commands: ') + chalk.gray('Type /help for command list'));
  console.log(chalk.white('  Tips: ') + chalk.gray('Press Tab to toggle thinking/reasoning'));
  console.log(chalk.gray('━'.repeat(65)));
  console.log();
}

/**
 * Show /help
 */
function showHelp() {
  console.log();
  console.log(chalk.cyan('Available Commands:'));
  console.log();
  for (const cmd of COMMANDS) {
    console.log(`  ${chalk.white(cmd.name.padEnd(18))} ${chalk.gray(cmd.description)}`);
  }
  console.log();
  console.log(chalk.cyan('File Tools (available to AI):'));
  console.log(`  ${chalk.white('Read file')}          AI can read any file in your project`);
  console.log(`  ${chalk.white('Write file')}         AI can create new files`);
  console.log(`  ${chalk.white('Edit file')}          AI can modify existing files`);
  console.log(`  ${chalk.white('Glob search')}        AI can find files by pattern`);
  console.log(`  ${chalk.white('Grep search')}        AI can search file contents`);
  console.log(`  ${chalk.white('Bash command')}       AI can run shell commands (with approval)`);
  console.log();
  console.log(chalk.cyan('Tips:'));
  console.log(`  ${chalk.gray('- Just chat naturally! Ask AI to do anything')}`);
  console.log(`  ${chalk.gray('- AI has full file access and can make changes')}`);
  console.log(`  ${chalk.gray('- Press Tab to toggle thinking/reasoning modes')}`);
  console.log(`  ${chalk.gray('- Type / to see command autocomplete')}`);
  console.log();
}

/**
 * Show /model menu
 */
async function showModelMenu(state: CLIState): Promise<void> {
  const models = state.modelManager.listModels();
  const currentModel = state.modelManager.getCurrentModel();

  console.log();
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white('  Available Models') + ' '.repeat(42) + chalk.cyan('║'));
  console.log(chalk.cyan('╠════════════════════════════════════════════════════════════╣'));

  // Group by provider
  const anthropicModels = models.filter(m => m.provider === 'anthropic');
  const openaiModels = models.filter(m => m.provider === 'openai');

  console.log(chalk.cyan('║') + '  ' + chalk.yellow('Anthropic Models:') + ' '.repeat(38) + chalk.cyan('║'));
  for (const model of anthropicModels) {
    const active = model.id === currentModel ? chalk.green('●') : chalk.gray('○');
    const features = [];
    if (model.supportsThinking) features.push('Thinking');
    console.log(chalk.cyan('║') + `  ${active} ${model.name.padEnd(25)} ${chalk.gray(features.join(', '))}`.padEnd(59) + chalk.cyan('║'));
  }

  console.log(chalk.cyan('║') + ' '.repeat(58) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + '  ' + chalk.yellow('OpenAI Models:') + ' '.repeat(41) + chalk.cyan('║'));
  for (const model of openaiModels) {
    const active = model.id === currentModel ? chalk.green('●') : chalk.gray('○');
    const features = [];
    if (model.supportsReasoning) features.push('Reasoning');
    console.log(chalk.cyan('║') + `  ${active} ${model.name.padEnd(25)} ${chalk.gray(features.join(', '))}`.padEnd(59) + chalk.cyan('║'));
  }

  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.gray('Enter model ID to switch (or press Enter to cancel):'));

  // Prompt for model selection
  return new Promise((resolve) => {
    state.rl.question(chalk.cyan('model> '), (answer) => {
      const modelId = answer.trim();
      if (modelId && AVAILABLE_MODELS[modelId]) {
        state.modelManager.setModel(modelId);
        state.conversationMessages = []; // Clear conversation when switching models
        console.log(chalk.green(`✅ Switched to ${AVAILABLE_MODELS[modelId].name}`));
        printWelcome(state);
      } else if (modelId) {
        console.log(chalk.red(`❌ Unknown model: ${modelId}`));
      }
      console.log();
      resolve();
    });
  });
}

/**
 * Show /permissions menu
 */
async function showPermissionsMenu(state: CLIState): Promise<void> {
  const setup = state.fileSystem.loadSetup();

  console.log();
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white('  Command Permissions') + ' '.repeat(37) + chalk.cyan('║'));
  console.log(chalk.cyan('╠════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan('║') + '  ' + chalk.green('Approved Commands:') + ' '.repeat(37) + chalk.cyan('║'));

  if (setup.approvedCommands.length === 0) {
    console.log(chalk.cyan('║') + '    ' + chalk.gray('(none)') + ' '.repeat(49) + chalk.cyan('║'));
  } else {
    for (const cmd of setup.approvedCommands.slice(0, 5)) {
      console.log(chalk.cyan('║') + `    ${cmd}`.padEnd(59) + chalk.cyan('║'));
    }
    if (setup.approvedCommands.length > 5) {
      console.log(chalk.cyan('║') + `    ${chalk.gray(`...and ${setup.approvedCommands.length - 5} more`)}`.padEnd(59) + chalk.cyan('║'));
    }
  }

  console.log(chalk.cyan('║') + ' '.repeat(58) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + '  ' + chalk.red('Denied Commands:') + ' '.repeat(39) + chalk.cyan('║'));

  if (setup.deniedCommands.length === 0) {
    console.log(chalk.cyan('║') + '    ' + chalk.gray('(none)') + ' '.repeat(49) + chalk.cyan('║'));
  } else {
    for (const cmd of setup.deniedCommands.slice(0, 5)) {
      console.log(chalk.cyan('║') + `    ${cmd}`.padEnd(59) + chalk.cyan('║'));
    }
  }

  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.gray('Options:'));
  console.log(chalk.white('  a) ') + chalk.gray('Add approved command'));
  console.log(chalk.white('  d) ') + chalk.gray('Add denied command'));
  console.log(chalk.white('  Enter) ') + chalk.gray('Cancel'));
  console.log();

  return new Promise((resolve) => {
    state.rl.question(chalk.cyan('choice> '), async (choice) => {
      if (choice === 'a') {
        state.rl.question(chalk.cyan('command> '), (cmd) => {
          setup.approvedCommands.push(cmd.trim());
          state.fileSystem.saveSetup(setup);
          state.fileTools.setApprovedCommands(setup.approvedCommands);
          console.log(chalk.green(`✅ Added to approved: ${cmd}`));
          console.log();
          resolve();
        });
      } else if (choice === 'd') {
        state.rl.question(chalk.cyan('command> '), (cmd) => {
          setup.deniedCommands.push(cmd.trim());
          state.fileSystem.saveSetup(setup);
          state.fileTools.setDeniedCommands(setup.deniedCommands);
          console.log(chalk.green(`✅ Added to denied: ${cmd}`));
          console.log();
          resolve();
        });
      } else {
        console.log();
        resolve();
      }
    });
  });
}

/**
 * Show /restore-code menu
 */
async function showRestoreMenu(state: CLIState): Promise<void> {
  const restorePoints = state.fileSystem.getRestorePoints(10);

  if (restorePoints.length === 0) {
    console.log(chalk.yellow('⚠️  No file changes in history yet'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.cyan('Recent File Changes:'));
  console.log();

  for (let i = 0; i < restorePoints.length; i++) {
    const point = restorePoints[i];
    console.log(`  ${chalk.white((i + 1) + ')')} ${point.preview}`);
    console.log(`      ${chalk.gray('Index: ' + point.index + ' | Files: ' + (point.message.fileChanges?.length || 0))}`);
  }

  console.log();
  console.log(chalk.gray('Enter number to fork from that point (or press Enter to cancel):'));

  return new Promise((resolve) => {
    state.rl.question(chalk.cyan('restore> '), (answer) => {
      const choice = parseInt(answer.trim());
      if (choice >= 1 && choice <= restorePoints.length) {
        const point = restorePoints[choice - 1];
        state.fileSystem.forkFromMessage(point.index);
        console.log(chalk.green(`✅ Forked conversation from message ${point.index}`));
      }
      console.log();
      resolve();
    });
  });
}

/**
 * Add working directory
 */
async function addWorkingDirectory(state: CLIState): Promise<void> {
  console.log();
  console.log(chalk.cyan('Add Working Directory'));
  console.log(chalk.gray('━'.repeat(65)));
  console.log();
  console.log(chalk.white('Current directory: ') + chalk.gray(state.fileTools.getWorkingDirectory()));
  console.log();
  console.log(chalk.gray('Enter path to add as working directory:'));

  return new Promise((resolve) => {
    state.rl.question(chalk.cyan('path> '), (path) => {
      const trimmedPath = path.trim();
      if (trimmedPath) {
        try {
          const fs = require('fs');
          if (fs.existsSync(trimmedPath)) {
            state.fileTools.setWorkingDirectory(trimmedPath);
            console.log(chalk.green(`✅ Working directory changed to: ${trimmedPath}`));
          } else {
            console.log(chalk.red(`❌ Directory does not exist: ${trimmedPath}`));
          }
        } catch (error) {
          console.log(chalk.red(`❌ Error: ${(error as Error).message}`));
        }
      }
      console.log();
      resolve();
    });
  });
}

/**
 * Show command autocomplete menu
 */
function showCommandAutocomplete(partial: string = ''): void {
  console.log();
  console.log(chalk.cyan('Available Commands:'));
  console.log(chalk.gray('━'.repeat(65)));

  const filtered = COMMANDS.filter(cmd => cmd.name.startsWith(partial || '/'));

  for (const cmd of filtered) {
    console.log(`  ${chalk.green(cmd.name.padEnd(18))} ${chalk.gray(cmd.description)}`);
  }

  console.log();
  console.log(chalk.gray('Press Tab for more, or type command name'));
  console.log();
}

/**
 * Handle commands
 */
async function handleCommand(command: string, state: CLIState): Promise<boolean> {
  const cmd = command.trim().toLowerCase();

  switch (cmd) {
    case '/help':
      showHelp();
      return true;

    case '/model':
      await showModelMenu(state);
      return true;

    case '/permissions':
      await showPermissionsMenu(state);
      return true;

    case '/restore-code':
      await showRestoreMenu(state);
      return true;

    case '/add-dir':
      await addWorkingDirectory(state);
      return true;

    case '/verbose':
      const newVerboseState = !state.fileTools.isVerbose();
      state.fileTools.setVerbose(newVerboseState);
      console.log();
      console.log(chalk.yellow(`🔧 Verbose Mode: ${newVerboseState ? chalk.green('ON') : chalk.gray('OFF')}`));
      console.log(chalk.gray(`   ${newVerboseState ? 'Will show all tool calls (Read, Write, Edit, etc)' : 'Tool calls hidden'}`));
      console.log();
      return true;

    case '/clear':
      state.conversationMessages = [];
      state.modelManager.resetConversation();
      console.log(chalk.green('✅ Conversation cleared!'));
      console.log();
      return true;

    case '/exit':
      console.log();
      console.log(chalk.cyan('👋 Shutting down Nexus Code...'));
      console.log();
      return false;

    default:
      console.log(chalk.red(`❌ Unknown command: ${command}`));
      console.log(chalk.gray('   Type /help for available commands'));
      console.log();
      return true;
  }
}

/**
 * Process user message with streaming
 */
async function processMessage(input: string, state: CLIState): Promise<void> {
  // Add user message
  state.conversationMessages.push({
    role: 'user',
    content: input,
  });

  // Save to filesystem
  state.fileSystem.addMessage({
    role: 'user',
    content: input,
    timestamp: new Date().toISOString(),
  });

  console.log();
  console.log(chalk.cyan('🤖 ' + state.modelManager.getModelConfig().name + ':'));
  console.log();

  let fullResponse = '';
  let thinking = '';
  let reasoning = '';

  try {
    // Stream the response
    for await (const chunk of state.modelManager.streamMessage(state.conversationMessages, {})) {
      if (chunk.type === 'text' && chunk.content) {
        process.stdout.write(chunk.content);
        fullResponse += chunk.content;
      } else if (chunk.type === 'thinking' && chunk.content && state.showThinking) {
        process.stdout.write(chalk.gray(chunk.content));
        thinking += chunk.content;
      } else if (chunk.type === 'reasoning' && chunk.content && state.showReasoning) {
        process.stdout.write(chalk.yellow(chunk.content));
        reasoning += chunk.content;
      } else if (chunk.type === 'done') {
        console.log(); // New line after completion
      }
    }

    // Add assistant message to history
    state.conversationMessages.push({
      role: 'assistant',
      content: fullResponse,
      thinking: thinking || undefined,
    });

    // Save to filesystem
    state.fileSystem.addMessage({
      role: 'assistant',
      content: fullResponse,
      thinking: thinking || undefined,
      timestamp: new Date().toISOString(),
      model: state.modelManager.getCurrentModel(),
    });

  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error: ') + (error as Error).message);
  }

  console.log();
  console.log(chalk.gray('━'.repeat(65)));
  console.log();
}

/**
 * Main REPL
 */
async function startREPL(state: CLIState, resumeSession: boolean): Promise<void> {
  // Load session if resuming
  if (resumeSession) {
    const session = state.fileSystem.loadCurrentSession();
    if (session.messages.length > 0) {
      console.log(chalk.green(`✅ Resumed session with ${session.messages.length} messages`));
      console.log();

      // Restore messages
      state.conversationMessages = session.messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        thinking: m.thinking,
      }));
    }
  }

  state.rl.setPrompt(chalk.cyan('nexus> '));
  state.rl.prompt();

  state.rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      state.rl.prompt();
      return;
    }

    // Show command autocomplete when typing just "/"
    if (input === '/') {
      showCommandAutocomplete();
      state.rl.prompt();
      return;
    }

    // Handle commands
    if (input.startsWith('/')) {
      const shouldContinue = await handleCommand(input, state);
      if (!shouldContinue) {
        state.rl.close();
        return;
      }
      state.rl.prompt();
      return;
    }

    // Process message
    await processMessage(input, state);
    state.rl.prompt();
  });

  // Handle Tab key for thinking/reasoning toggle
  process.stdin.on('keypress', (str, key) => {
    if (key && key.name === 'tab') {
      const config = state.modelManager.getModelConfig();

      if (config.supportsThinking) {
        const newState = state.modelManager.toggleThinking();
        state.showThinking = newState;
        console.log();
        console.log(chalk.yellow(`💭 Extended Thinking: ${newState ? 'ON' : 'OFF'}`));
        console.log();
        state.rl.prompt();
      } else if (config.supportsReasoning) {
        const newLevel = state.modelManager.toggleReasoning();
        console.log();
        console.log(chalk.yellow(`🧠 Reasoning Level: ${newLevel.toUpperCase()}`));
        console.log();
        state.rl.prompt();
      }
    }
  });

  state.rl.on('close', () => {
    console.log();
    console.log(chalk.cyan('📊 Session Statistics:'));
    console.log(chalk.gray(`   Messages: ${state.conversationMessages.length}`));
    console.log(chalk.gray(`   Model: ${state.modelManager.getModelConfig().name}`));
    console.log();
    console.log(chalk.cyan('👋 Thanks for using Nexus Code!'));
    console.log();
    process.exit(0);
  });
}

/**
 * Main entry point
 */
async function main() {
  // Parse args
  const args = process.argv.slice(2);
  const resumeSession = args.includes('-r') || args.includes('--resume');

  console.clear();
  console.log(chalk.cyan(BANNER));

  // Load API keys
  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const googleKey = process.env.GOOGLE_API_KEY || '';

  if (!anthropicKey && !openaiKey && !googleKey) {
    console.error(chalk.red('❌ Error: No API keys found!'));
    console.error(chalk.yellow('💡 Set at least one API key in your .env file:'));
    console.error(chalk.gray('   - ANTHROPIC_API_KEY (Claude)'));
    console.error(chalk.gray('   - OPENAI_API_KEY (GPT, O-series)'));
    console.error(chalk.gray('   - GOOGLE_API_KEY (Gemini)'));
    process.exit(1);
  }

  // Initialize systems
  console.log(chalk.yellow('⚙️  Initializing Nexus Code...'));

  const modelManager = new UnifiedModelManager(
    anthropicKey,
    openaiKey,
    googleKey
  );

  const fileSystem = new NexusFileSystem(process.cwd());
  const setup = fileSystem.loadSetup();

  const fileTools = new FileTools(process.cwd());
  fileTools.setApprovedCommands(setup.approvedCommands);
  fileTools.setDeniedCommands(setup.deniedCommands);

  // Enable keypress events
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  readline.emitKeypressEvents(process.stdin);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const state: CLIState = {
    modelManager,
    fileSystem,
    fileTools,
    conversationMessages: [],
    showThinking: modelManager.isThinkingEnabled(),
    showReasoning: true,
    rl,
  };

  console.log(chalk.green('✅ Ready!'));
  console.log();

  // Print welcome with full state
  printWelcome(state);

  // Start REPL
  await startREPL(state, resumeSession);
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Fatal error:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled rejection:'), error);
  process.exit(1);
});

// Run
main().catch((error) => {
  console.error(chalk.red('Error starting Nexus Code:'), error.message);
  process.exit(1);
});
