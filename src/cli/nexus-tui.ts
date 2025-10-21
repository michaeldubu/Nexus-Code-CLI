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

  // Initialize model manager with all available APIs
  const modelManager = new UnifiedModelManager(
    anthropicKey,
    openaiKey,
    googleKey
  );

  // Set default model (Sonnet 4.5)
  modelManager.setModel('claude-sonnet-4-5-20250929');

  // Render the TUI
  render(
    React.createElement(NexusTUI, {
      modelManager,
      fileSystem,
      fileTools,
    })
  );
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
