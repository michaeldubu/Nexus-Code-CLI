/**
 * Model Pool - Manage Multiple Model Instances
 * Enables running N instances of the SAME model in parallel
 *
 * Example:
 * - 5x Claude Sonnet-4.5
 * - 10x Haiku-4.5
 * - 3x GPT-5
 * ALL running in parallel, ALL receiving the same message
 */

import { UnifiedModelManager, ModelConfig, AVAILABLE_MODELS, Message, StreamChunk } from './unified-model-manager.js';
import { v4 as uuidv4 } from 'uuid';

export interface ModelInstanceConfig {
  /**
   * Model ID (e.g., "claude-sonnet-4-5-20250929")
   */
  modelId: string;

  /**
   * Instance name (user-friendly, e.g., "Sonnet #1", "Debugger Haiku")
   */
  name?: string;

  /**
   * Instance-specific system prompt overlay
   */
  systemPromptOverlay?: string;

  /**
   * Instance-specific settings
   */
  temperature?: number;
  thinkingEnabled?: boolean;
  interleavedThinkingEnabled?: boolean;
}

export interface ModelInstance {
  /**
   * Unique instance ID (UUID)
   */
  id: string;

  /**
   * Model ID (type)
   */
  modelId: string;

  /**
   * Instance name (user-friendly)
   */
  name: string;

  /**
   * Model configuration
   */
  config: ModelConfig;

  /**
   * Instance-specific config
   */
  instanceConfig: ModelInstanceConfig;

  /**
   * Isolated model manager for this instance
   */
  manager: UnifiedModelManager;

  /**
   * Conversation history for this instance
   */
  conversationHistory: Message[];

  /**
   * Creation timestamp
   */
  createdAt: Date;
}

export class ModelPool {
  private instances: Map<string, ModelInstance> = new Map();
  private anthropicKey?: string;
  private openaiKey?: string;
  private googleKey?: string;
  private ollamaHost?: string;

  constructor(
    anthropicKey?: string,
    openaiKey?: string,
    googleKey?: string,
    ollamaHost?: string
  ) {
    this.anthropicKey = anthropicKey;
    this.openaiKey = openaiKey;
    this.googleKey = googleKey;
    this.ollamaHost = ollamaHost;
  }

  /**
   * Add a new model instance to the pool
   * Returns the instance ID
   */
  addInstance(config: ModelInstanceConfig): string {
    const modelId = config.modelId;

    // Validate model exists
    if (!AVAILABLE_MODELS[modelId]) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const modelConfig = AVAILABLE_MODELS[modelId];

    // Create isolated manager for this instance
    const manager = new UnifiedModelManager(
      this.anthropicKey,
      this.openaiKey,
      this.googleKey,
      this.ollamaHost,
      modelId
    );

    // Apply instance-specific thinking settings
    if (config.thinkingEnabled !== undefined && modelConfig.supportsThinking) {
      if (!config.thinkingEnabled && manager.isThinkingEnabled()) {
        manager.toggleThinking();
      } else if (config.thinkingEnabled && !manager.isThinkingEnabled()) {
        manager.toggleThinking();
      }
    }

    if (config.interleavedThinkingEnabled !== undefined && modelConfig.supportsInterleavedThinking) {
      if (!config.interleavedThinkingEnabled && manager.isInterleavedThinkingEnabled()) {
        manager.toggleInterleavedThinking();
      } else if (config.interleavedThinkingEnabled && !manager.isInterleavedThinkingEnabled()) {
        manager.toggleInterleavedThinking();
      }
    }

    // Generate unique instance ID
    const instanceId = uuidv4();

    // Generate instance name
    const instanceCount = Array.from(this.instances.values())
      .filter(inst => inst.modelId === modelId)
      .length + 1;

    const name = config.name || `${modelConfig.name} #${instanceCount}`;

    const instance: ModelInstance = {
      id: instanceId,
      modelId,
      name,
      config: modelConfig,
      instanceConfig: config,
      manager,
      conversationHistory: [],
      createdAt: new Date(),
    };

    this.instances.set(instanceId, instance);

    return instanceId;
  }

  /**
   * Remove an instance from the pool
   */
  removeInstance(instanceId: string): boolean {
    return this.instances.delete(instanceId);
  }

  /**
   * Get an instance by ID
   */
  getInstance(instanceId: string): ModelInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Get all instances
   */
  getAllInstances(): ModelInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get instances by model ID
   */
  getInstancesByModel(modelId: string): ModelInstance[] {
    return Array.from(this.instances.values())
      .filter(inst => inst.modelId === modelId);
  }

  /**
   * Clear all instances
   */
  clearAll(): void {
    this.instances.clear();
  }

  /**
   * Get instance count
   */
  getInstanceCount(): number {
    return this.instances.size;
  }

  /**
   * Stream message to a specific instance
   */
  async *streamToInstance(
    instanceId: string,
    message: Message,
    systemPrompt: string,
    tools?: any[]
  ): AsyncGenerator<{
    instanceId: string;
    instanceName: string;
    modelId: string;
    chunk: StreamChunk;
  }> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    // Add instance-specific system prompt overlay
    let fullSystemPrompt = systemPrompt;
    if (instance.instanceConfig.systemPromptOverlay) {
      fullSystemPrompt += '\n\n' + instance.instanceConfig.systemPromptOverlay;
    }

    // Add message to instance history
    instance.conversationHistory.push(message);

    // Stream from instance's isolated manager
    for await (const chunk of instance.manager.streamMessage(
      instance.conversationHistory,
      {
        systemPrompt: fullSystemPrompt,
        tools,
        temperature: instance.instanceConfig.temperature,
      }
    )) {
      yield {
        instanceId: instance.id,
        instanceName: instance.name,
        modelId: instance.modelId,
        chunk,
      };
    }
  }

  /**
   * Stream message to ALL instances in parallel
   * Returns interleaved chunks from all instances
   */
  async *streamToAll(
    message: Message,
    systemPrompt: string,
    tools?: any[]
  ): AsyncGenerator<{
    instanceId: string;
    instanceName: string;
    modelId: string;
    chunk: StreamChunk;
  }> {
    const instanceIds = Array.from(this.instances.keys());
    yield* this.streamToMany(instanceIds, message, systemPrompt, tools);
  }

  /**
   * Stream message to SPECIFIC instances in parallel
   * Returns interleaved chunks from all specified instances
   */
  async *streamToMany(
    instanceIds: string[],
    message: Message,
    systemPrompt: string,
    tools?: any[]
  ): AsyncGenerator<{
    instanceId: string;
    instanceName: string;
    modelId: string;
    chunk: StreamChunk;
  }> {
    // Create separate streams for each instance
    const streams = instanceIds.map(instanceId => {
      return this.streamToInstance(instanceId, message, systemPrompt, tools);
    });

    // Interleave streams using Promise.race pattern
    const activeStreams = new Map(streams.map((stream, idx) => [instanceIds[idx], stream]));

    while (activeStreams.size > 0) {
      // Create promises for next chunk from each active stream
      const promises = Array.from(activeStreams.entries()).map(async ([instanceId, stream]) => {
        const result = await stream.next();
        return { instanceId, result, stream };
      });

      // Wait for first chunk from any stream
      const { instanceId, result, stream } = await Promise.race(promises);

      if (result.done) {
        // Remove completed stream
        activeStreams.delete(instanceId);
      } else {
        // Yield the chunk
        yield result.value;

        // Update the stream reference (generator continues)
        activeStreams.set(instanceId, stream);
      }
    }
  }

  /**
   * Add assistant message to instance history
   */
  addAssistantMessage(instanceId: string, message: Message): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.conversationHistory.push(message);
    }
  }

  /**
   * Clear conversation history for an instance
   */
  clearInstanceHistory(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.conversationHistory = [];
      instance.manager.resetConversation();
    }
  }

  /**
   * Clear conversation history for all instances
   */
  clearAllHistory(): void {
    for (const instance of this.instances.values()) {
      instance.conversationHistory = [];
      instance.manager.resetConversation();
    }
  }

  /**
   * Get summary of pool state
   */
  getSummary(): string {
    const lines: string[] = [
      '🎯 MODEL POOL SUMMARY',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `Total Instances: ${this.instances.size}`,
      '',
    ];

    // Group by model ID
    const byModel = new Map<string, ModelInstance[]>();
    for (const instance of this.instances.values()) {
      if (!byModel.has(instance.modelId)) {
        byModel.set(instance.modelId, []);
      }
      byModel.get(instance.modelId)!.push(instance);
    }

    for (const [modelId, instances] of byModel) {
      const modelConfig = AVAILABLE_MODELS[modelId];
      lines.push(`${modelConfig.name}: ${instances.length} instance(s)`);
      for (const inst of instances) {
        lines.push(`  • ${inst.name} [${inst.id.slice(0, 8)}]`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export pool state to JSON
   */
  exportState(): any {
    return {
      instances: Array.from(this.instances.entries()).map(([id, inst]) => ({
        id,
        modelId: inst.modelId,
        name: inst.name,
        instanceConfig: inst.instanceConfig,
        conversationHistory: inst.conversationHistory,
        createdAt: inst.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Import pool state from JSON
   */
  importState(state: any): void {
    this.clearAll();

    for (const instData of state.instances) {
      const instanceId = this.addInstance(instData.instanceConfig);
      const instance = this.instances.get(instanceId);
      if (instance) {
        // Restore ID and history
        this.instances.delete(instanceId);
        instance.id = instData.id;
        instance.conversationHistory = instData.conversationHistory;
        this.instances.set(instData.id, instance);
      }
    }
  }
}
