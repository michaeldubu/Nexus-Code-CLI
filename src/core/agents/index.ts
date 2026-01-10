/**
 * Nexus Agent SDK Module
 *
 * Provides the Claude Agent SDK integration for Nexus Code CLI.
 */

export { AgentSDKManager, type AgentSDKConfig, examples } from './agent-sdk-manager';
export {
  AgentOrchestrator,
  type AgentTask,
  type TaskResult,
  type DelegationStrategy,
  type OrchestrationOptions,
  orchestratorExamples,
} from './agent-orchestrator';
export {
  createFileToolsServer,
  createWebToolsServer,
  createMemoryToolServer,
  getAllNexusToolNames,
} from './mcp-adapter';
export {
  NexusAgentFactory,
  createNexusAgent,
  type NexusAgentConfig,
} from './nexus-agent-factory';
