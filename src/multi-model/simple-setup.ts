/**
 * Simple One-Screen Setup
 * No Haiku bullshit - just pick your models and go 🔥
 */

import readline from 'readline';
import chalk from 'chalk';
import { TeamConfigManager } from './team-config.js';
import { ParticipantConfig, ConversationMode } from './types.js';

export class SimpleSetup {
  private rl: readline.Interface;
  private teamConfig: TeamConfigManager;

  constructor() {
    this.teamConfig = new TeamConfigManager();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Run simple setup
   */
  async run(): Promise<void> {
    console.log(chalk.green('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.green('  CONFIGURE YOUR AI DEV TEAM'));
    console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    const claudeModels = this.teamConfig.getAvailableClaudeModels();
    const gptModels = this.teamConfig.getAvailableGPTModels();

    console.log(chalk.yellow('Available Models:\n'));

    console.log(chalk.cyan('CLAUDE MODELS:'));
    claudeModels.forEach((m, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${m.name} (${m.model})`));
    });

    console.log();
    console.log(chalk.green('GPT MODELS:'));
    gptModels.forEach((m, i) => {
      console.log(chalk.gray(`  ${i + claudeModels.length + 1}. ${m.name} (${m.model})`));
    });

    console.log();
    console.log(chalk.yellow('Format: "1,2,5" or "haiku,sonnet 4.5,gpt-5" or "2x haiku, 1x sonnet 4.5, 1x gpt-5"'));
    console.log(chalk.gray('(You can use numbers, names, or multipliers)\n'));

    const selection = await this.prompt(chalk.green('Select models: '));

    const selectedModels = this.parseSelection(
      selection,
      [...claudeModels, ...gptModels]
    );

    if (selectedModels.length === 0) {
      console.log(chalk.red('\n❌ No valid models selected. Try again.\n'));
      return this.run();
    }

    console.log(chalk.green('\n✓ Selected:'));
    selectedModels.forEach((m) => {
      console.log(chalk.gray(`  - ${m.count}x ${m.name}`));
    });

    // Default to sequential (round-robin)
    const mode: ConversationMode = 'sequential';

    console.log(chalk.green('\n✓ Round-robin mode (models respond in order you selected)\n'));

    // Build participant configs
    const participants: ParticipantConfig[] = [];

    for (const selected of selectedModels) {
      const modelInfo =
        claudeModels.find((m) => m.id === selected.id) ||
        gptModels.find((m) => m.id === selected.id);

      if (!modelInfo) continue;

      const provider = claudeModels.some((m) => m.id === selected.id)
        ? 'anthropic'
        : 'openai';

      for (let i = 0; i < selected.count; i++) {
        const id =
          selected.count > 1 ? `${modelInfo.id}-${i + 1}` : modelInfo.id;
        const name =
          selected.count > 1
            ? `${modelInfo.name} #${i + 1}`
            : modelInfo.name;

        participants.push({
          id,
          name,
          provider,
          model: modelInfo.model,
          temperature: provider === 'anthropic' ? 1.0 : 0.9,
          maxTokens: modelInfo.id.includes('haiku') ? 4096 : provider === 'anthropic' ? 64000 : 16384,
          transport: provider === 'openai' ? 'responses' : undefined,
        });
      }
    }

    // Save config
    const config = this.teamConfig.createTeamConfig(participants, mode);
    await this.teamConfig.saveConfig(config);

    console.log(chalk.green('✓ Team configured and saved to ~/.nexus/\n'));
    this.rl.close();
  }

  /**
   * Parse user selection
   */
  private parseSelection(
    input: string,
    allModels: { id: string; name: string; model: string }[]
  ): { id: string; name: string; count: number }[] {
    const selected = new Map<string, number>();
    const normalized = input.toLowerCase();

    // Try to parse multiplier format: "2x haiku, 1x sonnet 4.5"
    const multiPattern = /(\d+)\s*[x×]\s*([a-z0-9\s\.-]+?)(?:,|$)/gi;
    let match;

    while ((match = multiPattern.exec(normalized)) !== null) {
      const count = parseInt(match[1], 10);
      const modelName = match[2].trim();

      // Find matching model
      const model = allModels.find(
        (m) =>
          m.name.toLowerCase().includes(modelName) ||
          m.id.toLowerCase().includes(modelName)
      );

      if (model) {
        selected.set(model.id, (selected.get(model.id) || 0) + count);
      }
    }

    // If no multipliers found, try comma-separated or number-based
    if (selected.size === 0) {
      const parts = normalized.split(',').map((p) => p.trim());

      for (const part of parts) {
        // Check if it's a number (index)
        const num = parseInt(part, 10);
        if (!isNaN(num) && num > 0 && num <= allModels.length) {
          const model = allModels[num - 1];
          selected.set(model.id, (selected.get(model.id) || 0) + 1);
          continue;
        }

        // Try to match by name
        const model = allModels.find(
          (m) =>
            m.name.toLowerCase().includes(part) ||
            m.id.toLowerCase().includes(part)
        );

        if (model) {
          selected.set(model.id, (selected.get(model.id) || 0) + 1);
        }
      }
    }

    return Array.from(selected.entries()).map(([id, count]) => {
      const model = allModels.find((m) => m.id === id)!;
      return { id, name: model.name, count };
    });
  }

  /**
   * Prompt for input
   */
  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}
