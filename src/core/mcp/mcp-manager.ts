/**
 * MCP Manager - Integrates Context Intelligence into Unified Model Manager
 */

import { MCPClient } from './mcp-client.js';
import { discoverPluginInstances, getBestPluginInstance, getWebSocketUrl, getAuthHeaders, PluginInstance } from './mcp-discovery.js';
import WebSocket from 'ws';

export class MCPManager {
  private client?: MCPClient;
  private currentInstance?: PluginInstance;
  private autoReconnect = true;
  private connectionAttempts = 0;
  private maxAttempts = 3;

  /**
   * Auto-connect to best available plugin instance
   */
  async autoConnect(): Promise<boolean> {
    const instance = getBestPluginInstance();

    if (!instance) {
      // Silently fail - no console spam
      return false;
    }

    return await this.connectToInstance(instance);
  }

  /**
   * Connect to specific plugin instance
   */
  async connectToInstance(instance: PluginInstance): Promise<boolean> {
    try {
      this.currentInstance = instance;

      // Silently connect - no console spam

      // Create WebSocket with auth headers
      const ws = new WebSocket(getWebSocketUrl(instance), {
        headers: getAuthHeaders(instance),
      });

      // Wrap in promise to handle connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Create MCP client with authenticated WebSocket
      this.client = new MCPClient({
        url: getWebSocketUrl(instance),
        reconnect: this.autoReconnect,
        debug: false,
      });

      // Override the WebSocket creation to use our authenticated one
      (this.client as any).ws = ws;
      (this.client as any).isConnected = true;

      // Initialize MCP protocol
      await this.client.initialize({
        name: 'nexus-cli',
        version: '0.1.0',
      });

      // Start ping
      this.client.startPingInterval(30000);

      // Silently succeeded - no console spam

      this.connectionAttempts = 0;
      return true;

    } catch (error: any) {
      // Silently fail - no console spam

      this.connectionAttempts++;
      if (this.connectionAttempts < this.maxAttempts && this.autoReconnect) {
        // Retry silently
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await this.connectToInstance(instance);
      }

      return false;
    }
  }

  /**
   * Disconnect from plugin
   */
  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = undefined;
    }
    this.currentInstance = undefined;
  }

  /**
   * Check if connected and ready
   */
  isReady(): boolean {
    return this.client?.isReady() ?? false;
  }

  /**
   * Get MCP client
   */
  getClient(): MCPClient | undefined {
    return this.client;
  }

  /**
   * Get current instance info
   */
  getCurrentInstance(): PluginInstance | undefined {
    return this.currentInstance;
  }

  /**
   * List all available plugin instances
   */
  listInstances(): PluginInstance[] {
    return discoverPluginInstances();
  }

  /**
   * Get project context summary
   */
  async getContextSummary(): Promise<string> {
    if (!this.client) throw new Error('Not connected');

    const result = await this.client.callTool('context_get_summary');
    return result.content[0]?.text || '';
  }

  /**
   * Find relevant files for a query
   */
  async findRelevantFiles(query: string, currentFiles: string[] = []): Promise<string> {
    if (!this.client) throw new Error('Not connected');

    const result = await this.client.callTool('context_find_relevant', {
      query,
      current_files: currentFiles,
    });
    return result.content[0]?.text || '';
  }

  /**
   * Analyze a specific file
   */
  async analyzeFile(filePath: string): Promise<string> {
    if (!this.client) throw new Error('Not connected');

    const result = await this.client.callTool('context_analyze_file', {
      file_path: filePath,
    });
    return result.content[0]?.text || '';
  }

  /**
   * Get suggestions
   */
  async getSuggestions(): Promise<string> {
    if (!this.client) throw new Error('Not connected');

    const result = await this.client.callTool('context_suggest');
    return result.content[0]?.text || '';
  }
}

// Singleton instance
let mcpManagerInstance: MCPManager | undefined;

export function getMCPManager(): MCPManager {
  if (!mcpManagerInstance) {
    mcpManagerInstance = new MCPManager();
  }
  return mcpManagerInstance;
}
