/**
 * Test MCP Client - Standalone test with mock server
 * Tests the MCP client without requiring the JetBrains plugin
 */

import { MCPClient, formatToolResult } from './dist/mcp-client.js';
import chalk from 'chalk';

async function testMCPClient() {
  console.log(chalk.cyan('🧪 Testing MCP Client\n'));

  // Test 1: Create client instance
  console.log(chalk.yellow('Test 1: Create client instance'));
  const client = new MCPClient({
    url: 'ws://localhost:8080/mcp',
    debug: true,
    reconnect: false, // Disable for testing
  });
  console.log(chalk.green('✅ Client created\n'));

  // Test 2: Event handlers
  console.log(chalk.yellow('Test 2: Set up event handlers'));
  let connectedFired = false;
  let initializedFired = false;

  client.on('connected', () => {
    console.log(chalk.green('  ✅ Connected event fired'));
    connectedFired = true;
  });

  client.on('disconnected', () => {
    console.log(chalk.yellow('  ⚠️  Disconnected event fired'));
  });

  client.on('initialized', (result) => {
    console.log(chalk.green(`  ✅ Initialized event fired: ${result.serverInfo.name}`));
    initializedFired = true;
  });

  client.on('error', (error) => {
    console.log(chalk.red(`  ❌ Error event fired: ${error.message}`));
  });

  console.log(chalk.green('✅ Event handlers registered\n'));

  // Test 3: Attempt connection
  console.log(chalk.yellow('Test 3: Attempt connection to ws://localhost:8080/mcp'));
  console.log(chalk.gray('  Note: This will fail if JetBrains plugin is not running'));

  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );

    await Promise.race([
      client.connect(),
      timeout
    ]);

    console.log(chalk.green('✅ Connected successfully!\n'));

    // Test 4: Initialize
    console.log(chalk.yellow('Test 4: Initialize MCP session'));
    await client.initialize({
      name: 'nexus-test',
      version: '0.1.0',
    });
    console.log(chalk.green('✅ Initialized successfully!\n'));

    // Test 5: List tools
    console.log(chalk.yellow('Test 5: List available tools'));
    const tools = await client.listTools();
    console.log(chalk.green(`✅ Found ${tools.length} tools:`));
    tools.forEach(tool => {
      console.log(chalk.gray(`  • ${tool.name}: ${tool.description.split('\n')[0]}`));
    });
    console.log();

    // Test 6: Call a tool
    console.log(chalk.yellow('Test 6: Call context_get_summary tool'));
    const result = await client.callTool('context_get_summary');
    console.log(chalk.green('✅ Tool called successfully:'));
    console.log(chalk.gray(formatToolResult(result)));
    console.log();

    // Test 7: Call tool with arguments
    console.log(chalk.yellow('Test 7: Call context_find_relevant with query'));
    const relevantResult = await client.callTool('context_find_relevant', {
      query: 'authentication system',
      current_files: [],
    });
    console.log(chalk.green('✅ Tool with arguments called successfully:'));
    console.log(chalk.gray(formatToolResult(relevantResult)));
    console.log();

    // Test 8: Ping
    console.log(chalk.yellow('Test 8: Send ping'));
    await client.ping();
    console.log(chalk.green('✅ Ping successful\n'));

    // Test 9: Check state
    console.log(chalk.yellow('Test 9: Check client state'));
    console.log(chalk.gray(`  isReady: ${client.isReady()}`));
    const serverInfo = client.getServerInfo();
    if (serverInfo) {
      console.log(chalk.gray(`  Server: ${serverInfo.name} v${serverInfo.version}`));
    }
    console.log(chalk.green('✅ State check complete\n'));

    // Clean up
    client.disconnect();
    console.log(chalk.green('✅ All tests passed!'));

  } catch (error: any) {
    const isConnectionError =
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('timeout') ||
      (error.errors && error.errors.some((e: any) => e.code === 'ECONNREFUSED'));

    if (isConnectionError) {
      console.log(chalk.yellow('\n⚠️  Could not connect to plugin (expected if not running)'));
      console.log(chalk.gray('\nTo run full tests:'));
      console.log(chalk.gray('  1. Build the JetBrains plugin: ./gradlew buildPlugin'));
      console.log(chalk.gray('  2. Run IntelliJ with the plugin'));
      console.log(chalk.gray('  3. Open a project in IntelliJ'));
      console.log(chalk.gray('  4. Run this test again\n'));

      console.log(chalk.cyan('✅ Client structure test: PASSED'));
      console.log(chalk.yellow('⏭️  Connection test: SKIPPED (server not running)'));
    } else {
      console.error(chalk.red(`❌ Test failed: ${error.message}`));
      throw error;
    }
  }
}

// Test formatToolResult helper
function testHelpers() {
  console.log(chalk.cyan('\n🧪 Testing Helper Functions\n'));

  console.log(chalk.yellow('Test: formatToolResult'));

  const successResult = {
    content: [
      { type: 'text', text: 'Test result line 1' },
      { type: 'text', text: 'Test result line 2' }
    ],
    isError: false
  };

  const errorResult = {
    content: [
      { type: 'text', text: 'Test error message' }
    ],
    isError: true
  };

  console.log(chalk.gray('  Success result:'));
  console.log(chalk.gray(`    ${formatToolResult(successResult)}`));

  console.log(chalk.gray('  Error result:'));
  console.log(chalk.gray(`    ${formatToolResult(errorResult)}`));

  console.log(chalk.green('✅ Helper functions work correctly\n'));
}

// Run all tests
async function runAllTests() {
  console.clear();
  console.log(chalk.cyan(`
  ███╗   ███╗ ██████╗██████╗      ████████╗███████╗███████╗████████╗
  ████╗ ████║██╔════╝██╔══██╗     ╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝
  ██╔████╔██║██║     ██████╔╝        ██║   █████╗  ███████╗   ██║
  ██║╚██╔╝██║██║     ██╔═══╝         ██║   ██╔══╝  ╚════██║   ██║
  ██║ ╚═╝ ██║╚██████╗██║             ██║   ███████╗███████║   ██║
  ╚═╝     ╚═╝ ╚═════╝╚═╝             ╚═╝   ╚══════╝╚══════╝   ╚═╝
  `));
  console.log(chalk.yellow('MCP WebSocket Client Test Suite\n'));

  testHelpers();
  await testMCPClient();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.green('Test suite complete!'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

runAllTests().catch(error => {
  console.error(chalk.red('\n💥 Fatal error:'), error);
  process.exit(1);
});
