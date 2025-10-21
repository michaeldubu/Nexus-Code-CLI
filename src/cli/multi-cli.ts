#!/usr/bin/env node
/**
 * Nexus Code - Multi-Model CLI
 * Real collaborative AI - the SAAAM way 🔥
 */

import { config as dotenvConfig } from 'dotenv';
import * as readline from 'readline';
import chalk from 'chalk';
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

/**
 * Async sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retro hacker boot sequence - animated ASCII art
 */
async function playBootSequence(): Promise<void> {
  console.clear();

  // Boot messages with green terminal aesthetic
  console.log(chalk.green('> INITIALIZING NEX...DAMN, SOMETHING BROKE'));
  await sleep(300);
  console.log(chalk.green('> FIXING IT BEFORE ANYONE NOTICES...............[OK]'));
  await sleep(200);
  console.log(chalk.green('> THEYLL NEVER KNOW......[OK]'));
  await sleep(200);
  console.log(chalk.green('> INITIALIZED FLAWLESSLY...........[OK]'));
  await sleep(300);
  console.log();

  // Animated ASCII art reveal
  for (let i = 0; i < NEXUS_ART.length; i++) {
    console.log(chalk.green.bold(NEXUS_ART[i]));
    await sleep(60); // Fast hacker-style animation
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
 * Main entry point
 */
async function main() {
  // Play boot sequence first
  await playBootSequence();

  // Get API keys
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey) {
    console.error(chalk.red('\n❌ Missing ANTHROPIC_API_KEY'));
    console.error(chalk.gray('   Set it in .env or environment variables\n'));
    process.exit(1);
  }

  const teamConfig = new TeamConfigManager();
  await teamConfig.initialize();

  // Check if team is configured
  const isConfigured = await teamConfig.isConfigured();

  if (!isConfigured) {
    // Run simple one-screen setup
    const setup = new SimpleSetup();
    await setup.run();
  }

  // Load team configuration
  const config = await teamConfig.loadConfig();

  if (!config) {
    console.error(chalk.red('❌ Failed to load team configuration'));
    process.exit(1);
  }

  // Display team info
  console.log(chalk.green('\n> STATUS REPORT:'));
  console.log(chalk.green(`  └─ Mode: ${chalk.green.bold('round-robin')}`));
  console.log(chalk.green(`  └─ Order: ${chalk.green.dim(config.participants.map((p) => p.name).join(' → '))}`));
  console.log();

  // Initialize conversation engine
  const conversation = new ConversationEngine(config, anthropicKey, openaiKey);

  // Start REPL
  await startREPL(conversation);
}

/**
 * Main REPL loop
 */
async function startREPL(conversation: ConversationEngine): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.gray('─'.repeat(80)));
  console.log(
    chalk.yellow(
      '\nType your message and press Enter. The team will respond!\n'
    )
  );
  console.log(chalk.gray('Commands:'));
  console.log(chalk.gray('  /exit or /quit - Exit the CLI'));
  console.log(chalk.gray('  /history - Show conversation history'));
  console.log(chalk.gray('  /clear - Clear conversation history'));
  console.log(chalk.gray('  /reset - Reset team configuration'));
  console.log(chalk.gray('  /parallel - 🎭 Chaos mode (easter egg)\n'));

  const prompt = () => {
    rl.question(chalk.cyan('You: '), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        const shouldContinue = await handleCommand(trimmed, conversation, rl);
        if (shouldContinue) {
          prompt();
        }
        return;
      }

      // Process message with team
      try {
        await conversation.processMessage(trimmed);
      } catch (error: any) {
        console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
      }

      prompt();
    });
  };

  prompt();
}

/**
 * Handle slash commands
 */
async function handleCommand(
  command: string,
  conversation: ConversationEngine,
  rl: readline.Interface
): Promise<boolean> {
  const cmd = command.toLowerCase();

  if (cmd === '/exit' || cmd === '/quit') {
    console.log(chalk.cyan('\n👋 Thanks for using Nexus Code!\n'));
    rl.close();
    process.exit(0);
  }

  if (cmd === '/history') {
    const history = conversation.getHistory();
    console.log(chalk.yellow('\n📜 Conversation History:\n'));

    for (const msg of history) {
      if (msg.role === 'user') {
        console.log(chalk.cyan(`User: ${msg.content}`));
      } else {
        console.log(
          chalk.green(`${msg.attribution || 'Assistant'}: ${msg.content}`)
        );
      }
      console.log();
    }

    return true;
  }

  if (cmd === '/clear') {
    conversation.loadHistory([]);
    console.log(chalk.yellow('\n🗑️  Conversation history cleared\n'));
    return true;
  }

  if (cmd === '/reset') {
    console.log(
      chalk.yellow(
        '\n⚠️  This will reset your team configuration. Restart the CLI to reconfigure.\n'
      )
    );
    return true;
  }

  if (cmd === '/parallel') {
    console.log(
      chalk.magenta(
        '\n🎭 CHAOS MODE ACTIVATED - All models responding simultaneously!\n'
      )
    );
    console.log(
      chalk.gray('(This is the broken parallel mode - kept as an easter egg 😂)\n')
    );

    // Force parallel mode for this message
    const input = await new Promise<string>((resolve) => {
      rl.question(chalk.cyan('You (chaos mode): '), (answer) => {
        resolve(answer.trim());
      });
    });

    if (input) {
      // Temporarily switch to parallel
      const originalMode = conversation['config'].mode;
      conversation['config'].mode = 'parallel';

      try {
        await conversation.processMessage(input, true);
      } catch (error: any) {
        console.log(chalk.red(`\n❌ Chaos error: ${error.message}\n`));
      }

      // Restore sequential
      conversation['config'].mode = originalMode;
    }

    return true;
  }

  console.log(chalk.red(`\n❌ Unknown command: ${command}\n`));
  return true;
}

// Run the CLI
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
