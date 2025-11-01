/**
 * Nexus TUI with MCP Client Integration
 * Connects to your JetBrains plugin and uses Context Intelligence
 */

import { MCPClient, formatToolResult, CallToolResult } from './mcp-client.js';
import chalk from 'chalk';
import readline from 'readline';

// ========== TUI State ==========

interface TUIState {
  client: MCPClient;
  currentFiles: string[];
  autoLoadContext: boolean;
}

// ========== MCP Client Manager ==========

class NexusMCPManager {
  private client: MCPClient;
  private initialized = false;

  constructor(url: string = 'ws://localhost:8080/mcp') {
    this.client = new MCPClient({
      url,
      debug: false,
      reconnect: true,
      reconnectDelay: 3000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connected', () => {
      console.log(chalk.green('✅ Connected to IntelliJ plugin'));
    });

    this.client.on('disconnected', () => {
      console.log(chalk.red('🔴 Disconnected from IntelliJ plugin'));
      console.log(chalk.yellow('Attempting to reconnect...'));
    });

    this.client.on('initialized', (result) => {
      console.log(chalk.green(`✅ ${result.serverInfo.name} v${result.serverInfo.version}`));
      this.initialized = true;
    });

    this.client.on('reconnect-failed', () => {
      console.log(chalk.red('❌ Failed to reconnect. Is IntelliJ running?'));
      process.exit(1);
    });

    this.client.on('error', (error) => {
      console.error(chalk.red('❌ MCP Error:'), error.message);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connectAndInitialize({
        name: 'nexus-tui',
        version: '0.1.0',
      });

      // Start ping to keep connection alive
      this.client.startPingInterval(30000);
      
    } catch (error: any) {
      throw new Error(`Failed to connect: ${error.message}`);
    }
  }

  getClient(): MCPClient {
    return this.client;
  }

  isReady(): boolean {
    return this.initialized && this.client.isReady();
  }
}

// ========== Command Handlers ==========

class CommandHandler {
  constructor(private mcpManager: NexusMCPManager) {}

  async handleCommand(input: string, state: TUIState): Promise<string> {
    const [cmd, ...args] = input.trim().split(/\s+/);

    switch (cmd) {
      case '/context':
        return await this.handleContext();
      
      case '/relevant':
        return await this.handleRelevant(args.join(' '), state);
      
      case '/analyze':
        return await this.handleAnalyze(args.join(' '));
      
      case '/deps':
        return await this.handleDeps(args.join(' '));
      
      case '/suggest':
        return await this.handleSuggest();
      
      case '/complex':
        return await this.handleComplex();
      
      case '/tools':
        return await this.handleListTools();
      
      case '/status':
        return this.handleStatus();
      
      case '/help':
        return this.handleHelp();
      
      default:
        return chalk.red(`Unknown command: ${cmd}\nType /help for available commands`);
    }
  }

  private async handleContext(): Promise<string> {
    try {
      const result = await this.mcpManager.getClient().callTool('context_get_summary');
      return formatToolResult(result);
    } catch (error: any) {
      return chalk.red(`❌ Error: ${error.message}`);
    }
  }

  private async handleRelevant(query: string, state: TUIState): Promise<string> {
    if (!query) {
      return chalk.yellow('Usage: /relevant <query>\nExample: /relevant authentication system');
    }

    try {
      const result = await this.mcpManager.getClient().callTool('context_find_relevant', {
        query,
        current_files: state.currentFiles,
      });
      return formatToolResult(result);
    } catch (error: any) {
      return chalk.red(`❌ Error: ${error.message}`);
    }
  }

  private async handleAnalyze(filePath: string): Promise<string> {
    if (!filePath) {
      return chalk.yellow('Usage: /analyze <file_path>\nExample: /analyze src/main/kotlin/App.kt');
    }

    try {
      const result = await this.mcpManager.getClient().callTool('context_analyze_file', {
        file_path: filePath,
      });
      return formatToolResult(result);
    } catch (error: any) {
      return chalk.red(`❌ Error: ${error.message}`);
    }
  }

  private async handleDeps(filePath: string): Promise<string> {
    if (!filePath) {
      return chalk.yellow('Usage: /deps <file_path>\nExample: /deps src/main/kotlin/App.kt');
    }

    try {
      const result = await this.mcpManager.getClient().callTool('context_get_dependencies', {
        file_path: filePath,
        depth: 3,
      });
      return formatToolResult(result);
    } catch (error: any) {
      return chalk.red(`❌ Error: ${error.message}`);
    }
  }

  private async handleSuggest(): Promise<string> {
    try {
      const result = await this.mcpManager.getClient().callTool('context_suggest');
      return formatToolResult(result);
    } catch (error: any) {
      return chalk.red(`❌ Error: ${error.message}`);
    }
  }

  private async handleComplex(): Promise<string> {
    try {
      const result = await this.mcpManager.getClient().callTool('context_complexity', {
        limit: 15,
      });
      return formatToolResult(result);
    } catch (error: any) {
      return chalk.red(`❌ Error: ${error.message}`);
    }
  }

  private async handleListTools(): Promise<string> {
    try {
      const tools = await this.mcpManager.getClient().listTools();
      
      const lines = [
        chalk.cyan('📋 AVAILABLE MCP TOOLS'),
        chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
      ];

      tools.forEach(tool => {
        lines.push(chalk.green(`• ${tool.name}`));
        lines.push(chalk.gray(`  ${tool.description.split('\n')[0]}`));
        lines.push('');
      });

      return lines.join('\n');
    } catch (error: any) {
      return chalk.red(`❌ Error: ${error.message}`);
    }
  }

  private handleStatus(): string {
    const client = this.mcpManager.getClient();
    const serverInfo = client.getServerInfo();
    
    const lines = [
      chalk.cyan('📊 MCP CONNECTION STATUS'),
      chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
      '',
      `Connected: ${client.isReady() ? chalk.green('✅ Yes') : chalk.red('❌ No')}`,
    ];

    if (serverInfo) {
      lines.push(`Server: ${chalk.yellow(serverInfo.name)} v${serverInfo.version}`);
    }

    return lines.join('\n');
  }

  private handleHelp(): string {
    return `
${chalk.cyan('🧠 NEXUS MCP COMMANDS')}
${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}

${chalk.yellow('INTELLIGENCE COMMANDS:')}
  ${chalk.green('/context')}           Show project context summary
  ${chalk.green('/relevant <query>')}  Find files relevant to query
  ${chalk.green('/analyze <file>')}    Analyze a specific file
  ${chalk.green('/deps <file>')}       Show dependency tree
  ${chalk.green('/suggest')}           Get improvement suggestions
  ${chalk.green('/complex')}           Show complex files

${chalk.yellow('MCP COMMANDS:')}
  ${chalk.green('/tools')}             List all available tools
  ${chalk.green('/status')}            Show connection status
  ${chalk.green('/help')}              Show this help

${chalk.yellow('EXAMPLES:')}
  /relevant authentication system
  /analyze src/main/kotlin/App.kt
  /deps src/services/UserService.kt

${chalk.gray('💡 Tip: Commands call your IntelliJ plugin via MCP')}
`.trim();
  }
}

// ========== Main TUI ==========

async function main() {
  console.clear();
  console.log(chalk.cyan(`
███╗   ███╗ ██████╗██████╗ 
████╗ ████║██╔════╝██╔══██╗
██╔████╔██║██║     ██████╔╝
██║╚██╔╝██║██║     ██╔═══╝ 
██║ ╚═╝ ██║╚██████╗██║     
╚═╝     ╚═╝ ╚═════╝╚═╝     
  `));
  console.log(chalk.yellow('MCP WebSocket Client'));
  console.log(chalk.gray('Connecting to IntelliJ plugin...\n'));

  // Initialize MCP manager
  const mcpManager = new NexusMCPManager();
  
  try {
    await mcpManager.connect();
  } catch (error: any) {
    console.error(chalk.red('❌ Failed to connect to IntelliJ plugin'));
    console.error(chalk.gray(`   Make sure the NEXUS plugin is running`));
    console.error(chalk.gray(`   Error: ${error.message}`));
    process.exit(1);
  }

  // Show initial status
  console.log();
  const tools = await mcpManager.getClient().listTools();
  console.log(chalk.green(`✅ Connected! ${tools.length} tools available`));
  console.log(chalk.gray('Type /help for available commands\n'));

  // Initialize state
  const state: TUIState = {
    client: mcpManager.getClient(),
    currentFiles: [],
    autoLoadContext: true,
  };

  // Create command handler
  const commandHandler = new CommandHandler(mcpManager);

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('nexus> '),
  });

  // Handle user input
  rl.on('line', async (input: string) => {
    const trimmed = input.trim();
    
    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed === 'exit' || trimmed === 'quit') {
      console.log(chalk.yellow('Disconnecting...'));
      mcpManager.getClient().disconnect();
      rl.close();
      process.exit(0);
    }

    try {
      if (trimmed.startsWith('/')) {
        // Command
        const result = await commandHandler.handleCommand(trimmed, state);
        console.log(result);
      } else {
        // Regular message - would go to AI here
        console.log(chalk.gray('💬 Message:', trimmed));
        console.log(chalk.yellow('⚠️  AI integration not implemented yet'));
        console.log(chalk.gray('    This is where you would send to Claude/AI'));
      }
    } catch (error: any) {
      console.error(chalk.red('❌ Error:'), error.message);
    }

    console.log();
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.yellow('\nGoodbye! 👋'));
    process.exit(0);
  });

  // Start prompt
  rl.prompt();
}

// ========== Auto-Context Loading (for AI integration) ==========

/**
 * Example: How to use MCP client with AI
 */
export async function exampleAIIntegration(
  userMessage: string,
  mcpClient: MCPClient
): Promise<string> {
  // Step 1: Find relevant files based on the message
  const relevantResult = await mcpClient.callTool('context_find_relevant', {
    query: userMessage,
    current_files: [],
  });

  // Parse the relevant files from the result
  // (In real implementation, you'd parse the actual file list)
  console.log('Auto-loaded context:', formatToolResult(relevantResult));

  // Step 2: Send to AI with context
  // This is where you'd call Claude API
  const aiResponse = await callYourAI(userMessage, relevantResult);

  return aiResponse;
}

async function callYourAI(message: string, context: CallToolResult): Promise<string> {
  // TODO: Implement your AI integration here
  // Example:
  // const response = await anthropic.messages.create({
  //   model: 'claude-sonnet-4-5-20250929',
  //   messages: [
  //     { role: 'user', content: context.content[0].text },
  //     { role: 'user', content: message }
  //   ]
  // });
  // return response.content[0].text;
  
  return 'AI response would go here';
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}
