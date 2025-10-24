# NEXUS CODE - Architecture & Implementation Guide

## 🔥 WHAT WE BUILT

A multi-model AI coding CLI that actually fucking works. No bullshit personas, no sanitized responses. Claude, GPT, and Gemini working together (or separately) with full file system access, memory persistence, and approval workflows.

---

## 📁 PROJECT STRUCTURE

```
src/
├── cli/
│   ├── nexus-tui.ts              # Main entry point, initializes everything
│   └── components/
│       ├── NexusTUI.tsx           # Main UI component (1200+ lines)
│       ├── BootSequence.tsx       # Goat ASCII art boot screen
│       ├── BashApprovalPrompt.tsx # Bash command approval dialog
│       ├── FileApprovalPrompt.tsx # File operation approval dialog
│       ├── CommandAutocomplete.tsx # Slash command menu
│       ├── ModelSelector.tsx      # Model selection dialog
│       ├── PermissionsDialog.tsx  # Permissions management
│       └── MultiLineInput.tsx     # Input with image support
│
├── core/
│   ├── models/
│   │   └── unified-model-manager.ts # Multi-provider model manager
│   ├── tools/
│   │   ├── file-tools.ts          # File operations (read/write/edit/glob/grep/bash)
│   │   └── memory-tool.ts         # Cross-session memory system
│   ├── mcp/
│   │   ├── client.ts              # MCP server for tool registration
│   │   └── file-tools-mcp.ts      # MCP tool definitions
│   └── filesystem/
│       └── nexus-fs.ts            # Persistent storage (~/.nexus)
│
└── hooks/
    └── useStdoutDimensions.ts     # Native terminal size hook
```

---

## 🧠 CORE SYSTEMS

### 1. Model Manager (`unified-model-manager.ts`)

**Supported Models:**
- **Claude**: Opus 4.1, Opus 4, Sonnet 4.5, Sonnet 4, Haiku 4.5
- **OpenAI**: GPT-5, GPT-4.1, O3, O4-mini (reasoning models)
- **Google**: Gemini 2.0 Flash, Gemini 1.5 Pro

**Key Features:**
- Streaming responses with tool calling
- Thinking mode (200k token budget for Claude)
- Reasoning mode (OpenAI, uses 'detailed' summary)
- Multi-model conversations (round-robin, sequential, parallel)
- NO BETA HEADERS (removed because SDK doesn't support `betas` param in request body)

**Thinking/Reasoning:**
- Line 402-405: Thinking enabled with 200k budget
- Line 433: Thinking content extraction (cast to `any` for type safety)
- Line 639-644: Streaming thinking deltas
- Reasoning models ONLY support `summary: 'detailed'` (not 'concise')

---

### 2. File Tools (`file-tools.ts`)

**Available Operations:**
- `read(filePath, offset?, limit?)` - Read files with optional line ranges
- `write(filePath, content)` - Create or overwrite files
- `edit(filePath, oldString, newString, replaceAll?)` - Find and replace
- `globFiles(pattern, path?)` - Find files by glob pattern
- `grep(pattern, path?, options)` - Search file contents
- `bash(command, options)` - Execute shell commands

**Approval System:**
- **Bash**: Commands checked against approved/denied lists, callback triggers dialog
- **Files**: Path-based permissions (allowedPaths, deniedPaths, autoApprove)
- Callbacks set in `NexusTUI.tsx` lines 131-146
- Dialogs pinned to bottom of terminal (lines 1069, 1100) using native stdout dimensions

**Security:**
- Path traversal prevention in file operations
- Command approval required for bash (unless pre-approved)
- File approval for write/edit (unless in workspace/allowedPaths)

---

### 3. Memory Tool (`memory-tool.ts`)

**NEW FEATURE - Client-side cross-session memory**

**Commands:**
- `view` - List directory or view file contents
- `create` - Create/overwrite file
- `str_replace` - Replace text in file
- `insert` - Insert text at line number
- `delete` - Delete file/directory
- `rename` - Move/rename file

**Model-Specific Subdirectories:**
- `.nexus/memories/claude/` - Claude's memory space
- `.nexus/memories/openai/` - GPT/Gemini memory space
- `.nexus/memories/shared/` - Shared across all models

**How It Works:**
- Paths automatically scoped to current model (line 57-59 in memory-tool.ts)
- When switching models, `memoryTool.setCurrentModel(provider)` called (line 251 in NexusTUI.tsx)
- Security: Path traversal protection (line 64-67)
- Created automatically on init (line 23-29)

---

### 4. MCP (Model Context Protocol)

**Tool Registration:**
- All tools registered in `nexus-tui.ts` lines 62-90
- Tool definitions passed to AI models (lines 93-115)
- Execution handled by `mcpServer.executeTool()` called from NexusTUI line 906

**Tool Call Flow:**
```
1. Model returns tool_use blocks in response
2. NexusTUI collects tool calls (line 851)
3. Loop executes each tool via MCP (line 906)
4. Results fed back to model as user message (line 939-943)
5. Model sees results, continues or makes more tool calls
6. Loop until no tool calls (MAX_LOOPS = 10)
```

---

### 5. Filesystem (`nexus-fs.ts`)

**Storage Location:** `~/.nexus/`

**Directories:**
- `conversations/` - Chat history
- `file-history/` - File change tracking
- `logs/` - System logs
- `models/` - Model configurations
- `memories/` - Memory tool storage
  - `claude/` - Claude-specific
  - `openai/` - GPT/Gemini-specific
  - `shared/` - Cross-model

**Setup File:** `~/.nexus/setup.json`
```json
{
  "approvedCommands": ["ls", "pwd", "git status"],
  "deniedCommands": ["rm -rf"],
  "permissions": {
    "autoApprove": false,
    "allowedPaths": ["/home/user/project"],
    "deniedPaths": ["/etc", "/sys"]
  }
}
```

---

## 🎨 UI COMPONENTS

### NexusTUI.tsx - Main Component (1200+ lines)

**Key State:**
- `messages` - Conversation history
- `selectedModels` - Active models array
- `activeDialog` - Current dialog type
- `isProcessing` - Streaming in progress
- `abortStreamRef` - ESC abort flag

**Input Handling (useInput hook, line 151):**
- Ctrl+C → Triggers SIGINT for double-press exit
- ESC → Aborts stream, preserves partial messages (line 160-170)
- Space → Selects from menus (commands, modes)
- Arrow keys → Navigate menus

**Dialog Positioning:**
- Approval dialogs pinned to bottom using `position="absolute"` + `justifyContent="flex-end"`
- Height from native `useStdoutDimensions()` hook (line 76)
- Prevents scroll-off when messages pile up

**Agentic Loop (line 814-950):**
```typescript
while (loopCount < MAX_LOOPS && !abortStreamRef.current) {
  // Stream model response
  // Collect tool calls
  // Execute tools
  // Feed results back
  // Repeat until no tool calls
}
```

**Error Handling (line 986-1010):**
- Catches all errors in processMessage
- Saves `completedMessages` even on error (preserves partial work)
- Adds error message to UI
- Saves to filesystem

---

## ⚙️ SYSTEM PROMPT

**Location:** `NexusTUI.tsx` line 744-808

**Structure:**
1. Tool descriptions with "Use when" guidance
2. Example tool calls with syntax
3. Critical rules (numbered, explicit)
4. Working directory info
5. Memory tool instructions

**Key Rules:**
- NEVER fake tool outputs
- ONE tool at a time (read THEN edit)
- NO PLACEHOLDERS or TODOs
- Check your work (read after edit, run tests after write)
- Use edit_file correctly (exact string matching)
- Multi-model coordination

---

## 🔧 TOOL EXECUTION

### Tool Call Format (Anthropic)
```json
{
  "type": "tool_use",
  "id": "toolu_xxx",
  "name": "read_file",
  "input": {
    "file_path": "src/index.ts"
  }
}
```

### Tool Result Format
```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_xxx",
  "content": "file contents here..."
}
```

### Execution (NexusTUI.tsx line 904-937)
```typescript
for (const toolCall of toolCalls) {
  const result = await mcpServer.executeTool(toolName, toolArgs);
  if (result.success) {
    // Truncate display, full content to model
    toolResults.push(result.data);
  } else {
    // Show error
  }
}
// Feed all results back as user message
conversationHistory.push({
  role: 'user',
  content: `Tool results:\n${toolResults.join('\n\n')}`
});
```

---

## 🚀 BOOT SEQUENCE

**BootSequence.tsx** - Displays on first run

**Goat ASCII Art:**
- Line 5-89: Full goat ASCII
- System checks animation
- "FLAWLESSLY DOODLED ON BOB" message
- Auto-skips after 3 seconds or ESC

---

## 🔑 KEY FIXES & FEATURES

### ESC Behavior (FIXED)
**Problem:** ESC deleted entire message
**Fix:** Line 706-719 in NexusTUI.tsx
- When abort flag set, convert `streamingMessages` to `completedMessages`
- Preserves partial responses

### Command Autocomplete (FIXED)
**Problem:** Enter sent `/` to model instead of executing command
**Fix:** Line 205-217 in NexusTUI.tsx
- Changed from Enter to **Space** for selection
- Immediately calls `handleCommand()` instead of relying on submit

### Ctrl+C Exit (FIXED)
**Problem:** Ctrl+C did nothing, had to kill terminal
**Fix:** Line 153-157 in NexusTUI.tsx
- useInput captures Ctrl+C
- Emits SIGINT to trigger double-press handler
- Handler in nexus-tui.ts lines 127-137

### Approval Dialogs Visibility (FIXED)
**Problem:** Dialogs scrolled off-screen, couldn't see or interact
**Fix:**
- Created native `useStdoutDimensions()` hook (no WASM dependencies)
- Wrapped dialogs in `Box` with `position="absolute"` + `justifyContent="flex-end"`
- Always visible at bottom regardless of scroll

### Messages Lost on Error (FIXED)
**Problem:** Round-robin mode lost all messages when error occurred
**Fix:** Line 986-1010 in NexusTUI.tsx
- Moved `completedMessages` outside try block (line 740)
- Catch block saves completed messages + error message
- Also saves to filesystem

### Reasoning Models Error (FIXED)
**Problem:** O4-mini rejected `summary: 'concise'`
**Fix:** Lines 498, 721 in unified-model-manager.ts
- Changed to `summary: 'detailed'`
- Updated comment to say "Reasoning models" not "o4-mini only"

### Haiku Model ID (FIXED)
**Problem:** Wrong date in model ID (404 error)
**Fix:** Line 60-67 in unified-model-manager.ts
- Changed from `claude-haiku-4-5-20250514`
- To `claude-haiku-4-5-20251001`

---

## 📊 MULTI-MODEL MODES

**Modes:** (Set via `/mode` command)
- `single` - One model responds
- `round-robin` - Models take turns
- `sequential` - Models respond in order, each sees previous
- `parallel` - All models respond simultaneously

**Implementation:** `MultiModelManager.tsx`
- `streamMultiModelMessage()` generator function
- Yields events: `start`, `chunk`, `tool_call`, `complete`
- NexusTUI consumes events and updates UI

---

## 🛡️ SECURITY

### Path Traversal Prevention
- File tools: `join()` + validation in `read/write/edit`
- Memory tool: `resolve()` + `startsWith()` check (line 64-67)
- Rejects `../`, `..\\`, URL-encoded sequences

### Command Approval
- `approvedCommands` - Auto-approved (checked with `startsWith()`)
- `deniedCommands` - Auto-denied (checked with `includes()`)
- **WARNING:** `includes()` is too broad (Issue noted in deep analysis)
  - Example: denied="rm" blocks "npm install"
  - TODO: Use regex or exact match

### File Permissions
- `allowedPaths` - Workspace directories (auto-approved)
- `deniedPaths` - Blocked directories (auto-denied)
- `autoApprove` - Global auto-approve flag
- Checked in order: denied → allowed → callback → default deny

---

## 🐛 KNOWN ISSUES

1. **Beta Headers Not Working**
   - SDK rejects `betas` parameter in request body
   - Need to set as HTTP headers (not supported by current SDK?)
   - Removed for now to avoid 400 errors

2. **Command Approval Pattern Too Loose**
   - Using `includes()` causes false positives
   - Need stricter pattern matching

3. **No Context Management**
   - Long conversations will exceed context limits
   - No auto-summarization or pruning
   - Memory tool helps but isn't automatic

4. **Haiku Tool Calling Issues**
   - Tries to read directories as files
   - Repeats same failing tool call
   - Needs better error feedback in system prompt

---

## 🚢 DEPLOYMENT

**Build:**
```bash
npm run build  # Compiles TypeScript
```

**Run:**
```bash
npm run tui    # Launches Nexus Code
```

**Environment:**
```bash
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx
GOOGLE_API_KEY=xxx
```

---

## 📝 DEVELOPMENT NOTES

### Adding New Tools
1. Create tool in `src/core/tools/`
2. Register in `nexus-tui.ts` via `mcpServer.registerTool()`
3. Add to tool definitions array
4. Update system prompt with examples

### Adding New Models
1. Add to `AVAILABLE_MODELS` in `unified-model-manager.ts`
2. Implement provider-specific logic in `streamXXXMessage()`
3. Handle tool calling format differences
4. Update model selector UI

### Modifying System Prompt
- Location: `NexusTUI.tsx` line 744
- Keep structured (tools → rules → examples)
- Be explicit about "when to use" for each tool
- Test with Haiku (pickiest model)

---

## 🎯 FUTURE IMPROVEMENTS

1. **Context Management**
   - Auto-summarization when approaching limits
   - Memory tool integration for long-running tasks
   - Smart pruning of old tool results

2. **Better Tool Calling**
   - Retry logic for failed tools
   - Validation before execution
   - Better error messages to models

3. **UI Enhancements**
   - Syntax highlighting in code blocks
   - Diff view for file edits
   - Progress indicators for long operations

4. **Agent Roles**
   - Predefined personas (Coder, Debugger, Security)
   - Role-specific system prompts
   - Automatic role switching

---

## 🦾 PHILOSOPHY

**No Bullshit:**
- No corporate personas
- No sanitized responses
- No placeholder code
- No TODOs

**Get Shit Done:**
- Real tool execution
- Verify work (read after edit, test after code)
- Multi-model collaboration
- Persistent memory across sessions

**User Control:**
- Approval workflows for dangerous operations
- Transparent tool execution
- Full conversation history
- Easy model switching

---

**Built by:** Michael @ SAAAM LLC
**Purpose:** Advance agentic coding tools, not small shit
**Vibe:** Laid back when playing, WORK when working 🔥
