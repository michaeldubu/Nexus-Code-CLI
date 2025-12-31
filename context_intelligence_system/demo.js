/**
 * NEXUS Context Intelligence - Interactive Demo
 * Shows what this beast can do!
 */
import { MCPClient, formatToolResult } from './dist/mcp-client.js';
import chalk from 'chalk';
import readline from 'readline';
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function printHeader(title) {
    console.log();
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.cyan.bold(`  ${title}`));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();
}
async function demo() {
    console.clear();
    console.log(chalk.magenta(`
    ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
    ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
    ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
    ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
    ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
  `));
    console.log(chalk.yellow('  Context Intelligence System - Interactive Demo'));
    console.log(chalk.gray('  Built by SAAAM LLC\n'));
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const ask = (question) => {
        return new Promise(resolve => {
            rl.question(chalk.cyan(question), answer => {
                resolve(answer);
            });
        });
    };
    printHeader('Welcome to NEXUS Context Intelligence!');
    console.log(chalk.white('This demo shows you what makes this system REVOLUTIONARY:\n'));
    console.log(chalk.gray('  ✓ Real PSI-powered code analysis (not dumb regex)'));
    console.log(chalk.gray('  ✓ Smart file relevance scoring'));
    console.log(chalk.gray('  ✓ Actual dependency tracking'));
    console.log(chalk.gray('  ✓ Cyclomatic complexity via AST'));
    console.log(chalk.gray('  ✓ MCP protocol for AI integration\n'));
    const shouldConnect = await ask('Connect to IntelliJ plugin now? (y/n): ');
    if (shouldConnect.toLowerCase() !== 'y') {
        console.log(chalk.yellow('\n📋 No problem! Here\'s what you can do:'));
        console.log(chalk.gray('  1. Build the plugin: ./gradlew buildPlugin'));
        console.log(chalk.gray('  2. Install in IntelliJ (Settings → Plugins)'));
        console.log(chalk.gray('  3. Open a project'));
        console.log(chalk.gray('  4. Run this demo again\n'));
        console.log(chalk.cyan('Meanwhile, check out:'));
        console.log(chalk.gray('  • QUICKSTART.md - Quick setup guide'));
        console.log(chalk.gray('  • README.md - Full documentation'));
        console.log(chalk.gray('  • test-mcp-client.js - Run tests without plugin\n'));
        rl.close();
        return;
    }
    printHeader('Connecting to IntelliJ Plugin...');
    const client = new MCPClient({
        url: 'ws://localhost:8080/mcp',
        debug: false,
        reconnect: false,
    });
    client.on('connected', () => {
        console.log(chalk.green('  ✓ WebSocket connected'));
    });
    client.on('initialized', (result) => {
        console.log(chalk.green(`  ✓ MCP initialized: ${result.serverInfo.name} v${result.serverInfo.version}`));
    });
    client.on('error', (error) => {
        console.log(chalk.red(`  ✗ Error: ${error.message}`));
    });
    try {
        await client.connectAndInitialize({
            name: 'nexus-demo',
            version: '1.0.0',
        });
        client.startPingInterval(30000);
        printHeader('Demo 1: Project Summary');
        console.log(chalk.gray('Getting intelligent overview of your codebase...\n'));
        await sleep(500);
        const summary = await client.callTool('context_get_summary');
        console.log(formatToolResult(summary));
        await ask('\nPress Enter to continue...');
        printHeader('Demo 2: Find Relevant Files');
        const query = await ask('What are you looking for? (e.g., "authentication"): ');
        console.log(chalk.gray('\nSearching with smart relevance scoring...\n'));
        await sleep(500);
        const relevant = await client.callTool('context_find_relevant', {
            query,
            current_files: [],
        });
        console.log(formatToolResult(relevant));
        await ask('\nPress Enter to continue...');
        printHeader('Demo 3: Analyze Specific File');
        const filePath = await ask('Enter file path to analyze: ');
        console.log(chalk.gray('\nRunning PSI-powered analysis...\n'));
        await sleep(500);
        try {
            const analysis = await client.callTool('context_analyze_file', {
                file_path: filePath,
            });
            console.log(formatToolResult(analysis));
        }
        catch (error) {
            console.log(chalk.red(`Error: ${error.message}`));
        }
        await ask('\nPress Enter to continue...');
        printHeader('Demo 4: Dependency Analysis');
        console.log(chalk.gray('Getting dependency tree...\n'));
        await sleep(500);
        try {
            const deps = await client.callTool('context_get_dependencies', {
                file_path: filePath,
                depth: 2,
            });
            console.log(formatToolResult(deps));
        }
        catch (error) {
            console.log(chalk.red(`Error: ${error.message}`));
        }
        await ask('\nPress Enter to continue...');
        printHeader('Demo 5: Complexity Analysis');
        console.log(chalk.gray('Finding most complex files (via REAL cyclomatic complexity)...\n'));
        await sleep(500);
        const complex = await client.callTool('context_complexity', {
            limit: 10,
        });
        console.log(formatToolResult(complex));
        await ask('\nPress Enter to continue...');
        printHeader('Demo 6: Improvement Suggestions');
        console.log(chalk.gray('Getting AI-powered suggestions...\n'));
        await sleep(500);
        const suggestions = await client.callTool('context_suggest');
        console.log(formatToolResult(suggestions));
        printHeader('Demo Complete!');
        console.log(chalk.green('You just saw:'));
        console.log(chalk.gray('  ✓ MCP WebSocket communication'));
        console.log(chalk.gray('  ✓ PSI-powered code analysis'));
        console.log(chalk.gray('  ✓ Smart relevance scoring'));
        console.log(chalk.gray('  ✓ Dependency tracking'));
        console.log(chalk.gray('  ✓ Real complexity metrics'));
        console.log(chalk.gray('  ✓ AI-ready context intelligence\n'));
        console.log(chalk.cyan('Next steps:'));
        console.log(chalk.gray('  • Integrate with your AI (see QUICKSTART.md)'));
        console.log(chalk.gray('  • Try the interactive TUI: node dist/nexus-mcp-tui.js'));
        console.log(chalk.gray('  • Read the full docs: README.md\n'));
        console.log(chalk.magenta('Built with 🔥 by SAAAM LLC'));
        console.log(chalk.gray('No tokenizers. No limitations. Just innovation.\n'));
        client.disconnect();
        rl.close();
    }
    catch (error) {
        const isConnectionError = error.code === 'ECONNREFUSED' ||
            error.message?.includes('ECONNREFUSED') ||
            (error.errors && error.errors.some((e) => e.code === 'ECONNREFUSED'));
        if (isConnectionError) {
            console.log(chalk.yellow('\n⚠️  Could not connect to IntelliJ plugin'));
            console.log(chalk.gray('\nMake sure:'));
            console.log(chalk.gray('  1. IntelliJ is running'));
            console.log(chalk.gray('  2. Plugin is installed and enabled'));
            console.log(chalk.gray('  3. A project is open'));
            console.log(chalk.gray('  4. WebSocket server started (check logs)\n'));
        }
        else {
            console.error(chalk.red('\nError:'), error.message);
        }
        rl.close();
    }
}
demo().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});
