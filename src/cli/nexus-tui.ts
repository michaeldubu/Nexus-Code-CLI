#!/usr/bin/env node
/**
 * NEXUS TUI - Main Entry Point
 * Full Ink-based terminal UI - Actually works! 🔥
 */

import { config as dotenvConfig } from 'dotenv';
import React from 'react';
import { render } from 'ink';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { NexusFileSystem } from '../core/filesystem/nexus-fs.js';
import { FileTools } from '../core/tools/file-tools.js';
import { MemoryTool } from '../core/tools/memory-tool.js';
import { WebTools } from '../core/tools/web-tools.js';
import { UnifiedModelManager } from '../core/models/unified-model-manager.js';
import { NexusTUI } from './components/NexusTUI.js';
import { MCPServer } from '../core/mcp/client.js';
import { registerFileTools, getFileToolsDefinitions } from '../core/mcp/file-tools-mcp.js';
import { registerWebTools, getWebToolsDefinitions } from '../core/mcp/web-tools-mcp.js';
import { getMCPManager } from '../core/mcp/mcp-manager.js';
import { NexusAgentFactory } from '../core/agents/index.js';

// Load environment variables
dotenvConfig();

async function main() {
  // Validate API keys - at least ONE provider is required
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!anthropicKey && !openaiKey && !googleKey) {
    console.error('❌ No API keys found! Set at least one of:');
    console.error('   - ANTHROPIC_API_KEY (Claude)');
    console.error('   - OPENAI_API_KEY (GPT)');
    console.error('   - GOOGLE_API_KEY (Gemini)');
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

  // Initialize memory tool
  const memoryTool = new MemoryTool(process.cwd());

  // Initialize web tools
  const webTools = new WebTools();

  // Initialize model manager with all available APIs
  // Constructor automatically selects Haiku 4.5 as default (fast & cheap)
  const modelManager = new UnifiedModelManager(
    anthropicKey,
    openaiKey,
    googleKey
  );

  // Initialize MCP Server and register file tools + web tools + memory
  const mcpServer = new MCPServer();
  registerFileTools(mcpServer, fileTools);
  registerWebTools(mcpServer, webTools);

  // Register memory tool
  mcpServer.registerTool({
    name: 'memory',
    description: 'Store and retrieve information across sessions in memory files',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: ['view', 'create', 'str_replace', 'insert', 'delete', 'rename'] },
        path: { type: 'string' },
        file_text: { type: 'string' },
        old_str: { type: 'string' },
        new_str: { type: 'string' },
        insert_line: { type: 'number' },
        insert_text: { type: 'string' },
        old_path: { type: 'string' },
        new_path: { type: 'string' },
        view_range: { type: 'array', items: { type: 'number' } },
      },
      required: ['command'],
    },
  }, async (input) => {
    const result = await memoryTool.execute(input.command, input);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.output || 'Success';
  });

  // Initialize MCP Manager and try to connect to JetBrains plugin
  const mcpManager = getMCPManager();
  let mcpConnected = false;
  try {
    mcpConnected = await mcpManager.autoConnect();
    if (mcpConnected) {
      // Log to file - no console spam
      const logDir = join(homedir(), '.nexus', 'logs');
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      appendFileSync(
        join(logDir, 'mcp.log'),
        `[${new Date().toISOString()}] Connected to JetBrains plugin: ${mcpManager.getCurrentInstance()?.projectName}\n`
      );
    }
  } catch (error) {
    // Log to file - JetBrains plugin is OPTIONAL (TypeScript intelligence works standalone)
    const logDir = join(homedir(), '.nexus', 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    appendFileSync(
      join(logDir, 'mcp.log'),
      `[${new Date().toISOString()}] JetBrains plugin not available (optional - TypeScript intelligence active)\n`
    );
  }

  // 🧠 Intelligence will initialize AFTER TUI mounts (truly non-blocking!)

  // Initialize Agent SDK Factory (optional - only if ANTHROPIC_API_KEY is set)
  let agentFactory: NexusAgentFactory | undefined;
  if (anthropicKey) {
    agentFactory = new NexusAgentFactory(fileTools, webTools, memoryTool);
  }

  // Get tool definitions for passing to AI models
  const toolDefinitions = [
    ...getFileToolsDefinitions(),
    ...getWebToolsDefinitions(),
    {
      name: 'memory',
      description: 'Store and retrieve information across sessions in /memories directory',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', enum: ['view', 'create', 'str_replace', 'insert', 'delete', 'rename'] },
          path: { type: 'string' },
          file_text: { type: 'string' },
          old_str: { type: 'string' },
          new_str: { type: 'string' },
          insert_line: { type: 'number' },
          insert_text: { type: 'string' },
          old_path: { type: 'string' },
          new_path: { type: 'string' },
          view_range: { type: 'array', items: { type: 'number' } },
        },
        required: ['command'],
      },
    },
    // 🎨 Image Generation (Cross-provider delegation: Claude -> OpenAI gpt-image-1)
    {
      name: 'generate_image',
      description: 'Generate or edit images using AI. Supports creating new images from text descriptions, editing existing images, and multi-turn refinement. Images are saved to .nexus/images/ directory.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of the image to generate or edit. Be specific about style, colors, composition, and any important details.'
          },
          quality: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'auto'],
            description: 'Quality level for the generated image. Default: auto'
          },
          size: {
            type: 'string',
            enum: ['1024x1024', '1536x1024', '1024x1536', 'auto'],
            description: 'Size of the generated image. Default: auto'
          },
        },
        required: ['prompt'],
      },
    },
    // 🎨 Image Generation (OpenAI built-in tool via Responses API)
    {
      type: 'image_generation',
      partial_images: 3, // Max progressive images for streaming
      moderation: 'low', // Less restrictive filtering
      model: 'gpt-image-1', // Default model
      output_format: 'png', // PNG format
      quality: 'auto', // Let model decide quality
      size: 'auto', // Let model decide size
      background: 'auto', // Let model decide background
    },
  ];

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
      memoryTool,
      mcpServer,
      mcpManager,
      toolDefinitions,
      workspaceRoot: process.cwd(), // Pass workspace root for intelligence init
      agentFactory, // Agent SDK Factory (optional)
    }),
    {
      exitOnCtrlC: false, // Disable Ink's automatic exit
      patchConsole: false, // Don't hijack console.log
    }
  );
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
