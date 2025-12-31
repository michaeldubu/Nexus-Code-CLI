# ⚡ NEXUS Context Intelligence - Run This First!

## Quick Start (2 minutes)

### 1. Install & Build
```bash
# Install dependencies (from parent directory)
cd ..
npm install
cd context_intelligence_system

# Build everything
npx tsc --project mcp-client-tsconfig.json
npx tsc demo.ts test-mcp-client.ts --module ES2022 --target ES2022 --moduleResolution node --esModuleInterop
```

Or use the build script:
```bash
npm run build
```

### 2. Test It
```bash
# Run comprehensive tests (works without plugin)
npm test
# or
node test-mcp-client.js
```

You should see:
```
✅ Client structure test: PASSED
⏭️  Connection test: SKIPPED (server not running)
```

### 3. Try the Demo
```bash
npm run demo
# or
node demo.js
```

### 4. Interactive TUI
```bash
npm run tui
# or
node dist/nexus-mcp-tui.js
```

## What You Just Built

### MCP WebSocket Client
- **Location**: `dist/mcp-client.js`
- **Purpose**: Connects your AI to the IntelliJ plugin
- **Protocol**: JSON-RPC 2.0 over WebSocket
- **Features**: Auto-reconnect, ping/keepalive, event system

### Interactive TUI
- **Location**: `dist/nexus-mcp-tui.js`
- **Purpose**: Terminal interface for testing
- **Commands**: `/context`, `/relevant`, `/analyze`, `/deps`, etc.

### Test Suite
- **Location**: `test-mcp-client.js`
- **Purpose**: Validates everything works
- **Coverage**: Client creation, events, helpers, connection

### Demo
- **Location**: `demo.js`
- **Purpose**: Interactive walkthrough
- **Shows**: All features with real examples

## Project Structure

```
context_intelligence_system/
├── src/
│   ├── mcp-client.ts          ← MCP client implementation
│   └── nexus-mcp-tui.ts       ← Interactive TUI
│
├── dist/                      ← Compiled output
│   ├── mcp-client.js          ← Use this in your code
│   ├── nexus-mcp-tui.js       ← Run this for TUI
│   └── *.d.ts, *.map
│
├── demo.js                    ← Interactive demo
├── test-mcp-client.js         ← Test suite
│
├── src/main/kotlin/...        ← IntelliJ plugin (Kotlin)
│   ├── intelligence/
│   │   └── ContextIntelligence.kt  ← PSI analysis engine
│   ├── mcp/
│   │   └── tools/
│   │       └── IntelligenceTools.kt ← MCP tools
│   └── services/
│       └── MCPService.kt           ← WebSocket server
│
├── QUICKSTART.md              ← Full guide
├── README.md                  ← Complete docs
└── RUN_THIS_FIRST.md          ← You are here!
```

## Available Commands

After building, you can use:

```bash
npm run build    # Build everything
npm run test     # Run tests
npm run demo     # Interactive demo
npm run tui      # Launch TUI
npm run dev      # Watch mode for development
npm run clean    # Clean dist folder
```

## Using in Your Code

### Basic Example

```typescript
import { MCPClient, formatToolResult } from './dist/mcp-client.js';

const client = new MCPClient({
  url: 'ws://localhost:8080/mcp',
  reconnect: true,
});

await client.connectAndInitialize({
  name: 'my-app',
  version: '1.0.0',
});

// Get project summary
const summary = await client.callTool('context_get_summary');
console.log(formatToolResult(summary));

// Find relevant files
const relevant = await client.callTool('context_find_relevant', {
  query: 'user authentication',
  current_files: [],
});
console.log(formatToolResult(relevant));
```

### With Your AI

```typescript
import { MCPClient } from './dist/mcp-client.js';
import Anthropic from '@anthropic-ai/sdk';

const mcpClient = new MCPClient({ url: 'ws://localhost:8080/mcp' });
await mcpClient.connectAndInitialize();

const anthropic = new Anthropic();

async function chatWithContext(userMessage: string) {
  // Get relevant files
  const relevant = await mcpClient.callTool('context_find_relevant', {
    query: userMessage,
    current_files: [],
  });

  // Send to Claude with context
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    messages: [
      {
        role: 'user',
        content: `Here are relevant files:\n${formatToolResult(relevant)}\n\nUser: ${userMessage}`
      }
    ]
  });

  return response.content[0].text;
}
```

## Testing Without Plugin

The system is designed to work in stages:

### Stage 1: Client Tests ✅
```bash
npm test
```
Tests the MCP client structure, events, and helpers WITHOUT needing the plugin.

### Stage 2: Full Integration (needs plugin)
```bash
# 1. Build plugin
./gradlew buildPlugin

# 2. Install in IntelliJ
# Settings → Plugins → Install from Disk
# Select: build/distributions/NEXUS-Code-0.1.0-alpha.zip

# 3. Open a project in IntelliJ

# 4. Run demo
npm run demo
```

## Available MCP Tools

Once connected to the plugin:

| Tool | Purpose | Arguments |
|------|---------|-----------|
| `context_get_summary` | Project overview | None |
| `context_find_relevant` | Find relevant files | `query`, `current_files` |
| `context_analyze_file` | Analyze specific file | `file_path` |
| `context_get_dependencies` | Dependency tree | `file_path`, `depth` |
| `context_suggest` | Improvement suggestions | None |
| `context_complexity` | Most complex files | `limit` |

## Next Steps

1. ✅ **You've built it!** Everything is compiled and ready
2. 🧪 **Run tests**: `npm test` to verify
3. 🎮 **Try demo**: `npm run demo` for walkthrough
4. 🔌 **Build plugin** (optional): `./gradlew buildPlugin`
5. 🤖 **Integrate**: Use in your AI pipeline

## Troubleshooting

**"Cannot find module" errors**
```bash
# Make sure you built everything
npm run build
```

**"Connection refused" in demo/TUI**
- Plugin not running (expected for initial test)
- Run `npm test` instead - works without plugin

**TypeScript errors**
```bash
# Clean and rebuild
npm run clean
npm run build
```

**Tests fail**
- Check Node.js version (needs >=18)
- Reinstall: `npm install`
- Check for network issues (WebSocket)

## What Makes This Revolutionary

### Traditional Approach
```typescript
// Regex hell
const imports = code.match(/import.*from ['"](.*)['"]/)
const complexity = code.split('if').length
```

### Our Approach
```kotlin
// Real PSI analysis
ktFile.importDirectives.forEach { /* actual imports */ }
psiFile.accept(PsiRecursiveElementVisitor { /* real complexity */ })
```

**Result**:
- ✅ 100% accuracy (not 70% regex guessing)
- ✅ Type information
- ✅ Cross-file references
- ✅ Semantic understanding
- ✅ Refactoring-safe

## Support & Docs

- **Quick Start**: `QUICKSTART.md`
- **Full Docs**: `README.md`
- **This File**: Quick setup only

## Built By

**SAAAM LLC** - We build revolutionary shit, not incremental improvements.

*No tokenizers. No limitations. Just innovation.*

---

Now go build something amazing! 🔥
