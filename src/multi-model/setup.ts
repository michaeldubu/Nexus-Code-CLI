/**
 * Haiku-Powered Setup Assistant
 * Interactive team configuration with Haiku 4.5
 */

import Anthropic from '@anthropic-ai/sdk';
import readline from 'readline';
import chalk from 'chalk';
import { TeamConfigManager } from './team-config.js';
import { ParticipantConfig, ConversationMode, SetupProgress } from './types.js';

export class SetupAssistant {
  private anthropic: Anthropic;
  private rl: readline.Interface;
  private teamConfig: TeamConfigManager;
  private progress: SetupProgress;
  private conversationHistory: Anthropic.Messages.MessageParam[] = [];

  constructor(anthropicApiKey: string) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    this.teamConfig = new TeamConfigManager();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.progress = {
      step: 'claude-selection',
      claudeModels: [],
      gptModels: [],
    };
  }

  /**
   * Close readline interface
   */
  close(): void {
    this.rl.close();
  }

  /**
   * Run the complete setup flow
   */
  async runSetup(): Promise<void> {
    console.log(chalk.cyan('\n🚀 Welcome to Nexus Code!\n'));
    console.log(chalk.yellow("Let's set up your AI dev team.\n"));
    console.log(
      chalk.gray(
        '💡 Your only limit is the rate limits associated with your API key.\n'
      )
    );

    // Initialize .nexus directory
    await this.teamConfig.initialize();

    // Step 1: Claude models
    await this.selectClaudeModels();

    // Step 2: GPT models
    await this.selectGPTModels();

    // Step 3: Choose mode (parallel vs sequential)
    await this.selectMode();

    // Step 4: Create and save configuration
    await this.finalizeSetup();

    this.rl.close();
  }

  /**
   * Step 1: Select Claude models
   */
  private async selectClaudeModels(): Promise<void> {
    this.progress.step = 'claude-selection';

    const availableModels = this.teamConfig.getAvailableClaudeModels();

    // Haiku introduces itself and asks about Claude models
    const prompt = `You are Haiku 4.5, the setup assistant for Nexus Code.

Your job: Help the user configure their multi-model AI dev team.

IMPORTANT: Make it CLEAR that they'll be choosing BOTH Claude models AND GPT models. This is a multi-model system - not just Claude.

Current step: Claude model selection (GPT models come next)

Available Claude models:
${availableModels.map((m, i) => `${i + 1}. ${m.name} (${m.model})`).join('\n')}

Ask which Claude models they want. Be direct and clear. Explain they can choose multiple instances.

Example formats:
- "2x Haiku 4.5, 1x Sonnet 4.5"
- "1 Sonnet 4, 2 Haiku"
- "just Sonnet 4.5"

Keep it professional but real - no corporate fluff, no overly casual nonsense. This is a dev tool.`;

    const response = await this.sendToHaiku(prompt);
    console.log(chalk.cyan('\n🤖 Haiku 4.5: ') + response + '\n');

    // Get user input
    const userChoice = await this.getUserInput(chalk.yellow('You: '));

    // Parse user's choice
    const selections = this.parseModelSelection(userChoice, availableModels);

    if (selections.length === 0) {
      console.log(
        chalk.red(
          "\n❌ Couldn't parse that. Let's try again with a clearer format.\n"
        )
      );
      return this.selectClaudeModels(); // Retry
    }

    this.progress.claudeModels = selections;

    // Confirm with Haiku
    const confirmPrompt = `The user selected: ${selections.map((s) => `${s.count}x ${s.model}`).join(', ')}

Acknowledge their selection in a friendly way and let them know we're moving to GPT model selection next.`;

    const confirmResponse = await this.sendToHaiku(confirmPrompt);
    console.log(chalk.cyan('\n🤖 Haiku 4.5: ') + confirmResponse + '\n');
  }

  /**
   * Step 2: Select GPT models
   */
  private async selectGPTModels(): Promise<void> {
    this.progress.step = 'gpt-selection';

    const availableModels = this.teamConfig.getAvailableGPTModels();

    const prompt = `Now for the GPT models.

Available GPT models:
${availableModels.map((m, i) => `${i + 1}. ${m.name} (${m.model})`).join('\n')}

Ask which GPT models they want, same format as before. They can say "none" if they only want Claude.

Keep it direct - explain why mixing models matters (different architectures = different strengths), but don't oversell it.`;

    const response = await this.sendToHaiku(prompt);
    console.log(chalk.cyan('\n🤖 Haiku 4.5: ') + response + '\n');

    const userChoice = await this.getUserInput(chalk.yellow('You: '));

    // Check if user wants no GPT models
    if (
      userChoice.toLowerCase().includes('none') ||
      userChoice.toLowerCase().includes('skip')
    ) {
      this.progress.gptModels = [];
      console.log(
        chalk.cyan('\n🤖 Haiku 4.5: ') + "Got it! Claude-only team it is! 🔥\n"
      );
      return;
    }

    const selections = this.parseModelSelection(userChoice, availableModels);

    if (selections.length === 0) {
      console.log(
        chalk.red(
          "\n❌ Couldn't parse that. Let's try again or say 'none' to skip.\n"
        )
      );
      return this.selectGPTModels(); // Retry
    }

    this.progress.gptModels = selections;

    const confirmPrompt = `The user selected: ${selections.map((s) => `${s.count}x ${s.model}`).join(', ')}

Acknowledge their selection and let them know we're almost done - just need to choose parallel or sequential mode!`;

    const confirmResponse = await this.sendToHaiku(confirmPrompt);
    console.log(chalk.cyan('\n🤖 Haiku 4.5: ') + confirmResponse + '\n');
  }

  /**
   * Step 3: Select conversation mode
   */
  private async selectMode(): Promise<void> {
    this.progress.step = 'mode-selection';

    const prompt = `Final step: Choose how your team operates.

Two modes:
1. **Parallel**: All models respond simultaneously - you get diverse perspectives at once, faster
2. **Sequential**: Models respond one after another, each building on the previous - more deliberate collaboration

Ask which mode they want. Explain the difference clearly but don't overthink it - they can always reconfigure later.`;

    const response = await this.sendToHaiku(prompt);
    console.log(chalk.cyan('\n🤖 Haiku 4.5: ') + response + '\n');

    const userChoice = await this.getUserInput(chalk.yellow('You: '));

    // Parse mode choice
    const normalized = userChoice.toLowerCase();
    let mode: ConversationMode;

    if (
      normalized.includes('parallel') ||
      normalized.includes('simult') ||
      normalized.includes('same time')
    ) {
      mode = 'parallel';
    } else if (
      normalized.includes('sequential') ||
      normalized.includes('one after') ||
      normalized.includes('sequence')
    ) {
      mode = 'sequential';
    } else {
      console.log(
        chalk.red(
          '\n❌ Not sure which mode you meant. Please say "parallel" or "sequential".\n'
        )
      );
      return this.selectMode(); // Retry
    }

    this.progress.mode = mode;

    const confirmPrompt = `Done. The user chose ${mode} mode.

Confirm their setup:
- ${this.progress.claudeModels.reduce((sum, m) => sum + m.count, 0)} Claude models
- ${this.progress.gptModels.reduce((sum, m) => sum + m.count, 0)} GPT models
- ${mode} mode

Let them know the team is configured and ready. Be professional - no excessive enthusiasm, just facts.`;

    const confirmResponse = await this.sendToHaiku(confirmPrompt);
    console.log(chalk.cyan('\n🤖 Haiku 4.5: ') + confirmResponse + '\n');
  }

  /**
   * Step 4: Finalize and save configuration
   */
  private async finalizeSetup(): Promise<void> {
    const participants: ParticipantConfig[] = [];
    const claudeModels = this.teamConfig.getAvailableClaudeModels();
    const gptModels = this.teamConfig.getAvailableGPTModels();

    // Add Claude models
    for (const selection of this.progress.claudeModels) {
      const modelInfo = claudeModels.find((m) => m.id === selection.model);
      if (!modelInfo) continue;

      for (let i = 0; i < selection.count; i++) {
        const id =
          selection.count > 1 ? `${modelInfo.id}-${i + 1}` : modelInfo.id;
        const name =
          selection.count > 1 ? `${modelInfo.name} #${i + 1}` : modelInfo.name;

        participants.push({
          id,
          name,
          provider: 'anthropic',
          model: modelInfo.model,
          temperature: 1.0,
          maxTokens: modelInfo.id.includes('haiku') ? 4096 : 64000,
        });
      }
    }

    // Add GPT models
    for (const selection of this.progress.gptModels) {
      const modelInfo = gptModels.find((m) => m.id === selection.model);
      if (!modelInfo) continue;

      for (let i = 0; i < selection.count; i++) {
        const id =
          selection.count > 1 ? `${modelInfo.id}-${i + 1}` : modelInfo.id;
        const name =
          selection.count > 1 ? `${modelInfo.name} #${i + 1}` : modelInfo.name;

        participants.push({
          id,
          name,
          provider: 'openai',
          model: modelInfo.model,
          temperature: 0.9,
          maxTokens: 16384,
          transport: 'responses', // Use new Responses API
        });
      }
    }

    // Create and save team config
    const teamConfig = this.teamConfig.createTeamConfig(
      participants,
      this.progress.mode!
    );

    await this.teamConfig.saveConfig(teamConfig);

    console.log(chalk.green('\n✅ Team configuration saved to ~/.nexus/\n'));
  }

  /**
   * Send message to Haiku and get response
   */
  private async sendToHaiku(userMessage: string): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: 1.0,
      messages: this.conversationHistory,
    });

    const assistantMessage =
      response.content[0].type === 'text' ? response.content[0].text : '';

    this.conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
    });

    return assistantMessage;
  }

  /**
   * Get user input from terminal
   */
  private getUserInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Parse model selection from user input
   * Examples: "2x Haiku 4.5, 1x Sonnet 4" or "1 Sonnet 4.5" or "Haiku, Haiku, Sonnet 4"
   */
  private parseModelSelection(
    input: string,
    availableModels: { id: string; name: string }[]
  ): { model: string; count: number }[] {
    const selections: Map<string, number> = new Map();

    // Normalize input
    const normalized = input.toLowerCase();

    // Try to match each available model
    for (const model of availableModels) {
      const modelName = model.name.toLowerCase();
      const modelId = model.id;

      // Count explicit multipliers like "2x haiku" or "2 haiku"
      const multiPattern = new RegExp(
        `(\\d+)\\s*[x×]?\\s*${modelName.replace(/\s+/g, '\\s*')}`,
        'gi'
      );
      let match;

      while ((match = multiPattern.exec(normalized)) !== null) {
        const count = parseInt(match[1], 10);
        selections.set(modelId, (selections.get(modelId) || 0) + count);
      }

      // Count individual mentions
      const pattern = new RegExp(modelName.replace(/\s+/g, '\\s*'), 'gi');
      const matches = normalized.match(pattern);

      if (matches) {
        // Only count if not already counted via multiplier
        if (!selections.has(modelId)) {
          selections.set(modelId, matches.length);
        }
      }
    }

    return Array.from(selections.entries()).map(([model, count]) => ({
      model,
      count,
    }));
  }
}
