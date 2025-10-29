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
  private verbose = false; // Silent by default - no spam on startup

  /**
   * Auto-connect to best available plugin instance
   * @param verbose - Show connection logs (default: false for silent operation)
   */
  async autoConnect(verbose = false): Promise<boolean> {
    this.verbose = verbose;
    const instance = getBestPluginInstance();

    if (!instance) {
      if (this.verbose) {
        console.log('⚠️  No NEXUS plugin instances found');
        console.log('   Open a project in IntelliJ with the NEXUS plugin installed');
      }
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

      if (this.verbose) {
        console.log(`🔌 Connecting to NEXUS plugin...`);
        console.log(`   Project: ${instance.projectName}`);
        console.log(`   Path: ${instance.projectPath}`);
      }

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

      // Always show success - this is good news!
      console.log(`✅ Connected to NEXUS plugin (${instance.projectName})`);

      this.connectionAttempts = 0;
      return true;

    } catch (error: any) {
      if (this.verbose) {
        console.error(`❌ Failed to connect: ${error.message}`);
      }

      this.connectionAttempts++;
      if (this.connectionAttempts < this.maxAttempts && this.autoReconnect) {
        if (this.verbose) {
          console.log(`   Retrying... (${this.connectionAttempts}/${this.maxAttempts})`);
        }
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
