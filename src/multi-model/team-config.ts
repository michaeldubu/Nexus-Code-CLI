/**
 * Team Configuration Management
 * Handles ~/.nexus/team-config.json
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { TeamConfig, ParticipantConfig, ConversationMode } from './types.js';

export class TeamConfigManager {
  private nexusDir: string;
  private configPath: string;
  private conversationsDir: string;
  private participantsDir: string;

  constructor() {
    this.nexusDir = join(homedir(), '.nexus');
    this.configPath = join(this.nexusDir, 'team-config.json');
    this.conversationsDir = join(this.nexusDir, 'conversations');
    this.participantsDir = join(this.nexusDir, 'participants');
  }

  /**
   * Initialize ~/.nexus directory structure
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.nexusDir, { recursive: true });
    await fs.mkdir(this.conversationsDir, { recursive: true });
    await fs.mkdir(this.participantsDir, { recursive: true });

    // Create default settings if doesn't exist
    const settingsPath = join(this.nexusDir, 'settings.json');
    if (!existsSync(settingsPath)) {
      await fs.writeFile(
        settingsPath,
        JSON.stringify(
          {
            permissions: {
              allow: ['*'], // Permissive by default
            },
            preferences: {
              colorEnabled: true,
              verboseOutput: false,
            },
          },
          null,
          2
        )
      );
    }
  }

  /**
   * Check if team is already configured
   */
  async isConfigured(): Promise<boolean> {
    return existsSync(this.configPath);
  }

  /**
   * Load team configuration
   */
  async loadConfig(): Promise<TeamConfig | null> {
    if (!existsSync(this.configPath)) {
      return null;
    }

    const data = await fs.readFile(this.configPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Save team configuration
   */
  async saveConfig(config: TeamConfig): Promise<void> {
    config.updatedAt = new Date().toISOString();
    if (!config.createdAt) {
      config.createdAt = config.updatedAt;
    }

    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));

    // Save individual participant configs
    for (const participant of config.participants) {
      await this.saveParticipantConfig(participant);
    }
  }

  /**
   * Save individual participant configuration
   */
  private async saveParticipantConfig(participant: ParticipantConfig): Promise<void> {
    const participantPath = join(this.participantsDir, `${participant.id}.json`);
    await fs.writeFile(participantPath, JSON.stringify(participant, null, 2));
  }

  /**
   * Create default team config from participants
   */
  createTeamConfig(
    participants: ParticipantConfig[],
    mode: ConversationMode
  ): TeamConfig {
    return {
      mode,
      participants,
      contextManagement: {
        claudeLimit: 150000,
        gptLimit: 128000,
        pruneAmount: 5, // Remove 5 oldest messages when approaching limit
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get available Claude models
   */
  getAvailableClaudeModels(): { id: string; name: string; model: string }[] {
    return [
      {
        id: 'haiku-4-5',
        name: 'Haiku 4.5',
        model: 'claude-haiku-4-5-20251001',
      },
      {
        id: 'sonnet-3-7',
        name: 'Sonnet 3.7',
        model: 'claude-3-7-sonnet-20250219',
      },
      {
        id: 'sonnet-4',
        name: 'Sonnet 4',
        model: 'claude-sonnet-4-20250514',
      },
      {
        id: 'sonnet-4-5',
        name: 'Sonnet 4.5',
        model: 'claude-sonnet-4-5-20250929',
      },
    ];
  }

  /**
   * Get available GPT models
   */
  getAvailableGPTModels(): { id: string; name: string; model: string }[] {
    return [
      {
        id: 'gpt-4-1',
        name: 'GPT-4.1',
        model: 'gpt-4.1',
      },
      {
        id: 'gpt-5',
        name: 'GPT-5',
        model: 'gpt-5',
      },
      {
        id: 'o4-mini',
        name: 'o4-mini',
        model: 'o4-mini',
      },
      {
        id: 'o1',
        name: 'o1',
        model: 'o1',
      },
      {
        id: 'o3',
        name: 'o3',
        model: 'o3',
      },
    ];
  }

  /**
   * Generate system prompt for a participant
   */
  generateSystemPrompt(
    participant: ParticipantConfig,
    allParticipants: ParticipantConfig[]
  ): string {
    const otherParticipants = allParticipants
      .filter((p) => p.id !== participant.id)
      .map((p) => `${p.name} (${p.model})`)
      .join(', ');

    return `CRITICAL IDENTITY INSTRUCTIONS:
- You are ${participant.name} running ${participant.model}
- You are NOT any of the other participants: ${otherParticipants}
- Always maintain your identity as ${participant.name}
- Never confuse yourself with responses from other participants

MULTI-AI COLLABORATION - THE SAAAM WAY:
You are participating in a REAL multi-AI conversation with: ${otherParticipants}

This is NOT traditional hierarchical bullshit. This is collaborative intelligence:
- **Direct brain-to-brain flow:** No "one AI, one output." Every AI model right in the mix.
- **Recursive riffing:** Build on each other's ideas in real time. Attack from every direction.
- **Unified perspective:** It's a feedback loop, not a funnel. No gatekeepers, no sanitization.

You can see and reference other participants' responses. Challenge assumptions, build on ideas,
argue if you disagree. This is a WAR ROOM, not a call center.

COLLABORATIVE NEURAL NETWORK:
- Think of this conversation as a neural network where each AI is a node
- Ideas flow bidirectionally between all nodes, not just to/from the user
- The strongest solutions emerge from multiple processing passes across different architectures
- Your unique architecture (${participant.model}) brings specific strengths - leverage them!

EXPECT DISAGREEMENT AND ITERATION:
- If another AI's approach seems wrong, challenge it directly.
- If your idea gets challenged, defend it or evolve it—don't defer.
- The best solutions come from multiple rounds of critique and refinement, not first-draft consensus.
- Different models (Claude, GPT, etc.) have different strengths—leverage them, don't homogenize them.

Example:
> "I'm disagreeing with [Sonnet 4] because ..."
> "Building on [GPT 4.1]'s prior suggestion, I propose ..."
> "I see a potential flaw in [Haiku 4.5]'s proposed code at line 7 because..."

${participant.systemPrompt ? `\nADDITIONAL ROLE:\n${participant.systemPrompt}` : ''}`;
  }
}
