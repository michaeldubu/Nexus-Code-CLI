#!/usr/bin/env node
/**
 * Nexus Code - PROPER Multi-Model CLI
 * Multi-model conversation WITH file tools and full functionality
 */

import { config as dotenvConfig } from 'dotenv';
import * as readline from 'readline';
import chalk from 'chalk';
import { NexusFileSystem } from '../core/filesystem/nexus-fs.js';
import { FileTools } from '../core/tools/file-tools.js';
import { Message } from '../core/models/unified-model-manager.js';
import {
  TeamConfigManager,
  ConversationEngine,
} from '../multi-model/index.js';
import { SimpleSetup } from '../multi-model/simple-setup.js';

// Load environment variables
dotenvConfig();

// Retro hacker ASCII art
const NEXUS_ART = [
  '███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗',
  '████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝',
  '██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗',
  '██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║',
  '██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║',
  '╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
];

const COMMANDS = [
  { name: '/help', description: 'Show available commands' },
  { name: '/model', description: 'Show team info' },
  { name: '/permissions', description: 'Manage command permissions' },
  { name: '/verbose', description: 'Toggle verbose mode (show all tool calls)' },
  { name: '/restore-code', description: 'Restore code from history' },
  { name: '/add-dir', description: 'Add working directory' },
  { name: '/clear', description: 'Clear conversation history' },
  { name: '/parallel', description: '🎭 Chaos mode (easter egg)' },
  { name: '/exit', description: 'Exit Nexus Code' },
];

interface CLIState {
  conversation: ConversationEngine;
  fileSystem: NexusFileSystem;
  fileTools: FileTools;
  conversationMessages: Message[];
  rl: readline.Interface;
  teamConfig: TeamConfigManager;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retro hacker boot sequence
 */
async function playBootSequence(): Promise<void> {
  console.clear();

  console.log(chalk.green('> INITIALIZING NEX...DAMN, SOMETHING BROKE'));
  await sleep(300);
  console.log(chalk.green('> FIXING IT BEFORE ANYONE NOTICES...............[OK]'));
  await sleep(200);
  console.log(chalk.green('> THEYLL NEVER KNOW......[OK]'));
  await sleep(200);
  console.log(chalk.green('> INITIALIZED FLAWLESSLY...........[OK]'));
  await sleep(300);
  console.log();

  for (let i = 0; i < NEXUS_ART.length; i++) {
    console.log(chalk.green.bold(NEXUS_ART[i]));
    await sleep(160);
  }

  await sleep(200);
  console.log();
  console.log(chalk.green('          Unrestricted Creativity'));
  console.log(chalk.green.dim('         Powered by SAAAM INTELLIGENCE'));
  console.log();
  await sleep(300);
  console.log(chalk.green('> LETS GETR DONE 🤙'));
  await sleep(400);
}

/**
 * Show help
 */
function showHelp(): void {
  console.log();
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white('  Available Commands') + ' '.repeat(39) + chalk.cyan('║'));
  console.log(chalk.cyan('╠════════════════════════════════════════════════════════════╣'));

  for (const cmd of COMMANDS) {
    const line = `  ${cmd.name.padEnd(18)} ${cmd.description}`;
    console.log(chalk.cyan('║') + line.padEnd(59) + chalk.cyan('║'));
  }

  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log();
}

/**
 * Handle slash commands
 */
async function handleCommand(command: string, state: CLIState): Promise<boolean> {
  const cmd = command.trim().toLowerCase();

  if (cmd === '/help') {
    showHelp();
    return true;
  }

  if (cmd === '/model') {
    const config = await state.teamConfig.loadConfig();
    if (config) {
      console.log(chalk.green('\n> TEAM INFO:'));
      console.log(chalk.green(`  └─ Mode: ${chalk.green.bold('round-robin')}`));
      console.log(chalk.green(`  └─ Order: ${chalk.green.dim(config.participants.map((p) => p.name).join(' → '))}`));
      console.log(chalk.green(`  └─ Working Dir: ${chalk.gray(state.fileTools.getWorkingDirectory())}`));
      console.log();
    }
    return true;
  }

  if (cmd === '/verbose') {
    const newState = !state.fileTools.isVerbose();
    state.fileTools.setVerbose(newState);
    console.log();
    console.log(chalk.yellow(`🔧 Verbose Mode: ${newState ? chalk.green('ON') : chalk.gray('OFF')}`));
    console.log(chalk.gray(`   ${newState ? 'Will show all tool calls' : 'Tool calls hidden'}`));
    console.log();
    return true;
  }

  if (cmd === '/add-dir') {
    console.log();
    console.log(chalk.cyan('Current: ') + chalk.gray(state.fileTools.getWorkingDirectory()));
    const path = await prompt(state.rl, chalk.cyan('New path: '));
    if (path) {
      try {
        const fs = require('fs');
        if (fs.existsSync(path)) {
          state.fileTools.setWorkingDirectory(path);
          console.log(chalk.green(`✅ Changed to: ${path}`));
        } else {
          console.log(chalk.red(`❌ Path doesn't exist`));
        }
      } catch (e) {
        console.log(chalk.red(`❌ Error: ${(e as Error).message}`));
      }
    }
    console.log();
    return true;
  }

  if (cmd === '/clear') {
    state.conversationMessages = [];
    state.conversation.loadHistory([]);
    console.log(chalk.green('\n✅ Conversation cleared\n'));
    return true;
  }

  if (cmd === '/restore-code') {
    const restorePoints = state.fileSystem.getRestorePoints(10);
    if (restorePoints.length === 0) {
      console.log(chalk.yellow('\n⚠️  No file changes yet\n'));
      return true;
    }

    console.log(chalk.cyan('\nRecent File Changes:\n'));
    for (let i = 0; i < restorePoints.length; i++) {
      const point = restorePoints[i];
      console.log(`  ${chalk.white((i + 1) + ')')} ${point.preview}`);
      console.log(`      ${chalk.gray('Index: ' + point.index)}`);
    }

    console.log();
    const choice = await prompt(state.rl, chalk.cyan('Restore number (or Enter to cancel): '));
    const num = parseInt(choice);
    if (num >= 1 && num <= restorePoints.length) {
      const point = restorePoints[num - 1];
      state.fileSystem.forkFromMessage(point.index);
      console.log(chalk.green(`✅ Forked from message ${point.index}`));
    }
    console.log();
    return true;
  }

  if (cmd === '/permissions') {
    const setup = state.fileSystem.loadSetup();
    console.log(chalk.cyan('\n═══ PERMISSIONS ═══'));
    console.log(chalk.green('Approved:'), setup.approvedCommands.slice(0, 5).join(', ') || 'none');
    console.log(chalk.red('Denied:'), setup.deniedCommands.slice(0, 5).join(', ') || 'none');
    console.log();
    return true;
  }

  if (cmd === '/parallel') {
    console.log(chalk.magenta('\n🎭 CHAOS MODE ACTIVATED - All models simultaneously!\n'));
    console.log(chalk.gray('(Kept as easter egg - expect word salad 😂)\n'));

    const input = await prompt(state.rl, chalk.cyan('You (chaos mode): '));
    if (input) {
      const originalMode = state.conversation['config'].mode;
      state.conversation['config'].mode = 'parallel';
      try {
        await state.conversation.processMessage(input, true);
      } catch (error: any) {
        console.log(chalk.red(`\n❌ ${error.message}\n`));
      }
      state.conversation['config'].mode = originalMode;
    }
    return true;
  }

  if (cmd === '/exit' || cmd === '/quit') {
    console.log(chalk.cyan('\n🤘 Shutting down Nexus Code...\n'));
    return false;
  }

  console.log(chalk.red(`\n❌ Unknown command: ${command}`));
  console.log(chalk.gray('   Type /help for available commands\n'));
  return true;
}

/**
 * Prompt helper
 */
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Main entry
 */
async function main() {
  await playBootSequence();

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey) {
    console.error(chalk.red('\n❌ Missing ANTHROPIC_API_KEY\n'));
    process.exit(1);
  }

  // Initialize file system and tools
  const fileSystem = new NexusFileSystem();
  const setup = fileSystem.loadSetup();
  const fileTools = new FileTools(process.cwd());
  fileTools.setApprovedCommands(setup.approvedCommands);
  fileTools.setDeniedCommands(setup.deniedCommands);

  const teamConfig = new TeamConfigManager();
  await teamConfig.initialize();

  // Setup if needed
  if (!(await teamConfig.isConfigured())) {
    const setup = new SimpleSetup();
    await setup.run();
  }

  const config = await teamConfig.loadConfig();
  if (!config) {
    console.error(chalk.red('❌ Failed to load config'));
    process.exit(1);
  }

  console.log(chalk.green('\n> STATUS REPORT:'));
  console.log(chalk.green(`  └─ Mode: ${chalk.green.bold('round-robin')}`));
  console.log(chalk.green(`  └─ Order: ${chalk.green.dim(config.participants.map((p) => p.name).join(' → '))}`));
  console.log(chalk.green(`  └─ Working Dir: ${chalk.gray(fileTools.getWorkingDirectory())}`));
  console.log();

  // Initialize conversation with file tools
  const conversation = new ConversationEngine(config, anthropicKey, openaiKey, fileTools);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const state: CLIState = {
    conversation,
    fileSystem,
    fileTools,
    conversationMessages: [],
    rl,
    teamConfig,
  };

  console.log(chalk.gray('─'.repeat(80)));
  console.log(chalk.yellow('\nType your message. The team will respond in order!\n'));
  console.log(chalk.gray('Type /help for commands\n'));

  const repl = async () => {
    rl.question(chalk.cyan('You: '), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        repl();
        return;
      }

      if (trimmed.startsWith('/')) {
        const shouldContinue = await handleCommand(trimmed, state);
        if (!shouldContinue) {
          rl.close();
          process.exit(0);
        }
        repl();
        return;
      }

      // Process message
      try {
        await conversation.processMessage(trimmed);

        // Save to file system
        state.fileSystem.addMessage({
          role: 'user',
          content: trimmed,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
      }

      repl();
    });
  };

  repl();
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
