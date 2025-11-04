/**
 * Nexus Intelligence Integration
 * Wires up the Context Intelligence Engine with FileTools, MemoryTool, and NexusFileSystem
 * Makes Nexus actually SMART about what it's doing
 */

import { ContextIntelligence, RelevanceScore, ProjectContext } from './context-intelligence.js';
import { FileTools } from '../tools/file-tools.js';
import { MemoryTool } from '../tools/memory-tool.js';
import { NexusFileSystem } from '../filesystem/nexus-fs.js';
import chalk from 'chalk';

export interface IntelligentSuggestion {
  type: 'file' | 'command' | 'refactor' | 'test' | 'documentation';
  priority: 'high' | 'medium' | 'low';
  message: string;
  files?: string[];
  action?: string;
}

export class NexusIntelligence {
  private contextEngine: ContextIntelligence;
  private fileTools: FileTools;
  private memory: MemoryTool;
  private nexusFs: NexusFileSystem;
  private currentContext: string[] = []; // currently active files
  private autoSuggest: boolean = true;

  constructor(
    workspaceRoot: string,
    fileTools: FileTools,
    memory: MemoryTool,
    nexusFs: NexusFileSystem
  ) {
    this.contextEngine = new ContextIntelligence(workspaceRoot);
    this.fileTools = fileTools;
    this.memory = memory;
    this.nexusFs = nexusFs;
  }

  /**
   * Initialize the intelligence layer (silent - logs to file)
   */
  async initialize(): Promise<void> {
    // Silent - all logging happens in context-intelligence.ts → ~/.nexus/logs/
    await this.contextEngine.initialize();
  }

  /**
   * Get project summary
   */
  getProjectSummary(): string {
    return this.contextEngine.getSummary();
  }

  /**
   * Smart file discovery based on query
   * This is what makes Nexus INTELLIGENT
   */
  async discoverRelevantFiles(query: string): Promise<RelevanceScore[]> {
    console.log(chalk.cyan(`🔍 Analyzing relevance for: "${query}"`));
    const scores = await this.contextEngine.calculateRelevance(query, this.currentContext);

    if (scores.length > 0) {
      console.log(chalk.green(`📊 Found ${scores.length} relevant files:`));
      for (const score of scores.slice(0, 5)) {
        console.log(chalk.gray(`  ${score.file} (score: ${score.score})`));
        if (score.reasons.length > 0) {
          console.log(chalk.gray(`    → ${score.reasons[0]}`));
        }
      }
    } else {
      console.log(chalk.yellow('⚠️  No relevant files found'));
    }

    return scores;
  }

  /**
   * Get intelligent suggestions for next actions
   */
  async getSuggestions(): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    const projectContext = this.contextEngine.getContext();

    if (!projectContext) return suggestions;

    // 1. Check for untested code
    const session = this.nexusFs.loadCurrentSession();
    const recentFileChanges = session.fileChanges.slice(-10);
    const changedFiles = new Set(recentFileChanges.map(c => c.path));

    for (const file of changedFiles) {
      const isTestFile = projectContext.testFiles.some(t => t.includes(file));
      if (!isTestFile) {
        // Check if there's a corresponding test file
        const testFileName = file.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1');
        const hasTest = projectContext.testFiles.some(t => t.includes(testFileName));

        if (!hasTest) {
          suggestions.push({
            type: 'test',
            priority: 'high',
            message: `No tests found for ${file}`,
            files: [file],
            action: `Consider creating ${testFileName}`,
          });
        }
      }
    }

    // 2. Check for complex files that were modified
    for (const file of changedFiles) {
      const node = projectContext.graph.nodes.get(file);
      if (node && node.complexity > 10) {
        suggestions.push({
          type: 'refactor',
          priority: 'medium',
          message: `${file} has high complexity (${node.complexity.toFixed(1)})`,
          files: [file],
          action: 'Consider refactoring to reduce complexity',
        });
      }
    }

    // 3. Check for missing documentation
    const hasReadme = projectContext.configFiles.some(f => f.toLowerCase().includes('readme'));
    if (!hasReadme) {
      suggestions.push({
        type: 'documentation',
        priority: 'low',
        message: 'Project missing README.md',
        action: 'Consider adding project documentation',
      });
    }

    // 4. Check for hot spots being modified
    for (const file of changedFiles) {
      const isHotSpot = projectContext.hotSpots.some(h => h.relativePath === file);
      if (isHotSpot) {
        suggestions.push({
          type: 'file',
          priority: 'high',
          message: `${file} is a hot spot (frequently modified)`,
          files: [file],
          action: 'Extra caution - this file changes often',
        });
      }
    }

    return suggestions;
  }

  /**
   * Automatically include relevant files when user asks a question
   * This is HUGE - no more "can you read this file first"
   */
  async autoLoadContext(userMessage: string): Promise<string[]> {
    const relevantFiles = await this.discoverRelevantFiles(userMessage);
    const filesToLoad: string[] = [];

    // Load top 5 most relevant files automatically
    for (const score of relevantFiles.slice(0, 5)) {
      if (score.score > 20) { // threshold for auto-loading
        try {
          await this.fileTools.read(score.file);
          filesToLoad.push(score.file);
          this.currentContext.push(score.file);
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Could not load ${score.file}`));
        }
      }
    }

    if (filesToLoad.length > 0) {
      console.log(chalk.green(`✅ Auto-loaded ${filesToLoad.length} relevant files`));
    }

    // Update current context (dedupe)
    this.currentContext = [...new Set(this.currentContext)];

    return filesToLoad;
  }

  /**
   * Get dependency analysis for current work
   */
  async analyzeDependencies(filePath: string): Promise<string> {
    const tree = this.contextEngine.getDependencyTree(filePath);
    const reverseDeps = this.contextEngine.getReverseDependencies(filePath);

    let analysis = `📦 Dependency Analysis: ${filePath}\n\n`;
    analysis += `${tree}\n\n`;

    if (reverseDeps.length > 0) {
      analysis += `🔄 Reverse Dependencies (${reverseDeps.length}):\n`;
      for (const dep of reverseDeps.slice(0, 10)) {
        analysis += `  • ${dep}\n`;
      }
    } else {
      analysis += `🔄 No reverse dependencies (nothing imports this file)\n`;
    }

    return analysis;
  }

  /**
   * Detect potential issues in recent changes
   */
  async detectIssues(): Promise<IntelligentSuggestion[]> {
    const issues: IntelligentSuggestion[] = [];
    const session = this.nexusFs.loadCurrentSession();
    const recentChanges = session.fileChanges.slice(-10);
    const projectContext = this.contextEngine.getContext();

    if (!projectContext) return issues;

    for (const change of recentChanges) {
      const node = projectContext.graph.nodes.get(change.path);
      if (!node) continue;

      // Check if change broke dependencies
      const reverseDeps = this.contextEngine.getReverseDependencies(change.path);
      if (reverseDeps.length > 5) {
        issues.push({
          type: 'file',
          priority: 'high',
          message: `${change.path} has ${reverseDeps.length} dependents`,
          files: [change.path, ...reverseDeps.slice(0, 3)],
          action: 'Changes may affect multiple files - verify imports',
        });
      }

      // Check if editing a test file but no implementation changes
      if (projectContext.testFiles.includes(change.path)) {
        const implFile = change.path.replace(/\.test\.(ts|js|tsx|jsx)/, '.$1');
        const implChanged = recentChanges.some(c => c.path === implFile);

        if (!implChanged) {
          issues.push({
            type: 'test',
            priority: 'medium',
            message: `Test modified but implementation unchanged`,
            files: [change.path, implFile],
            action: 'Did you mean to update the implementation too?',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Smart code completion suggestions
   */
  async getCompletionContext(filePath: string, cursorLine: number): Promise<{
    imports: string[];
    exports: string[];
    relatedFiles: string[];
  }> {
    const projectContext = this.contextEngine.getContext();
    if (!projectContext) {
      return { imports: [], exports: [], relatedFiles: [] };
    }

    const node = projectContext.graph.nodes.get(filePath);
    if (!node) {
      return { imports: [], exports: [], relatedFiles: [] };
    }

    // Get imports from dependencies
    const allImports: string[] = [];
    for (const dep of node.dependencies) {
      const depNode = projectContext.graph.nodes.get(dep);
      if (depNode) {
        allImports.push(...depNode.exports);
      }
    }

    // Get related files (co-changed)
    const relatedFiles = Array.from(node.coChangedWith.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([file]) => file);

    return {
      imports: [...new Set(allImports)],
      exports: node.exports,
      relatedFiles,
    };
  }

  /**
   * Generate a work plan based on the user's request
   */
  async generateWorkPlan(request: string): Promise<string[]> {
    const steps: string[] = [];
    const lowerRequest = request.toLowerCase();

    // Check if request involves specific patterns
    if (lowerRequest.includes('add') || lowerRequest.includes('create')) {
      steps.push('1. Identify relevant existing files');
      steps.push('2. Determine dependencies needed');
      steps.push('3. Create new file(s)');
      steps.push('4. Add imports and exports');
      steps.push('5. Implement functionality');
      steps.push('6. Create/update tests');
      steps.push('7. Update documentation');
    } else if (lowerRequest.includes('fix') || lowerRequest.includes('bug')) {
      steps.push('1. Locate the file(s) with the bug');
      steps.push('2. Analyze dependencies and related code');
      steps.push('3. Identify the root cause');
      steps.push('4. Implement the fix');
      steps.push('5. Verify with existing tests');
      steps.push('6. Add regression test if needed');
    } else if (lowerRequest.includes('refactor')) {
      steps.push('1. Analyze current implementation');
      steps.push('2. Identify all dependencies');
      steps.push('3. Plan the refactoring approach');
      steps.push('4. Update the code incrementally');
      steps.push('5. Update tests');
      steps.push('6. Verify nothing broke');
    } else {
      // Generic plan
      steps.push('1. Understand the current codebase');
      steps.push('2. Identify relevant files');
      steps.push('3. Make necessary changes');
      steps.push('4. Test the changes');
    }

    return steps;
  }

  /**
   * Track what user is working on
   */
  updateCurrentContext(files: string[]): void {
    this.currentContext = [...new Set([...this.currentContext, ...files])];
    
    // Keep only last 20 files in context
    if (this.currentContext.length > 20) {
      this.currentContext = this.currentContext.slice(-20);
    }
  }

  /**
   * Clear current context
   */
  clearContext(): void {
    this.currentContext = [];
  }

  /**
   * Get current working context
   */
  getCurrentContext(): string[] {
    return [...this.currentContext];
  }

  /**
   * Enable/disable auto suggestions
   */
  setAutoSuggest(enabled: boolean): void {
    this.autoSuggest = enabled;
  }

  /**
   * Show context intelligence status
   */
  getStatus(): string {
    const projectContext = this.contextEngine.getContext();
    if (!projectContext) {
      return chalk.red('❌ Intelligence not initialized');
    }

    const lines = [
      chalk.cyan('🧠 NEXUS INTELLIGENCE STATUS'),
      chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
      chalk.green(`✅ Active and monitoring`),
      chalk.gray(`📁 Tracking ${projectContext.graph.nodes.size} files`),
      chalk.gray(`🎯 Current context: ${this.currentContext.length} files`),
      chalk.gray(`💡 Auto-suggest: ${this.autoSuggest ? 'ON' : 'OFF'}`),
    ];

    if (this.currentContext.length > 0) {
      lines.push('');
      lines.push(chalk.cyan('📂 Current Context:'));
      for (const file of this.currentContext.slice(-5)) {
        lines.push(chalk.gray(`  • ${file}`));
      }
    }

    return lines.join('\n');
  }

  /**
   * Refresh context after file changes
   */
  async refreshContext(changedFiles: string[]): Promise<void> {
    for (const file of changedFiles) {
      await this.contextEngine.refreshFile(file);
    }
  }
}
