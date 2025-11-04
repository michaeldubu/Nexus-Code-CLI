/**
 * Context Intelligence Engine
 * Makes Nexus actually UNDERSTAND your codebase
 * - Dependency graph mapping
 * - Code complexity analysis
 * - Smart file relevance scoring
 * - Pattern recognition
 * - Hot spot detection
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, extname, relative, dirname, basename } from 'path';
import { execSync } from 'child_process';
import { glob } from 'glob';

export interface FileNode {
  path: string;
  relativePath: string;
  size: number;
  lines: number;
  language: string;
  complexity: number;
  dependencies: string[];
  exports: string[];
  imports: string[];
  lastModified: Date;
  changeFrequency: number; // git commit count
  coChangedWith: Map<string, number>; // files that change together
}

export interface DependencyGraph {
  nodes: Map<string, FileNode>;
  edges: Map<string, Set<string>>; // file -> dependencies
  reverseEdges: Map<string, Set<string>>; // file -> dependents
}

export interface ProjectContext {
  rootPath: string;
  graph: DependencyGraph;
  frameworks: string[];
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'none';
  languages: Map<string, number>; // language -> file count
  hotSpots: FileNode[]; // frequently changed files
  complexFiles: FileNode[]; // high complexity files
  entryPoints: string[]; // main files
  testFiles: string[];
  configFiles: string[];
}

export interface RelevanceScore {
  file: string;
  score: number;
  reasons: string[];
}

export class ContextIntelligence {
  private context?: ProjectContext;
  private cache: Map<string, FileNode> = new Map();
  private relevanceCache: Map<string, RelevanceScore[]> = new Map();
  private workspaceRoot: string;
  private ignorePatterns: string[] = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/out/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/.vercel/**',
    '**/.cache/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/target/**',
    '**/.gradle/**',
    '**/venv/**',
    '**/__pycache__/**',
    '**/.pytest_cache/**',
    '**/.mypy_cache/**',
    '**/vendor/**',
    '**/tmp/**',
    '**/temp/**',
  ];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Initialize the intelligence engine - analyze entire workspace
   * ALL OUTPUT GOES TO ~/.nexus/logs/intelligence.log
   */
  async initialize(): Promise<ProjectContext> {
    this.log('Context Intelligence: Analyzing workspace...');
    const startTime = Date.now();

    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map(),
    };

    // Detect frameworks and tools
    const frameworks = this.detectFrameworks();
    const packageManager = this.detectPackageManager();

    // Get all relevant files
    const files = await this.getAllFiles();
    this.log(`Found ${files.length} files`);

    // Analyze each file
    let analyzed = 0;
    for (const file of files) {
      const node = await this.analyzeFile(file);
      if (node) {
        graph.nodes.set(node.relativePath, node);
        this.cache.set(node.relativePath, node);
        analyzed++;

        // Log every 500 files (way less spam)
        if (analyzed % 500 === 0) {
          this.log(`Analyzed ${analyzed}/${files.length} files...`);
        }
      }
    }

    // Build dependency graph
    this.log('Building dependency graph...');
    this.buildDependencyGraph(graph);

    // Calculate code metrics
    this.log('Calculating metrics...');
    const languages = this.calculateLanguageDistribution(graph);
    const hotSpots = this.findHotSpots(graph);
    const complexFiles = this.findComplexFiles(graph);
    const entryPoints = this.findEntryPoints(graph);
    const testFiles = this.findTestFiles(graph);
    const configFiles = this.findConfigFiles(graph);

    this.context = {
      rootPath: this.workspaceRoot,
      graph,
      frameworks,
      packageManager,
      languages,
      hotSpots,
      complexFiles,
      entryPoints,
      testFiles,
      configFiles,
    };

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    this.log(`✅ Context Intelligence initialized in ${duration}s`);
    this.log(`📊 ${graph.nodes.size} files | ${languages.size} languages`);
    this.log(`🔥 ${hotSpots.length} hot spots | ${complexFiles.length} complex files`);

    return this.context;
  }

  /**
   * Log to file instead of console (production-ready logging)
   */
  private log(message: string): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');

      const logDir = path.join(os.homedir(), '.nexus', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;
      const logFile = path.join(logDir, 'intelligence.log');

      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      // Silently fail - don't break if logging fails
    }
  }

  /**
   * Get all files in workspace (respecting ignore patterns)
   */
  private async getAllFiles(): Promise<string[]> {
    const patterns = [
      '**/*.{js,jsx,ts,tsx,mjs,cjs}',
      '**/*.{py,rb,go,rs,java,c,cpp,h,hpp}',
      '**/*.{json,yaml,yml,toml,md}',
      '**/*.{css,scss,sass,less}',
      '**/*.{html,vue,svelte}',
    ];

    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.workspaceRoot,
        ignore: this.ignorePatterns,
        absolute: false,
      });
      allFiles.push(...matches);
    }

    return [...new Set(allFiles)]; // dedupe
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(relativePath: string): Promise<FileNode | null> {
    try {
      const fullPath = join(this.workspaceRoot, relativePath);
      const stats = statSync(fullPath);
      
      if (!stats.isFile()) return null;

      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n').length;
      const language = this.detectLanguage(relativePath);

      // Extract imports/exports
      const { imports, exports, dependencies } = this.extractDependencies(content, language);

      // Calculate complexity (rough heuristic)
      const complexity = this.calculateComplexity(content, language);

      // Get git metadata
      const changeFrequency = this.getChangeFrequency(relativePath);
      const coChangedWith = this.getCoChangedFiles(relativePath);

      return {
        path: fullPath,
        relativePath,
        size: stats.size,
        lines,
        language,
        complexity,
        dependencies,
        exports,
        imports,
        lastModified: stats.mtime,
        changeFrequency,
        coChangedWith,
      };
    } catch (error) {
      // Skip files that can't be read
      return null;
    }
  }

  /**
   * Extract dependencies from file content
   */
  private extractDependencies(content: string, language: string): {
    imports: string[];
    exports: string[];
    dependencies: string[];
  } {
    const imports: string[] = [];
    const exports: string[] = [];
    const dependencies: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // ES6 imports
      const importRegex = /import\s+(?:(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"])/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        imports.push(importPath);
        if (importPath.startsWith('.')) {
          dependencies.push(this.resolveImport(importPath));
        }
      }

      // Require statements
      const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        const importPath = match[1];
        imports.push(importPath);
        if (importPath.startsWith('.')) {
          dependencies.push(this.resolveImport(importPath));
        }
      }

      // Exports
      const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1]);
      }
    } else if (language === 'python') {
      // Python imports
      const importRegex = /(?:from\s+([\w.]+)\s+)?import\s+([\w\s,*]+)/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const module = match[1] || match[2];
        imports.push(module);
        if (module.startsWith('.')) {
          dependencies.push(this.resolveImport(module));
        }
      }
    }

    return { imports, exports, dependencies };
  }

  /**
   * Resolve relative import to actual file path
   */
  private resolveImport(importPath: string): string {
    // Handle .js, .ts extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.js'];
    
    for (const ext of extensions) {
      const resolved = importPath + ext;
      if (this.cache.has(resolved)) {
        return resolved;
      }
    }

    return importPath;
  }

  /**
   * Calculate cyclomatic complexity (rough estimate)
   */
  private calculateComplexity(content: string, language: string): number {
    let complexity = 1; // base complexity

    // Count decision points
    const patterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\&\&/g,
      /\|\|/g,
      /\?/g, // ternary
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) complexity += matches.length;
    }

    // Normalize by lines
    const lines = content.split('\n').length;
    return complexity / lines * 100; // complexity per 100 lines
  }

  /**
   * Get change frequency from git history
   */
  private getChangeFrequency(relativePath: string): number {
    try {
      const cmd = `git log --oneline --follow -- "${relativePath}" | wc -l`;
      const result = execSync(cmd, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return parseInt(result.trim()) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get files that frequently change together
   */
  private getCoChangedFiles(relativePath: string): Map<string, number> {
    const coChanged = new Map<string, number>();

    try {
      // Get commits that touched this file
      const commits = execSync(
        `git log --format="%H" --follow -- "${relativePath}"`,
        { cwd: this.workspaceRoot, encoding: 'utf-8', stdio: 'pipe' }
      ).trim().split('\n').slice(0, 50); // last 50 commits

      for (const commit of commits) {
        if (!commit) continue;

        // Get all files changed in this commit
        const files = execSync(
          `git diff-tree --no-commit-id --name-only -r ${commit}`,
          { cwd: this.workspaceRoot, encoding: 'utf-8', stdio: 'pipe' }
        ).trim().split('\n');

        for (const file of files) {
          if (file && file !== relativePath) {
            coChanged.set(file, (coChanged.get(file) || 0) + 1);
          }
        }
      }
    } catch {
      // Not a git repo or other error
    }

    return coChanged;
  }

  /**
   * Build dependency edges
   */
  private buildDependencyGraph(graph: DependencyGraph): void {
    for (const [filePath, node] of graph.nodes) {
      graph.edges.set(filePath, new Set(node.dependencies));

      // Build reverse edges (dependents)
      for (const dep of node.dependencies) {
        if (!graph.reverseEdges.has(dep)) {
          graph.reverseEdges.set(dep, new Set());
        }
        graph.reverseEdges.get(dep)!.add(filePath);
      }
    }
  }

  /**
   * Detect frameworks in use
   */
  private detectFrameworks(): string[] {
    const frameworks: string[] = [];
    const packageJsonPath = join(this.workspaceRoot, 'package.json');

    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const frameworkMap: [string, string][] = [
        ['react', 'React'],
        ['next', 'Next.js'],
        ['vue', 'Vue'],
        ['svelte', 'Svelte'],
        ['angular', 'Angular'],
        ['express', 'Express'],
        ['fastify', 'Fastify'],
        ['nestjs', 'NestJS'],
        ['gatsby', 'Gatsby'],
        ['remix', 'Remix'],
      ];

      for (const [pkg, name] of frameworkMap) {
        if (deps[pkg]) frameworks.push(name);
      }
    }

    return frameworks;
  }

  /**
   * Detect package manager
   */
  private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' | 'none' {
    if (existsSync(join(this.workspaceRoot, 'bun.lockb'))) return 'bun';
    if (existsSync(join(this.workspaceRoot, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(this.workspaceRoot, 'yarn.lock'))) return 'yarn';
    if (existsSync(join(this.workspaceRoot, 'package-lock.json'))) return 'npm';
    return 'none';
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = extname(filePath);
    const langMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.py': 'python',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.html': 'html',
    };
    return langMap[ext] || 'unknown';
  }

  /**
   * Calculate language distribution
   */
  private calculateLanguageDistribution(graph: DependencyGraph): Map<string, number> {
    const distribution = new Map<string, number>();

    for (const node of graph.nodes.values()) {
      distribution.set(node.language, (distribution.get(node.language) || 0) + 1);
    }

    return distribution;
  }

  /**
   * Find hot spots (frequently changed files)
   */
  private findHotSpots(graph: DependencyGraph): FileNode[] {
    return Array.from(graph.nodes.values())
      .filter(node => node.changeFrequency > 0)
      .sort((a, b) => b.changeFrequency - a.changeFrequency)
      .slice(0, 20);
  }

  /**
   * Find complex files (high complexity)
   */
  private findComplexFiles(graph: DependencyGraph): FileNode[] {
    return Array.from(graph.nodes.values())
      .filter(node => node.complexity > 5) // threshold
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 20);
  }

  /**
   * Find entry points (files with no imports or main files)
   */
  private findEntryPoints(graph: DependencyGraph): string[] {
    const entryPoints: string[] = [];

    // Look for common entry point names
    const commonEntryPoints = [
      'index.ts',
      'index.js',
      'main.ts',
      'main.js',
      'app.ts',
      'app.js',
      'server.ts',
      'server.js',
    ];

    for (const node of graph.nodes.values()) {
      const baseName = basename(node.relativePath);
      if (commonEntryPoints.includes(baseName)) {
        entryPoints.push(node.relativePath);
      }
    }

    // Add files with high dependent count
    const dependentCounts = new Map<string, number>();
    for (const [file, dependents] of graph.reverseEdges) {
      dependentCounts.set(file, dependents.size);
    }

    const highDependents = Array.from(dependentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([file]) => file);

    return [...new Set([...entryPoints, ...highDependents])];
  }

  /**
   * Find test files
   */
  private findTestFiles(graph: DependencyGraph): string[] {
    const testFiles: string[] = [];

    for (const node of graph.nodes.values()) {
      const path = node.relativePath.toLowerCase();
      if (
        path.includes('.test.') ||
        path.includes('.spec.') ||
        path.includes('__tests__')
      ) {
        testFiles.push(node.relativePath);
      }
    }

    return testFiles;
  }

  /**
   * Find config files
   */
  private findConfigFiles(graph: DependencyGraph): string[] {
    const configFiles: string[] = [];
    const configPatterns = [
      'package.json',
      'tsconfig.json',
      'webpack.config',
      'vite.config',
      'next.config',
      '.env',
      'jest.config',
      'babel.config',
      '.eslintrc',
      '.prettierrc',
    ];

    for (const node of graph.nodes.values()) {
      const baseName = basename(node.relativePath);
      if (configPatterns.some(pattern => baseName.includes(pattern))) {
        configFiles.push(node.relativePath);
      }
    }

    return configFiles;
  }

  /**
   * Calculate file relevance for a given query/context
   * This is the MAGIC - determines which files matter for the current task
   */
  async calculateRelevance(query: string, currentFiles: string[] = []): Promise<RelevanceScore[]> {
    if (!this.context) {
      throw new Error('Context not initialized. Call initialize() first.');
    }

    // Check cache
    const cacheKey = `${query}:${currentFiles.join(',')}`;
    if (this.relevanceCache.has(cacheKey)) {
      return this.relevanceCache.get(cacheKey)!;
    }

    const scores: RelevanceScore[] = [];
    const queryTokens = query.toLowerCase().split(/\s+/);

    for (const [filePath, node] of this.context.graph.nodes) {
      let score = 0;
      const reasons: string[] = [];

      // 1. Path/name matching
      const pathLower = filePath.toLowerCase();
      for (const token of queryTokens) {
        if (pathLower.includes(token)) {
          score += 10;
          reasons.push(`Path contains "${token}"`);
        }
      }

      // 2. Currently open files get high priority
      if (currentFiles.includes(filePath)) {
        score += 50;
        reasons.push('Currently open');
      }

      // 3. Dependencies of current files
      for (const currentFile of currentFiles) {
        if (node.dependencies.includes(currentFile)) {
          score += 30;
          reasons.push(`Imports ${currentFile}`);
        }
        if (this.context.graph.reverseEdges.get(currentFile)?.has(filePath)) {
          score += 25;
          reasons.push(`Imported by ${currentFile}`);
        }
      }

      // 4. Co-changed files (if currently working on specific files)
      for (const currentFile of currentFiles) {
        const currentNode = this.context.graph.nodes.get(currentFile);
        if (currentNode?.coChangedWith.has(filePath)) {
          const coChangeCount = currentNode.coChangedWith.get(filePath)!;
          score += Math.min(coChangeCount * 2, 20);
          reasons.push(`Often changes with ${currentFile}`);
        }
      }

      // 5. Entry points get moderate priority
      if (this.context.entryPoints.includes(filePath)) {
        score += 15;
        reasons.push('Entry point');
      }

      // 6. Hot spots (frequently changed) are relevant
      if (node.changeFrequency > 10) {
        score += 10;
        reasons.push('Frequently modified');
      }

      // 7. Test files get priority if query mentions tests
      if (queryTokens.some(t => ['test', 'testing', 'spec'].includes(t))) {
        if (this.context.testFiles.includes(filePath)) {
          score += 20;
          reasons.push('Test file');
        }
      }

      if (score > 0) {
        scores.push({ file: filePath, score, reasons });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Cache results
    this.relevanceCache.set(cacheKey, scores.slice(0, 50)); // top 50

    return scores.slice(0, 20); // return top 20
  }

  /**
   * Get summary of project context
   */
  getSummary(): string {
    if (!this.context) {
      return 'Context not initialized';
    }

    const lines = [
      '🧠 PROJECT CONTEXT SUMMARY',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `📁 Root: ${this.context.rootPath}`,
      `📊 Files: ${this.context.graph.nodes.size}`,
      `🔧 Frameworks: ${this.context.frameworks.join(', ') || 'None detected'}`,
      `📦 Package Manager: ${this.context.packageManager}`,
      '',
      '📊 Languages:',
    ];

    const sortedLangs = Array.from(this.context.languages.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [lang, count] of sortedLangs) {
      const percentage = ((count / this.context.graph.nodes.size) * 100).toFixed(1);
      lines.push(`  ${lang}: ${count} files (${percentage}%)`);
    }

    if (this.context.hotSpots.length > 0) {
      lines.push('');
      lines.push('🔥 Hot Spots (top 5):');
      for (const node of this.context.hotSpots.slice(0, 5)) {
        lines.push(`  ${node.relativePath} (${node.changeFrequency} commits)`);
      }
    }

    if (this.context.complexFiles.length > 0) {
      lines.push('');
      lines.push('⚠️  Complex Files (top 5):');
      for (const node of this.context.complexFiles.slice(0, 5)) {
        lines.push(`  ${node.relativePath} (complexity: ${node.complexity.toFixed(1)})`);
      }
    }

    lines.push('');
    lines.push(`🎯 Entry Points: ${this.context.entryPoints.length}`);
    lines.push(`🧪 Test Files: ${this.context.testFiles.length}`);
    lines.push(`⚙️  Config Files: ${this.context.configFiles.length}`);

    return lines.join('\n');
  }

  /**
   * Get dependency tree for a file
   */
  getDependencyTree(filePath: string, depth: number = 3): string {
    if (!this.context) {
      return 'Context not initialized';
    }

    const node = this.context.graph.nodes.get(filePath);
    if (!node) {
      return `File not found: ${filePath}`;
    }

    const lines: string[] = [`📦 ${filePath}`];
    const visited = new Set<string>();

    const buildTree = (file: string, currentDepth: number, prefix: string) => {
      if (currentDepth >= depth || visited.has(file)) return;
      visited.add(file);

      const deps = this.context!.graph.edges.get(file);
      if (!deps || deps.size === 0) return;

      const depArray = Array.from(deps);
      for (let i = 0; i < depArray.length; i++) {
        const dep = depArray[i];
        const isLast = i === depArray.length - 1;
        const connector = isLast ? '└─' : '├─';
        const nextPrefix = prefix + (isLast ? '  ' : '│ ');

        lines.push(`${prefix}${connector} ${dep}`);
        buildTree(dep, currentDepth + 1, nextPrefix);
      }
    };

    buildTree(filePath, 0, '');
    return lines.join('\n');
  }

  /**
   * Get reverse dependencies (what depends on this file)
   */
  getReverseDependencies(filePath: string): string[] {
    if (!this.context) return [];

    const dependents = this.context.graph.reverseEdges.get(filePath);
    return dependents ? Array.from(dependents) : [];
  }

  /**
   * Get the context object
   */
  getContext(): ProjectContext | undefined {
    return this.context;
  }

  /**
   * Refresh a specific file's analysis
   */
  async refreshFile(relativePath: string): Promise<void> {
    if (!this.context) return;

    const node = await this.analyzeFile(relativePath);
    if (node) {
      this.context.graph.nodes.set(relativePath, node);
      this.cache.set(relativePath, node);

      // Clear relevance cache
      this.relevanceCache.clear();
    }
  }
}
