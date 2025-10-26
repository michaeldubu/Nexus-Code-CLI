#!/usr/bin/env ts-node
/**
 * Quick test to connect to running JetBrains plugin
 */

import WebSocket from 'ws';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read lock file
const lockFilePath = '/home/michael/saaam_dev/.nexus-code/50000.json';
const lockFile = JSON.parse(readFileSync(lockFilePath, 'utf-8'));

console.log('🔌 Connecting to JetBrains plugin...');
console.log(`   Port: ${lockFile.port}`);
console.log(`   Project: ${lockFile.projectName}`);
console.log('');

const ws = new WebSocket(`ws://localhost:${lockFile.port}/mcp`, {
  headers: {
    'X-Claude-Code-Ide-Authorization': lockFile.authToken,
  },
});

let requestId = 0;

ws.on('open', () => {
  console.log('✅ Connected!');
  console.log('');

  // Send initialize
  console.log('📤 Sending initialize...');
  const initRequest = {
    jsonrpc: '2.0',
    id: ++requestId,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
      },
      clientInfo: {
        name: 'nexus-test-client',
        version: '0.1.0',
      },
    },
  };
  ws.send(JSON.stringify(initRequest));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📥 Received:', JSON.stringify(message, null, 2));
  console.log('');

  // After initialize, list tools
  if (message.id === 1) {
    console.log('📤 Sending tools/list...');
    const toolsRequest = {
      jsonrpc: '2.0',
      id: ++requestId,
      method: 'tools/list',
      params: {},
    };
    ws.send(JSON.stringify(toolsRequest));
  }

  // After tools list, call context_get_summary
  if (message.id === 2) {
    console.log('📤 Calling context_get_summary...');
    const summaryRequest = {
      jsonrpc: '2.0',
      id: ++requestId,
      method: 'tools/call',
      params: {
        name: 'context_get_summary',
        arguments: {},
      },
    };
    ws.send(JSON.stringify(summaryRequest));
  }

  // After summary, disconnect
  if (message.id === 3) {
    console.log('✅ SUCCESS! Plugin integration working!');
    console.log('');
    console.log('🎯 You can now use the MCP client in your Nexus CLI!');
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});
