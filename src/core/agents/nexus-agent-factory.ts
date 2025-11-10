/**
 * Nexus Agent Factory
 *
 * Factory for creating Agent SDK instances configured with Nexus tools.
 * This integrates the Agent SDK with the existing Nexus ecosystem.
 */

import { AgentSDKManager, AgentSDKConfig } from './agent-sdk-manager';
import {
  createFileToolsServer,
  createWebToolsServer,
  createMemoryToolServer,
  getAllNexusToolNames,
} from './mcp-adapter';
import type { FileTools } from '../tools/file-tools.js';
import type { WebTools } from '../tools/web-tools.js';
import type { MemoryTool } from '../tools/memory-tool.js';
import type { QueryOptions } from '@anthropic-ai/claude-agent-sdk';

/**
 * Nexus Agent Configuration
 */
export interface NexusAgentConfig extends AgentSDKConfig {
  fileTools?: FileTools;
  webTools?: WebTools;
  memoryTool?: MemoryTool;
  useNexusTools?: boolean;
}

/**
 * Nexus Agent Factory
 *
 * Creates Agent SDK instances integrated with Nexus tools and systems.
 */
export class NexusAgentFactory {
  private fileTools?: FileTools;
  private webTools?: WebTools;
  private memoryTool?: MemoryTool;

  constructor(
    fileTools?: FileTools,
    webTools?: WebTools,
    memoryTool?: MemoryTool
  ) {
    this.fileTools = fileTools;
    this.webTools = webTools;
    this.memoryTool = memoryTool;
  }

  /**
   * Create an Agent SDK Manager with Nexus tools integrated
   */
  createAgent(config: NexusAgentConfig = {}): AgentSDKManager {
    const {
      fileTools = this.fileTools,
      webTools = this.webTools,
      memoryTool = this.memoryTool,
      useNexusTools = true,
      ...sdkConfig
    } = config;

    // Create base Agent SDK Manager
    const agent = new AgentSDKManager(sdkConfig);

    // If Nexus tools are enabled and available, we'll need to override executeQuery
    // to add the MCP servers. We'll do this by extending the agent.
    if (useNexusTools) {
      const originalExecuteQuery = agent.executeQuery.bind(agent);

      // Override executeQuery to add Nexus MCP servers
      agent.executeQuery = async (userPrompt: string, options?: Partial<QueryOptions>) => {
        const mcpServers: any = {};
        const allowedTools: string[] = [
          'Read',
          'Write',
          'Edit',
          'Grep',
          'Glob',
          'Bash',
          'Task',
        ];

        // Add Nexus file tools if available
        if (fileTools) {
          mcpServers['nexus-file-tools'] = createFileToolsServer(fileTools);
        }

        // Add Nexus web tools if available
        if (webTools) {
          mcpServers['nexus-web-tools'] = createWebToolsServer(webTools);
        }

        // Add Nexus memory tool if available
        if (memoryTool) {
          mcpServers['nexus-memory-tool'] = createMemoryToolServer(memoryTool);
        }

        // Add all Nexus tool names to allowed tools
        allowedTools.push(...getAllNexusToolNames());

        // Merge with any existing options
        const enhancedOptions: Partial<QueryOptions> = {
          ...options,
          mcpServers: {
            ...(options?.mcpServers || {}),
            ...mcpServers,
          },
          allowedTools: [
            ...(options?.allowedTools || []),
            ...allowedTools,
          ],
        };

        return originalExecuteQuery(userPrompt, enhancedOptions);
      };
    }

    return agent;
  }

  /**
   * Create a code review agent
   */
  createCodeReviewer(config: NexusAgentConfig = {}): AgentSDKManager {
    return this.createAgent({
      ...config,
      enableSubagents: true,
    });
  }

  /**
   * Create a test generation agent
   */
  createTestGenerator(config: NexusAgentConfig = {}): AgentSDKManager {
    return this.createAgent({
      ...config,
      enableSubagents: true,
    });
  }

  /**
   * Create a documentation writer agent
   */
  createDocumentationWriter(config: NexusAgentConfig = {}): AgentSDKManager {
    return this.createAgent({
      ...config,
      enableSubagents: true,
    });
  }

  /**
   * Create an architect agent
   */
  createArchitect(config: NexusAgentConfig = {}): AgentSDKManager {
    return this.createAgent({
      ...config,
      enableSubagents: true,
      model: 'claude-opus-4-20250514', // Use Opus for architecture tasks
    });
  }

  /**
   * Create a security auditor agent
   */
  createSecurityAuditor(config: NexusAgentConfig = {}): AgentSDKManager {
    return this.createAgent({
      ...config,
      enableSubagents: true,
    });
  }
}

/**
 * Quick factory function for creating a Nexus-integrated agent
 */
export function createNexusAgent(
  fileTools?: FileTools,
  webTools?: WebTools,
  memoryTool?: MemoryTool,
  config: NexusAgentConfig = {}
): AgentSDKManager {
  const factory = new NexusAgentFactory(fileTools, webTools, memoryTool);
  return factory.createAgent(config);
}

export default NexusAgentFactory;
