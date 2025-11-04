/**
 * Enhanced Command Handler with Intelligence
 * Integrates Context Intelligence into Nexus commands
 * Makes every command SMARTER
 */

import { NexusIntelligence } from './nexus-intelligence.js';
import { FileTools } from '../tools/file-tools.js';
import { MemoryTool } from '../tools/memory-tool.js';
import { NexusFileSystem } from '../filesystem/nexus-fs.js';
import chalk from 'chalk';

export interface CommandContext {
  intelligence: NexusIntelligence;
  fileTools: FileTools;
  memory: MemoryTool;
  nexusFs: NexusFileSystem;
}

export class IntelligentCommandHandler {
  private ctx: CommandContext;

  constructor(ctx: CommandContext) {
    this.ctx = ctx;
  }

  /**
   * Handle /context command - show project understanding
   */
  async handleContext(): Promise<string> {
    const summary = this.ctx.intelligence.getProjectSummary();
    const status = this.ctx.intelligence.getStatus();
    
    return `${summary}\n\n${status}`;
  }

  /**
   * Handle /analyze [file] - deep dive into a file
   */
  async handleAnalyze(filePath: string): Promise<string> {
    const lines: string[] = [];
    
    lines.push(chalk.cyan(`🔬 ANALYZING: ${filePath}`));
    lines.push(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    // Get file metadata
    const projectContext = this.ctx.intelligence['contextEngine'].getContext();
    if (!projectContext) {
      return chalk.red('❌ Intelligence not initialized');
    }

    const node = projectContext.graph.nodes.get(filePath);
    if (!node) {
      return chalk.red(`❌ File not found: ${filePath}`);
    }

    // Basic info
    lines.push('');
    lines.push(chalk.yellow('📊 METRICS'));
    lines.push(`  Lines: ${node.lines}`);
    lines.push(`  Size: ${(node.size / 1024).toFixed(2)} KB`);
    lines.push(`  Language: ${node.language}`);
    lines.push(`  Complexity: ${node.complexity.toFixed(2)} (${this.complexityRating(node.complexity)})`);
    lines.push(`  Change Frequency: ${node.changeFrequency} commits`);

    // Dependencies
    lines.push('');
    lines.push(chalk.yellow('📦 DEPENDENCIES'));
    if (node.dependencies.length > 0) {
      for (const dep of node.dependencies.slice(0, 10)) {
        lines.push(`  → ${dep}`);
      }
      if (node.dependencies.length > 10) {
        lines.push(chalk.gray(`  ... and ${node.dependencies.length - 10} more`));
      }
    } else {
      lines.push(chalk.gray('  No local dependencies'));
    }

    // Reverse dependencies
    const reverseDeps = this.ctx.intelligence['contextEngine'].getReverseDependencies(filePath);
    if (reverseDeps.length > 0) {
      lines.push('');
      lines.push(chalk.yellow('🔄 IMPORTED BY'));
      for (const dep of reverseDeps.slice(0, 10)) {
        lines.push(`  ← ${dep}`);
      }
      if (reverseDeps.length > 10) {
        lines.push(chalk.gray(`  ... and ${reverseDeps.length - 10} more`));
      }
    }

    // Co-changed files
    if (node.coChangedWith.size > 0) {
      lines.push('');
      lines.push(chalk.yellow('🔗 FREQUENTLY CHANGES WITH'));
      const coChanged = Array.from(node.coChangedWith.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      for (const [file, count] of coChanged) {
        lines.push(`  ${file} (${count} times)`);
      }
    }

    // Exports
    if (node.exports.length > 0) {
      lines.push('');
      lines.push(chalk.yellow('📤 EXPORTS'));
      for (const exp of node.exports.slice(0, 10)) {
        lines.push(`  • ${exp}`);
      }
      if (node.exports.length > 10) {
        lines.push(chalk.gray(`  ... and ${node.exports.length - 10} more`));
      }
    }

    return lines.join('\n');
  }

  /**
   * Handle /relevant [query] - find relevant files
   */
  async handleRelevant(query: string): Promise<string> {
    const scores = await this.ctx.intelligence.discoverRelevantFiles(query);

    if (scores.length === 0) {
      return chalk.yellow('⚠️  No relevant files found for your query');
    }

    const lines: string[] = [];
    lines.push(chalk.cyan(`🎯 RELEVANT FILES FOR: "${query}"`));
    lines.push(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    lines.push('');

    for (const score of scores.slice(0, 15)) {
      const scoreBar = this.scoreBar(score.score);
      lines.push(chalk.green(`${scoreBar} ${score.file}`));
      lines.push(chalk.gray(`   Score: ${score.score} | ${score.reasons.slice(0, 2).join(', ')}`));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Handle /suggest - get intelligent suggestions
   */
  async handleSuggest(): Promise<string> {
    const suggestions = await this.ctx.intelligence.getSuggestions();

    if (suggestions.length === 0) {
      return chalk.green('✅ No suggestions - everything looks good!');
    }

    const lines: string[] = [];
    lines.push(chalk.cyan('💡 INTELLIGENT SUGGESTIONS'));
    lines.push(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    lines.push('');

    // Group by priority
    const high = suggestions.filter(s => s.priority === 'high');
    const medium = suggestions.filter(s => s.priority === 'medium');
    const low = suggestions.filter(s => s.priority === 'low');

    if (high.length > 0) {
      lines.push(chalk.red('🔴 HIGH PRIORITY'));
      for (const sug of high) {
        lines.push(`  ${this.typeIcon(sug.type)} ${sug.message}`);
        if (sug.action) {
          lines.push(chalk.gray(`     → ${sug.action}`));
        }
        lines.push('');
      }
    }

    if (medium.length > 0) {
      lines.push(chalk.yellow('🟡 MEDIUM PRIORITY'));
      for (const sug of medium) {
        lines.push(`  ${this.typeIcon(sug.type)} ${sug.message}`);
        if (sug.action) {
          lines.push(chalk.gray(`     → ${sug.action}`));
        }
        lines.push('');
      }
    }

    if (low.length > 0) {
      lines.push(chalk.blue('🔵 LOW PRIORITY'));
      for (const sug of low) {
        lines.push(`  ${this.typeIcon(sug.type)} ${sug.message}`);
        if (sug.action) {
          lines.push(chalk.gray(`     → ${sug.action}`));
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Handle /issues - detect potential problems
   */
  async handleIssues(): Promise<string> {
    const issues = await this.ctx.intelligence.detectIssues();

    if (issues.length === 0) {
      return chalk.green('✅ No issues detected!');
    }

    const lines: string[] = [];
    lines.push(chalk.cyan('⚠️  POTENTIAL ISSUES'));
    lines.push(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    lines.push('');

    for (const issue of issues) {
      const icon = issue.priority === 'high' ? '🔴' : '🟡';
      lines.push(`${icon} ${issue.message}`);
      if (issue.files) {
        lines.push(chalk.gray(`   Affected: ${issue.files.slice(0, 3).join(', ')}`));
      }
      if (issue.action) {
        lines.push(chalk.yellow(`   → ${issue.action}`));
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Handle /deps [file] - show dependency tree
   */
  async handleDeps(filePath: string): Promise<string> {
    const analysis = await this.ctx.intelligence.analyzeDependencies(filePath);
    return chalk.cyan(analysis);
  }

  /**
   * Handle /plan [task] - generate work plan
   */
  async handlePlan(task: string): Promise<string> {
    const steps = await this.ctx.intelligence.generateWorkPlan(task);

    const lines: string[] = [];
    lines.push(chalk.cyan(`📋 WORK PLAN: ${task}`));
    lines.push(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    lines.push('');

    for (const step of steps) {
      lines.push(chalk.green(step));
    }

    lines.push('');
    lines.push(chalk.yellow('💡 Tip: Use /relevant to find files for each step'));

    return lines.join('\n');
  }

  /**
   * Handle /hotspots - show frequently changed files
   */
  async handleHotspots(): Promise<string> {
    const projectContext = this.ctx.intelligence['contextEngine'].getContext();
    if (!projectContext) {
      return chalk.red('❌ Intelligence not initialized');
    }

    const lines: string[] = [];
    lines.push(chalk.cyan('🔥 HOT SPOTS (Frequently Modified Files)'));
    lines.push(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    lines.push('');

    if (projectContext.hotSpots.length === 0) {
      return chalk.gray('No hot spots detected (or not in a git repo)');
    }

    for (const node of projectContext.hotSpots.slice(0, 15)) {
      const bar = this.changeBar(node.changeFrequency);
      lines.push(`${bar} ${node.relativePath}`);
      lines.push(chalk.gray(`   ${node.changeFrequency} commits | Complexity: ${node.complexity.toFixed(1)}`));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Handle /complex - show complex files
   */
  async handleComplex(): Promise<string> {
    const projectContext = this.ctx.intelligence['contextEngine'].getContext();
    if (!projectContext) {
      return chalk.red('❌ Intelligence not initialized');
    }

    const lines: string[] = [];
    lines.push(chalk.cyan('⚠️  COMPLEX FILES (High Cognitive Load)'));
    lines.push(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    lines.push('');

    if (projectContext.complexFiles.length === 0) {
      return chalk.green('✅ No overly complex files detected!');
    }

    for (const node of projectContext.complexFiles.slice(0, 15)) {
      const rating = this.complexityRating(node.complexity);
      const ratingColor = node.complexity > 15 ? chalk.red : node.complexity > 10 ? chalk.yellow : chalk.white;
      
      lines.push(`${ratingColor(rating)} ${node.relativePath}`);
      lines.push(chalk.gray(`   Complexity: ${node.complexity.toFixed(2)} | ${node.lines} lines`));
      lines.push('');
    }

    lines.push(chalk.yellow('💡 Consider refactoring files with very high complexity'));

    return lines.join('\n');
  }

  /**
   * Auto-load context before AI processes user message
   * This is THE KILLER FEATURE - no more "read this file first"
   */
  async autoLoadContext(userMessage: string): Promise<string> {
    console.log(chalk.cyan('🧠 Auto-loading relevant context...'));
    
    const loadedFiles = await this.ctx.intelligence.autoLoadContext(userMessage);

    if (loadedFiles.length === 0) {
      return chalk.gray('No additional context needed');
    }

    const lines: string[] = [];
    lines.push(chalk.green(`✅ Auto-loaded ${loadedFiles.length} relevant files:`));
    for (const file of loadedFiles) {
      lines.push(chalk.gray(`  • ${file}`));
    }

    return lines.join('\n');
  }

  /**
   * Helper: Get complexity rating
   */
  private complexityRating(complexity: number): string {
    if (complexity < 5) return '🟢 LOW';
    if (complexity < 10) return '🟡 MODERATE';
    if (complexity < 15) return '🟠 HIGH';
    return '🔴 VERY HIGH';
  }

  /**
   * Helper: Create score bar
   */
  private scoreBar(score: number): string {
    const normalized = Math.min(score / 10, 10);
    const filled = Math.floor(normalized);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Helper: Create change frequency bar
   */
  private changeBar(changes: number): string {
    const normalized = Math.min(changes / 5, 10);
    const filled = Math.floor(normalized);
    const empty = 10 - filled;
    return chalk.red('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  /**
   * Helper: Get type icon
   */
  private typeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      file: '📁',
      command: '⚡',
      refactor: '🔧',
      test: '🧪',
      documentation: '📝',
    };
    return icons[type] || '•';
  }
}

/**
 * Example integration into your main Nexus command loop
 */
export async function setupIntelligentCommands(workspaceRoot: string) {
  // Initialize components
  const fileTools = new FileTools(workspaceRoot);
  const nexusFs = new NexusFileSystem(workspaceRoot);
  const memory = new MemoryTool(workspaceRoot);
  
  // Create intelligence layer
  const intelligence = new NexusIntelligence(
    workspaceRoot,
    fileTools,
    memory,
    nexusFs
  );

  // Initialize (this scans the codebase)
  await intelligence.initialize();

  // Create command handler
  const commandHandler = new IntelligentCommandHandler({
    intelligence,
    fileTools,
    memory,
    nexusFs,
  });

  // Return handler for use in your TUI
  return { commandHandler, intelligence, fileTools, memory, nexusFs };
}

/**
 * Command registry - map command names to handlers
 */
export const INTELLIGENT_COMMANDS = {
  '/context': 'Show project context and understanding',
  '/analyze': 'Deep analysis of a specific file',
  '/relevant': 'Find files relevant to a query',
  '/suggest': 'Get intelligent suggestions',
  '/issues': 'Detect potential issues',
  '/deps': 'Show dependency tree for a file',
  '/plan': 'Generate a work plan for a task',
  '/hotspots': 'Show frequently modified files',
  '/complex': 'Show files with high complexity',
};

/**
 * Example usage in your message handler:
 * 
 * async function handleUserMessage(message: string, ctx: CommandContext) {
 *   const handler = new IntelligentCommandHandler(ctx);
 *   
 *   // Auto-load relevant files before processing
 *   if (!message.startsWith('/')) {
 *     await handler.autoLoadContext(message);
 *   }
 *   
 *   // Process commands
 *   if (message.startsWith('/context')) {
 *     return await handler.handleContext();
 *   } else if (message.startsWith('/analyze ')) {
 *     const file = message.substring(9).trim();
 *     return await handler.handleAnalyze(file);
 *   }
 *   // ... etc
 * }
 */
