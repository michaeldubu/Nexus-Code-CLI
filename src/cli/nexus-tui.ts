#!/usr/bin/env node
/**
 * NEXUS TUI - Main Entry Point
 * Full Ink-based terminal UI - Actually works! 🔥
 */

import { config as dotenvConfig } from 'dotenv';
import React from 'react';
import { render } from 'ink';
import { NexusFileSystem } from '../core/filesystem/nexus-fs.js';
import { FileTools } from '../core/tools/file-tools.js';
import { UnifiedModelManager } from '../core/models/unified-model-manager.js';
import { NexusTUI } from './components/NexusTUI.js';
import { MCPServer } from '../core/mcp/client.js';
import { registerFileTools, getFileToolsDefinitions } from '../core/mcp/file-tools-mcp.js';

// Load environment variables
dotenvConfig();

async function main() {
  // Validate API keys
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!anthropicKey) {
    console.error('❌ Missing ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }

  // Initialize core systems
  const fileSystem = new NexusFileSystem();
  const setup = fileSystem.loadSetup();

  const fileTools = new FileTools(process.cwd());
  fileTools.setApprovedCommands(setup.approvedCommands || []);
  fileTools.setDeniedCommands(setup.deniedCommands || []);

  // Set file permissions from setup
  fileTools.setPermissions({
    autoApprove: setup.permissions?.autoApprove || false,
    allowedPaths: setup.permissions?.allowedPaths || [],
    deniedPaths: setup.permissions?.deniedPaths || [],
  });

  // Initialize model manager with all available APIs
  const modelManager = new UnifiedModelManager(
    anthropicKey,
    openaiKey,
    googleKey
  );

  // Set default model (Sonnet 4.5)
  modelManager.setModel('claude-sonnet-4-5-20250929');

  // Initialize MCP Server and register file tools
  const mcpServer = new MCPServer();
  registerFileTools(mcpServer, fileTools);

  // Get tool definitions for passing to AI models
  const toolDefinitions = getFileToolsDefinitions();

  // Handle Ctrl+C - require DOUBLE press to exit! 🔥
  let ctrlCCount = 0;
  let ctrlCTimeout: NodeJS.Timeout | null = null;

  process.on('SIGINT', () => {
    ctrlCCount++;

    if (ctrlCCount === 1) {
      console.log('\n⚠️  Press Ctrl+C again to exit (or wait 2s to cancel)');

      // Reset after 2 seconds
      ctrlCTimeout = setTimeout(() => {
        ctrlCCount = 0;
        ctrlCTimeout = null;
      }, 2000);
    } else if (ctrlCCount >= 2) {
      if (ctrlCTimeout) clearTimeout(ctrlCTimeout);
      console.log('\n👋 Exiting Nexus Code...');
      process.exit(0);
    }
  });

  // Render the TUI - Disable Ink's default Ctrl+C handler!
  const { unmount } = render(
    React.createElement(NexusTUI, {
      modelManager,
      fileSystem,
      fileTools,
      mcpServer,
      toolDefinitions,
    }),
    {
      exitOnCtrlC: false, // Disable Ink's automatic exit
    }
  );
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
