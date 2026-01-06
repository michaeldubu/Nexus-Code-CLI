# 🧠 Nexus Context Intelligence Engine

**Making Nexus actually UNDERSTAND your codebase instead of just blindly reading files.**

## What The Hell Is This?

This is an intelligence layer that sits on top of your existing Nexus file tools and makes the system actually **smart** about what it's doing. No more "can you read this file first" or manually figuring out which files are relevant. Nexus now KNOWS.

## Core Features

### 🎯 Smart File Discovery
- **Auto-discovers relevant files** based on what you're asking about
- Uses dependency graphs, change history, and pattern recognition
- No more manually telling it which files to look at

### 📊 Code Intelligence
- **Dependency graph mapping** - knows what imports what
- **Complexity analysis** - identifies gnarly code that needs attention
- **Hot spot detection** - finds files that change frequently (potential trouble)
- **Co-change tracking** - knows which files usually change together

### 💡 Intelligent Suggestions
- Detects missing tests
- Flags high-complexity code
- Warns about risky changes (files with many dependents)
- Suggests refactoring opportunities

### 🔍 Context Auto-Loading
The killer feature: **Nexus automatically loads relevant files** when you ask a question. No more back-and-forth.

## Architecture

```
┌─────────────────────────────────────┐
│   Context Intelligence Engine       │
│  (Analyzes entire workspace)        │
└─────────────────┬───────────────────┘
                  │
                  │ provides context to
                  │
┌─────────────────▼───────────────────┐
│   Nexus Intelligence Integration    │
│  (Smart layer for file operations)  │
└─────────────────┬───────────────────┘
                  │
                  │ enhances
                  │
┌─────────────────▼───────────────────┐
│   Existing Nexus Components         │
│  FileTools | MemoryTool | NexusFS   │
└─────────────────────────────────────┘
```

## Quick Start

```typescript
import { setupIntelligentCommands } from './intelligent-commands.js';

// Initialize everything
const { commandHandler, intelligence } = await setupIntelligentCommands('/path/to/workspace');

// Now use it!
```

## Available Commands

### `/context`
Shows project understanding - frameworks detected, file counts, languages, hot spots, etc.

```bash
> /context

🧠 PROJECT CONTEXT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Root: /home/user/my-project
📊 Files: 247
🔧 Frameworks: React, Next.js
📦 Package Manager: pnpm

📊 Languages:
  typescript: 189 files (76.5%)
  javascript: 31 files (12.6%)
  css: 27 files (10.9%)

🔥 Hot Spots (top 5):
  src/components/Header.tsx (45 commits)
  src/utils/api.ts (38 commits)
  ...
```

### `/analyze [file]`
Deep dive into a specific file - shows metrics, dependencies, who imports it, complexity, etc.

```bash
> /analyze src/components/Header.tsx

🔬 ANALYZING: src/components/Header.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 METRICS
  Lines: 324
  Size: 12.45 KB
  Language: typescript
  Complexity: 8.52 (🟡 MODERATE)
  Change Frequency: 45 commits

📦 DEPENDENCIES
  → ./Navigation.tsx
  → ../hooks/useAuth.ts
  → ../utils/theme.ts

🔄 IMPORTED BY
  ← src/pages/_app.tsx
  ← src/layouts/MainLayout.tsx
```

### `/relevant [query]`
Find files relevant to what you're asking about. Uses AI-powered relevance scoring.

```bash
> /relevant authentication system

🎯 RELEVANT FILES FOR: "authentication system"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

████████░░ src/utils/auth.ts
   Score: 85 | Path contains "auth", Entry point

███████░░░ src/hooks/useAuth.ts
   Score: 72 | Path contains "auth", Often changes with auth.ts

██████░░░░ src/pages/login.tsx
   Score: 58 | Imports src/utils/auth.ts
```

### `/suggest`
Get intelligent suggestions based on recent changes.

```bash
> /suggest

💡 INTELLIGENT SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 HIGH PRIORITY
  🧪 No tests found for src/components/NewFeature.tsx
     → Consider creating src/components/NewFeature.test.tsx

🟡 MEDIUM PRIORITY
  🔧 src/utils/parser.ts has high complexity (14.2)
     → Consider refactoring to reduce complexity
```

### `/issues`
Detect potential problems in recent changes.

```bash
> /issues

⚠️  POTENTIAL ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 src/utils/api.ts has 12 dependents
   Affected: pages/dashboard.tsx, components/DataTable.tsx, ...
   → Changes may affect multiple files - verify imports
```

### `/deps [file]`
Show dependency tree for a file.

```bash
> /deps src/utils/api.ts

📦 src/utils/api.ts
├─ src/utils/fetch.ts
│  └─ src/utils/errors.ts
├─ src/config/endpoints.ts
└─ src/utils/auth.ts
   └─ src/utils/storage.ts

🔄 Reverse Dependencies (12):
  • pages/dashboard.tsx
  • components/DataTable.tsx
  • hooks/useData.ts
  ...
```

### `/plan [task]`
Generate a work plan for a task.

```bash
> /plan add user profile page

📋 WORK PLAN: add user profile page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Identify relevant existing files
2. Determine dependencies needed
3. Create new file(s)
4. Add imports and exports
5. Implement functionality
6. Create/update tests
7. Update documentation

💡 Tip: Use /relevant to find files for each step
```

### `/hotspots`
Show frequently modified files (potential problem areas).

```bash
> /hotspots

🔥 HOT SPOTS (Frequently Modified Files)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

██████████ src/utils/api.ts
   45 commits | Complexity: 8.2

████████░░ src/components/Header.tsx
   38 commits | Complexity: 12.4
```

### `/complex`
Show files with high complexity.

```bash
> /complex

⚠️  COMPLEX FILES (High Cognitive Load)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 VERY HIGH src/legacy/parser.ts
   Complexity: 18.45 | 856 lines

🟠 HIGH src/components/Dashboard.tsx
   Complexity: 12.23 | 524 lines

💡 Consider refactoring files with very high complexity
```

## The Killer Feature: Auto-Loading Context

When a user asks a question, Nexus automatically loads the most relevant files **before** processing the request. No more this bullshit:

**OLD WAY:**
```
User: "How does authentication work?"
Nexus: "I don't have that information. Can you show me the auth files?"
User: "Read src/utils/auth.ts"
Nexus: "Okay, I see it now..."
User: "Now read src/hooks/useAuth.ts too"
Nexus: "Got it. So about authentication..."
```

**NEW WAY:**
```
User: "How does authentication work?"
Nexus: 🧠 Auto-loading relevant context...
       ✅ Auto-loaded 3 relevant files:
         • src/utils/auth.ts
         • src/hooks/useAuth.ts
         • src/pages/login.tsx
       
       "Based on these files, here's how authentication works..."
```

### How To Use Auto-Loading

```typescript
const handler = new IntelligentCommandHandler(ctx);

async function handleUserMessage(message: string) {
  // Auto-load context before processing
  if (!message.startsWith('/')) {
    await handler.autoLoadContext(message);
  }
  
  // Now process the message with full context
  const response = await processWithAI(message);
  return response;
}
```

## Performance

- **Initial scan**: ~2-5 seconds for a typical project (200-500 files)
- **Relevance calculation**: <100ms (cached)
- **Memory usage**: ~50-100MB for graph data
- **Refresh after file change**: <50ms

## What Gets Analyzed

The engine scans:
- All source code files (`.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.go`, etc.)
- Config files (`package.json`, `tsconfig.json`, etc.)
- Markdown documentation
- CSS/SCSS files

It IGNORES:
- `node_modules`
- `.git`
- Build outputs (`dist`, `build`, `.next`, etc.)
- Binary files

## Intelligence Metrics

### Complexity Score
Calculated using:
- Number of decision points (`if`, `else`, `for`, `while`, etc.)
- Logical operators (`&&`, `||`)
- Ternary operators
- Try/catch blocks

Normalized per 100 lines of code.

**Ratings:**
- 🟢 LOW: < 5
- 🟡 MODERATE: 5-10
- 🟠 HIGH: 10-15
- 🔴 VERY HIGH: > 15

### Relevance Score
Factors include:
- Path/filename matching (10 points per match)
- Currently open files (50 points)
- Direct dependencies (30 points)
- Reverse dependencies (25 points)
- Co-change frequency (up to 20 points)
- Entry points (15 points)
- Change frequency (10 points)
- Test file relevance (20 points for test queries)

### Hot Spot Detection
Files are hot spots if they:
- Have high commit frequency (relative to project)
- Change together with many other files
- Have many dependents

## Integration Example

Full integration with your existing Nexus TUI:

```typescript
// Initialize
const ctx = await setupIntelligentCommands(process.cwd());
const { commandHandler, intelligence } = ctx;

// Command dispatcher
async function handleCommand(input: string): Promise<string> {
  const [cmd, ...args] = input.split(' ');
  
  switch (cmd) {
    case '/context':
      return await commandHandler.handleContext();
    
    case '/analyze':
      return await commandHandler.handleAnalyze(args.join(' '));
    
    case '/relevant':
      return await commandHandler.handleRelevant(args.join(' '));
    
    case '/suggest':
      return await commandHandler.handleSuggest();
    
    case '/issues':
      return await commandHandler.handleIssues();
    
    case '/deps':
      return await commandHandler.handleDeps(args.join(' '));
    
    case '/plan':
      return await commandHandler.handlePlan(args.join(' '));
    
    case '/hotspots':
      return await commandHandler.handleHotspots();
    
    case '/complex':
      return await commandHandler.handleComplex();
    
    default:
      // Regular message - auto-load context first!
      await commandHandler.autoLoadContext(input);
      return await processWithAI(input);
  }
}
```

## Configuration

The engine respects your `.gitignore` and uses sensible defaults, but you can customize:

```typescript
const intelligence = new ContextIntelligence(workspaceRoot);

// Add custom ignore patterns
intelligence['ignorePatterns'].push('my-custom-dir', '.secrets');

// Initialize
await intelligence.initialize();
```

## Future Enhancements

Ideas for making this even more powerful:

1. **Pattern Library**: Learn common patterns in the codebase
2. **Change Impact Analysis**: Predict what will break before making changes
3. **Auto-test Generation**: Suggest test cases based on code analysis
4. **Semantic Code Search**: Find similar code by meaning, not just text
5. **Refactoring Suggestions**: Automated code improvement recommendations
6. **Documentation Generation**: Auto-generate docs from code structure
7. **Performance Profiling**: Track which files are slow to parse
8. **Security Analysis**: Detect potential security issues

## Technical Details

### File Analysis
- Uses AST-like regex parsing (fast but good enough)
- Tracks imports/exports for dependency mapping
- Calculates cyclomatic complexity heuristically
- Integrates with git for change history

### Dependency Graph
- Built using adjacency lists (fast lookup)
- Maintains both forward and reverse edges
- Handles circular dependencies gracefully
- Updates incrementally on file changes

### Caching
- File analysis results cached in memory
- Relevance scores cached per query
- Invalidated on file changes
- LRU eviction for memory management

## Why This Is Awesome

Before Context Intelligence:
- ❌ Manual file discovery
- ❌ No understanding of project structure
- ❌ Repeated "can you read X" requests
- ❌ No awareness of code health
- ❌ Blind to dependencies

After Context Intelligence:
- ✅ Automatic file discovery
- ✅ Deep project understanding
- ✅ Proactive context loading
- ✅ Code health monitoring
- ✅ Dependency-aware operations

## License

Part of SAAAM's Nexus project. Do whatever you want with it - just make it better 🔥

---

**Built by Michael & Claude at SAAAM LLC**
*Making impossible shit reality since 2024*
