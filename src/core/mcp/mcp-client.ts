/**
 * MCP WebSocket Client
 * Connects to your JetBrains plugin's MCP server
 * Handles JSON-RPC 2.0 protocol, tool calls, and initialization
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

// ========== Protocol Types ==========

export type RequestId = number | string;

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: RequestId;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: RequestId;
  result?: any;
  error?: JSONRPCError;
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

// ========== MCP Specific Types ==========

export interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface CallToolRequest {
  name: string;
  arguments?: Record<string, any>;
}

export interface CallToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface InitializeRequest {
  protocolVersion: string;
  capabilities: {
    roots?: { listChanged: boolean };
    sampling?: any;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: any;
  serverInfo: {
    name: string;
    version: string;
  };
}

// ========== Client Configuration ==========

export interface MCPClientConfig {
  url: string; // WebSocket URL (e.g., ws://localhost:8080/mcp)
  reconnect?: boolean; // Auto-reconnect on disconnect
  reconnectDelay?: number; // Delay between reconnect attempts (ms)
  requestTimeout?: number; // Timeout for requests (ms)
  debug?: boolean; // Enable debug logging
}

// ========== MCP WebSocket Client ==========

export class MCPClient extends EventEmitter {
  private ws?: WebSocket;
  private config: Required<MCPClientConfig>;
  private requestId = 0;
  private pendingRequests = new Map<RequestId, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private isConnected = false;
  private isInitialized = false;
  private serverInfo?: { name: string; version: string };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(config: MCPClientConfig) {
    super();
    this.config = {
      url: config.url,
      reconnect: config.reconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 3000,
      requestTimeout: config.requestTimeout ?? 30000,
      debug: config.debug ?? false,
    };
  }

  // ========== Connection Management ==========

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        this.log('Already connected');
        resolve();
        return;
      }

      this.log(`Connecting to ${this.config.url}...`);

      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => {
        this.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code: number, reason: string) => {
        this.log(`Connection closed: ${code} ${reason}`);
        this.handleDisconnect();
      });

      this.ws.on('error', (error: Error) => {
        this.log(`WebSocket error: ${error.message}`);
        this.emit('error', error);
        
        if (!this.isConnected) {
          reject(error);
        }
      });
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      this.log('Disconnecting...');
      this.config.reconnect = false; // Disable auto-reconnect
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Handle disconnect event
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.isInitialized = false;
    this.emit('disconnected');

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
      this.pendingRequests.delete(id);
    }

    // Auto-reconnect if enabled
    if (this.config.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.log(`Reconnecting in ${this.config.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(err => {
          this.log(`Reconnect failed: ${err.message}`);
        });
      }, this.config.reconnectDelay);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached. Giving up.');
      this.emit('reconnect-failed');
    }
  }

  // ========== Message Handling ==========

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message: JSONRPCMessage = JSON.parse(data);
      this.log('⬅️  Received:', message);

      if ('method' in message && 'id' in message) {
        // Request from server (we don't handle these yet)
        this.log('Received request from server:', message.method);
      } else if ('method' in message) {
        // Notification from server
        this.handleNotification(message as JSONRPCNotification);
      } else if ('id' in message) {
        // Response to our request
        this.handleResponse(message as JSONRPCResponse);
      }
    } catch (error) {
      this.log('Failed to parse message:', error);
    }
  }

  /**
   * Handle JSON-RPC response
   */
  private handleResponse(response: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      this.log(`Received response for unknown request: ${response.id}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(`[${response.error.code}] ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Handle JSON-RPC notification
   */
  private handleNotification(notification: JSONRPCNotification): void {
    this.emit('notification', notification);
    this.emit(`notification:${notification.method}`, notification.params);
  }

  // ========== Request/Response ==========

  /**
   * Send JSON-RPC request and wait for response
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to server');
    }

    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.requestTimeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request
      this.log('➡️  Sending:', request);
      this.ws!.send(JSON.stringify(request));
    });
  }

  /**
   * Send notification (no response expected)
   */
  private sendNotification(method: string, params?: any): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to server');
    }

    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.log('➡️  Sending notification:', notification);
    this.ws.send(JSON.stringify(notification));
  }

  // ========== MCP Protocol Methods ==========

  /**
   * Initialize the MCP session
   */
  async initialize(clientInfo?: { name: string; version: string }): Promise<InitializeResult> {
    const request: InitializeRequest = {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
      },
      clientInfo: clientInfo || {
        name: 'nexus-mcp-client',
        version: '0.1.0',
      },
    };

    const result = await this.sendRequest('initialize', request);
    this.isInitialized = true;
    this.serverInfo = result.serverInfo;
    
    this.log(`✅ Initialized: ${result.serverInfo.name} v${result.serverInfo.version}`);
    this.emit('initialized', result);

    return result;
  }

  /**
   * Send ping to keep connection alive
   */
  async ping(): Promise<void> {
    await this.sendRequest('ping');
  }

  /**
   * List available tools
   */
  async listTools(): Promise<Tool[]> {
    const result = await this.sendRequest('tools/list');
    return result.tools || [];
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args?: Record<string, any>): Promise<CallToolResult> {
    const request: CallToolRequest = {
      name,
      arguments: args || {},
    };

    return await this.sendRequest('tools/call', request);
  }

  // ========== Convenience Methods ==========

  /**
   * Connect and initialize in one call
   */
  async connectAndInitialize(clientInfo?: { name: string; version: string }): Promise<InitializeResult> {
    await this.connect();
    return await this.initialize(clientInfo);
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected && this.isInitialized;
  }

  /**
   * Get server info
   */
  getServerInfo(): { name: string; version: string } | undefined {
    return this.serverInfo;
  }

  /**
   * Start ping interval to keep connection alive
   */
  startPingInterval(intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(() => {
      if (this.isReady()) {
        this.ping().catch(err => {
          this.log(`Ping failed: ${err.message}`);
        });
      }
    }, intervalMs);
  }

  // ========== Logging ==========

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[MCPClient]', ...args);
    }
  }
}

// ========== Helper Functions ==========

/**
 * Create and connect MCP client
 */
export async function createMCPClient(config: MCPClientConfig): Promise<MCPClient> {
  const client = new MCPClient(config);
  await client.connectAndInitialize();
  return client;
}

/**
 * Pretty print tool call result
 */
export function formatToolResult(result: CallToolResult): string {
  if (result.isError) {
    return `❌ Error: ${result.content[0]?.text || 'Unknown error'}`;
  }
  return result.content.map(c => c.text).join('\n');
}

// ========== Example Usage ==========

export async function exampleUsage() {
  // Create client
  const client = new MCPClient({
    url: 'ws://localhost:8080/mcp',
    debug: true,
    reconnect: true,
  });

  // Set up event listeners
  client.on('connected', () => {
    console.log('🟢 Connected to MCP server');
  });

  client.on('disconnected', () => {
    console.log('🔴 Disconnected from MCP server');
  });

  client.on('initialized', (result) => {
    console.log(`✅ Initialized: ${result.serverInfo.name}`);
  });

  client.on('error', (error) => {
    console.error('❌ Error:', error);
  });

  try {
    // Connect and initialize
    await client.connectAndInitialize({
      name: 'nexus-cli',
      version: '1.0.0',
    });

    // Start ping interval
    const pingInterval = client.startPingInterval(30000);

    // List available tools
    const tools = await client.listTools();
    console.log('📋 Available tools:', tools.map(t => t.name));

    // Call a tool
    const result = await client.callTool('context_get_summary');
    console.log(formatToolResult(result));

    // Call intelligence tool with arguments
    const relevantFiles = await client.callTool('context_find_relevant', {
      query: 'authentication',
      current_files: ['src/auth/Login.kt'],
    });
    console.log(formatToolResult(relevantFiles));

    // Clean up
    clearInterval(pingInterval);
    client.disconnect();

  } catch (error) {
    console.error('Failed:', error);
  }
}

// Run example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage().catch(console.error);
}
