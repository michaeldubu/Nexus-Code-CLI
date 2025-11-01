# 🔥 NEXUS Code - JetBrains Plugin

**AI-Powered Development Assistant for IntelliJ Platform**

> Built by SAAAM LLC 

---

## What This Is

A JetBrains IDE plugin that runs an **MCP (Model Context Protocol) server** inside your IDE, exposing **INTELLIGENT** code analysis to AI assistants like Claude.

### The SAAAM Difference

While Claude Code does basic file operations, NEXUS gives you:

✅ **Real PSI (Program Structure Interface) Analysis** - Not regex guessing
✅ **Context Intelligence Engine** - Knows your entire codebase
✅ **Smart File Discovery** - Auto-loads relevant files for AI
✅ **Dependency Graph** - Understands what imports what
✅ **Complexity Analysis** - Real AST-based cyclomatic complexity
✅ **Usage Tracking** - Who uses this code?
✅ **Intelligent Suggestions** - "This file needs tests", "This code is complex"
✅ **WebSocket MCP Server** - Standard protocol, works with any AI client

---

## Features

### 🧠 Context Intelligence

```
Claude: "How does authentication work?"

Plugin automatically:
1. Finds all auth-related files (LoginController.kt, AuthService.kt, JWT.kt)
2. Analyzes dependencies
3. Opens them for Claude
4. Claude sees FULL context without asking
```

**MCP Tools Exposed:**

- `context_get_summary` - Project overview (frameworks, languages, complexity)
- `context_find_relevant` - Find files for a query ("authentication", "user profile")
- `context_analyze_file` - Deep dive into a file (imports, exports, usage count)
- `context_get_dependencies` - Dependency tree visualization
- `context_suggest` - Get intelligent suggestions (missing tests, complex code)
- `context_complexity` - List files by complexity

### 🔧 How It Works

1. **Plugin starts with your project**
   - Scans entire codebase using IntelliJ's indexes
   - Builds dependency graph
   - Calculates complexity metrics
   - Ready in seconds (even for large projects)

2. **WebSocket MCP server runs on localhost**
   - Auth-protected (token in lock file)
   - JSON-RPC 2.0 protocol
   - Streams responses via WebSocket
   - Lock file: `.nexus-code/<port>.json`

3. **AI connects and gets superpowers**
   - "Find auth code" → Instant results
   - "Analyze this file" → Complete dependency map
   - "Suggest improvements" → Smart recommendations

---

## Installation

### Option 1: Build From Source

```bash
cd nexus-jetbrains-plugin
./gradlew buildPlugin

# Install the ZIP from:
build/distributions/nexus-jetbrains-plugin-0.1.0-alpha.zip

# In IntelliJ:
# File → Settings → Plugins → ⚙️ → Install Plugin from Disk
```

### Option 2: Install from JetBrains Marketplace (Coming Soon)

---

## Usage

### 1. Open a Project

Plugin auto-starts when you open a project:

```
🚀 NEXUS Code plugin starting...
🧠 Initializing Context Intelligence...
📊 Analyzed 453 files | 3 languages
✅ MCP Server started on ws://localhost:54321/mcp
```

### 2. Connect Your AI Client

Lock file at `.nexus-code/<port>.json`:

```json
{
  "port": 54321,
  "authToken": "uuid-here",
  "projectPath": "/path/to/project",
  "projectName": "MyApp"
}
```

### 3. AI Makes Requests

```typescript
// AI sends via WebSocket:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "context_find_relevant",
    "arguments": {
      "query": "authentication"
    }
  }
}

// Plugin responds with relevant files + reasons
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│       IntelliJ IDEA                                           │
│                                                                      │
│  ┌───────────────────────────────────┐    │
│  │  NEXUS Plugin                                   │    │
│  │  ┌─────────────────────────────┐    │     │
│  │  │ Context Intelligence                │    │     │
│  │  │ - PSI Analysis                           │    │     │
│  │  │ - Dependency Graph                 │     │    │
│  │  │ - Complexity Metrics                │     │    │
│  │  └─────────────────────────────┘     │     │
│  │  ┌─────────────────────────────┐     │     │
│  │  │ MCP WebSocket Server           │    │      │
│  │  │ - Port: 50000-60000                 │    │     │
│  │  │ - Protocol: JSON-RPC 2.0         │     │    │
│  │  │ - Auth: Token-based                 │     │     │
│  │  └─────────────────────────────┘     │     │
│  └───────────────────────────────────┘     │
└─────────────────────────────────────────┘
                    │
            WebSocket (MCP)
                    │
┌───────────────────▼─────────────────────┐
│     Nexus CLI / AI Client                                │
│     - Connects via WebSocket                        │
│     - Sends tool requests                                │
│     - Gets intelligent context                          │
└─────────────────────────────────────────┘
```

---

## Example: Real Usage

**User:** "Add authentication to the API endpoint"

**Without NEXUS:**
```
User: Can you read controllers/API.kt?
Claude: [reads]
User: Now read auth/AuthService.kt
Claude: [reads]
User: Also middleware/AuthCheck.kt
Claude: [reads]
User: OK now add auth
Claude: [finally implements]
```

**With NEXUS:**
```
User: Add authentication to the API endpoint

[Plugin auto-discovers:]
- controllers/API.kt (path matches "API")
- auth/AuthService.kt (dependency of API.kt)
- middleware/AuthCheck.kt (imported by AuthService.kt)
- config/Security.kt (co-changes with auth files)

Claude sees EVERYTHING and implements correctly on first try
```

---

## Tech Stack

- **Language**: Kotlin 2.0.21
- **Platform**: IntelliJ Platform 2024.3
- **Server**: Ktor 3.0.2 (WebSocket + SSE)
- **Serialization**: kotlinx.serialization
- **Coroutines**: kotlinx.coroutines 1.9.0
- **Build**: Gradle 8.x with Kotlin DSL

---

## Development

### Prerequisites

- JDK 21+
- IntelliJ IDEA 2024.3+
- Gradle 8.x

### Build

```bash
./gradlew build
```

### Run in IDE Sandbox

```bash
./gradlew runIde
```

This launches a sandboxed IDE with the plugin installed.

### Package for Distribution

```bash
./gradlew buildPlugin
# Output: build/distributions/nexus-jetbrains-plugin-*.zip
```

---

## Project Structure

```
src/main/kotlin/com/saaamllc/nexus/plugin/
├── intelligence/
│   └── ContextIntelligence.kt        # PSI-based code analysis
├── services/
│   ├── MCPService.kt                 # WebSocket MCP server
│   └── NexusIntelligenceService.kt   # Intelligence lifecycle
├── mcp/
│   ├── Protocol.kt                   # MCP protocol types
│   └── tools/
│       └── IntelligenceTools.kt      # MCP tool implementations
└── startup/
    └── PostStartupActivity.kt        # Auto-start on project open
```

---

## Configuration

No configuration needed! Plugin auto-starts and auto-configures.

**Optional:** Future releases will add:
- Custom port range
- Disable auto-start
- Performance tuning
- Custom tool registration

---

## Supported Languages

Via IntelliJ's PSI:
- ✅ Kotlin
- ✅ Java
- ✅ TypeScript/JavaScript
- ✅ Python
- ✅ Go, Rust, C/C++
- ✅ Any language IntelliJ supports

---

## Performance

| Project Size | Files | Init Time | Memory |
|--------------|-------|-----------|--------|
| Small        | <100  | 1-2s      | 50MB   |
| Medium       | 500   | 2-5s      | 100MB  |
| Large        | 2000  | 5-15s     | 200MB  |
| Huge         | 5000+ | 15-30s    | 500MB  |

**Note:** Uses IntelliJ's existing indexes, minimal overhead.

---

## Roadmap

### v0.2.0
- [ ] File operation tools (read, write, edit)
- [ ] Diff viewer with approve/reject
- [ ] Diagnostic tools (get errors from IDE)
- [ ] VCS integration (hot spot detection)

### v0.3.0
- [ ] Symbol-level analysis (not just files)
- [ ] Semantic code search
- [ ] Incremental updates on file change
- [ ] Performance profiling tools

### v1.0.0
- [ ] ML-powered relevance scoring
- [ ] Auto-refactoring suggestions
- [ ] Test coverage integration
- [ ] Security vulnerability detection

---

## License

MIT - Do whatever you want with it 🔥Just dont be an asshole, mention SAAAM LLC 🤘

---

## Contributing

Want to contribute? Hell yeah:
1. Fork it
2. Build sick features
3. Send PR


---

## Support

Issues: https://github.com/SAAAM-LLC/nexus-jetbrains-plugin/issues

---

**Built by Michael Wofford |  SAAAM LLC**

