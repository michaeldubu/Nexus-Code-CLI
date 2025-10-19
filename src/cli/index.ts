#!/usr/bin/env node
/**
 * Nexus Code CLI - Interactive Multi-Agent AI Coding Assistant
 */

import { config as dotenvConfig } from 'dotenv';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import { NexusConfig } from '../core/types/index.js';
import { createNexusCode } from '../index.js';
import { NexusCode } from '../index.js';

// Load environment variables from .env file
dotenvConfig();

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗                 ║
║   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝                 ║
║   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗                 ║
║   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║                 ║
║   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║                 ║
║   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝                 ║
║                                                               ║
║        🚀 Multi-Agent AI Coding System 🔥                     ║
║                 Powered by SAAAM LLC                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`;

interface CLIContext {
  nexus: NexusCode;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentProject: string;
  agentStatus: Map<string, string>;
}

/**
 * Load configuration from .env or defaults
 */
function loadConfig(): NexusConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';

  if (!apiKey) {
    console.error(chalk.red('❌ Error: ANTHROPIC_API_KEY not found!'));
    console.error(chalk.yellow('💡 Set it in your .env file or export it:'));
    console.error(chalk.gray('   export ANTHROPIC_API_KEY=sk-ant-...'));
    process.exit(1);
  }

  return {
    maxConcurrentAgents: 5,
    maxTasksPerAgent: 3,
    defaultTimeout: 300000,

    anthropicApiKey: apiKey,
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 4096,
    temperature: 0.7,

    security: {
      enableSandbox: false,
      sandboxType: 'docker',
      autoApprove: true,
      permissionMode: 'permissive',
    },

    logging: {
      level: 'info',
      auditEnabled: true,
      provenanceTracking: true,
    },

    ui: {
      terminal: true,
      colorEnabled: true,
      verboseOutput: false,
    },
  };
}

/**
 * Print welcome banner and instructions
 */
function printWelcome() {
  console.clear();
  console.log(chalk.cyan(banner));
  console.log(chalk.white('🚀 Starting Multi-Agent System...\n'));
  console.log(chalk.gray('━'.repeat(65)));
  console.log(chalk.white('  Commands:'));
  console.log(chalk.gray('    /help     - Show available commands'));
  console.log(chalk.gray('    /agents   - Show agent status'));
  console.log(chalk.gray('    /clear    - Clear conversation history'));
  console.log(chalk.gray('    /exit     - Exit Nexus Code'));
  console.log(chalk.gray('━'.repeat(65)));
  console.log();
}

/**
 * Show agent status
 */
function showAgentStatus(ctx: CLIContext) {
  console.log();
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white('  Agent Status') + ' '.repeat(47) + chalk.cyan('║'));
  console.log(chalk.cyan('╠════════════════════════════════════════════════════════════╣'));

  const status = ctx.nexus.getStatus();

  console.log(chalk.cyan('║') + '  ' + chalk.yellow('👔 Supervisor Agent') + ' '.repeat(37) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + '     Status: ' + chalk.green('Active') + ' '.repeat(42) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + '     Role: Planning & Coordination' + ' '.repeat(26) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ' '.repeat(58) + chalk.cyan('║'));

  console.log(chalk.cyan('║') + '  ' + chalk.blue('⚡ Implementation Agent') + ' '.repeat(34) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + '     Status: ' + chalk.green('Active') + ' '.repeat(42) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + '     Role: Code Generation & Debugging' + ' '.repeat(21) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ' '.repeat(58) + chalk.cyan('║'));

  console.log(chalk.cyan('║') + '  ' + chalk.red('🔒 Security Agent') + ' '.repeat(40) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + '     Status: ' + chalk.green('Active') + ' '.repeat(42) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + '     Role: Vulnerability Scanning' + ' '.repeat(27) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ' '.repeat(58) + chalk.cyan('║'));

  console.log(chalk.cyan('║') + '  ' + chalk.magenta('📊 System Stats') + ' '.repeat(42) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + `     Total Agents: ${status.agents.totalAgents}` + ' '.repeat(43) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + `     Active Executions: ${status.agents.activeExecutions}` + ' '.repeat(38) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + `     Audit Logs: ${status.audit.total}` + ' '.repeat(44) + chalk.cyan('║'));

  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log();
}

/**
 * Handle user commands
 */
function handleCommand(command: string, ctx: CLIContext): boolean {
  switch (command.toLowerCase()) {
    case '/help':
      console.log();
      console.log(chalk.cyan('Available Commands:'));
      console.log(chalk.gray('  /help     - Show this help message'));
      console.log(chalk.gray('  /agents   - Show agent status and statistics'));
      console.log(chalk.gray('  /clear    - Clear conversation history'));
      console.log(chalk.gray('  /exit     - Exit Nexus Code'));
      console.log();
      console.log(chalk.cyan('Usage:'));
      console.log(chalk.gray('  Just type your request naturally!'));
      console.log(chalk.gray('  Examples:'));
      console.log(chalk.gray('    - "Build me a REST API with authentication"'));
      console.log(chalk.gray('    - "Scan my project for security vulnerabilities"'));
      console.log(chalk.gray('    - "Generate tests for the UserService class"'));
      console.log();
      return true;

    case '/agents':
      showAgentStatus(ctx);
      return true;

    case '/clear':
      ctx.conversationHistory = [];
      console.log(chalk.green('✅ Conversation history cleared!'));
      console.log();
      return true;

    case '/exit':
      console.log();
      console.log(chalk.cyan('👋 Shutting down Nexus Code...'));
      return false;

    default:
      console.log(chalk.red(`❌ Unknown command: ${command}`));
      console.log(chalk.gray('   Type /help for available commands'));
      console.log();
      return true;
  }
}

/**
 * Process user message with multi-agent system
 */
async function processMessage(message: string, ctx: CLIContext): Promise<void> {
  // Add to conversation history
  ctx.conversationHistory.push({ role: 'user', content: message });

  console.log();
  console.log(chalk.cyan('🤖 Nexus Agents Working...'));
  console.log(chalk.gray('━'.repeat(65)));

  // Determine which agents should handle this
  const needsSecurity = /security|vulnerability|scan|audit/.test(message.toLowerCase());
  const needsCode = /build|create|generate|implement|code|write/.test(message.toLowerCase());
  const needsAnalysis = /analyze|review|explain|understand/.test(message.toLowerCase());

  try {
    // Show agent assignments
    console.log(chalk.yellow('👔 Supervisor: ') + chalk.white('Analyzing request...'));

    if (needsCode) {
      console.log(chalk.blue('⚡ Implementation: ') + chalk.white('Preparing to generate code...'));
    }
    if (needsSecurity) {
      console.log(chalk.red('🔒 Security: ') + chalk.white('Starting security analysis...'));
    }
    if (needsAnalysis) {
      console.log(chalk.magenta('🔍 Analyzer: ') + chalk.white('Reviewing codebase...'));
    }

    console.log();

    // Route to appropriate agent workflow
    let result;

    if (needsCode) {
      // Use implementation agent
      result = await ctx.nexus.generateCode(message, [], {});
    } else if (needsSecurity) {
      // Use security agent
      result = await ctx.nexus.analyzeSecurity(process.cwd());
    } else {
      // Use supervisor for general queries
      result = await ctx.nexus.executeTask(message, {
        requirements: message,
        priority: 'high',
      });
    }

    // Display results
    if (result.success) {
      console.log(chalk.green('✅ Task Completed Successfully!\n'));

      if (result.data) {
        if (typeof result.data === 'string') {
          console.log(chalk.white(result.data));
        } else if (result.data.code) {
          console.log(chalk.gray('Generated Code:'));
          console.log(chalk.white(result.data.code));
        } else if (result.data.analysis) {
          console.log(chalk.gray('Analysis:'));
          console.log(chalk.white(JSON.stringify(result.data.analysis, null, 2)));
        } else {
          console.log(chalk.white(JSON.stringify(result.data, null, 2)));
        }
      }

      // Add to conversation history
      const response = typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data);
      ctx.conversationHistory.push({ role: 'assistant', content: response });

    } else {
      console.log(chalk.red('❌ Task Failed\n'));
      console.log(chalk.red(result.error?.message || 'Unknown error'));
    }

  } catch (error) {
    console.log(chalk.red('❌ Error processing message:'));
    console.log(chalk.red((error as Error).message));
  }

  console.log();
  console.log(chalk.gray('━'.repeat(65)));
  console.log();
}

/**
 * Main REPL loop
 */
async function startREPL(ctx: CLIContext): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('nexus> '),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input.startsWith('/')) {
      const shouldContinue = handleCommand(input, ctx);
      if (!shouldContinue) {
        rl.close();
        return;
      }
      rl.prompt();
      return;
    }

    // Process message
    await processMessage(input, ctx);
    rl.prompt();
  });

  rl.on('close', async () => {
    console.log();
    console.log(chalk.cyan('Shutting down agents...'));
    await ctx.nexus.shutdown();

    const status = ctx.nexus.getStatus();
    console.log();
    console.log(chalk.green('✅ Shutdown complete!'));
    console.log(chalk.gray(`   Total tasks completed: ${status.agents.taskAssignments}`));
    console.log(chalk.gray(`   Audit logs recorded: ${status.audit.total}`));
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
  printWelcome();

  // Load configuration
  const config = loadConfig();

  // Initialize Nexus Code
  console.log(chalk.yellow('⚙️  Initializing agents...'));
  const result = await createNexusCode(config);

  if (!result.success) {
    console.error(chalk.red('❌ Failed to initialize:'), result.error?.message);
    process.exit(1);
  }

  const nexus = result.data;
  console.log(chalk.green('✅ All agents ready!\n'));

  // Setup event listeners for real-time updates
  nexus.on('task:started', (data) => {
    if (config.ui.verboseOutput) {
      console.log(chalk.gray(`   [${data.agentId}] Task started...`));
    }
  });

  nexus.on('task:completed', (data) => {
    if (config.ui.verboseOutput) {
      console.log(chalk.gray(`   [${data.agentId}] Task completed ✓`));
    }
  });

  // Create CLI context
  const ctx: CLIContext = {
    nexus,
    conversationHistory: [],
    currentProject: process.cwd(),
    agentStatus: new Map(),
  };

  // Start REPL
  await startREPL(ctx);
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
