# Model Context Protocol (MCP) - Reverse-Engineered Specification

> **Source**: Decompiled from `kotlin-sdk-jvm-0.4.0.jar` and `claude-code-jetbrains-plugin-0.1.11-beta.jar`
>
> **Version**: Protocol 2024-11-05, JSON-RPC 2.0

---

## 🔥 Protocol Overview

MCP is a **JSON-RPC 2.0** protocol over **WebSocket** that enables bidirectional communication between:
- **Client** (Claude AI/CLI)
- **Server** (IDE Plugin/Tool Provider)

### Transport Layer
- **Protocol**: WebSocket (bidirectional, full-duplex)
- **Message Format**: JSON-RPC 2.0
- **Authentication**: Header-based token (`X-Claude-Code-Ide-Authorization`)
- **Endpoint**: `ws://localhost:<port>/mcp`

---

## 📦 Core Message Types

### Base Interface
```kotlin
interface JSONRPCMessage {
    // Union type of:
    // - JSONRPCRequest
    // - JSONRPCResponse
    // - JSONRPCNotification
    // - JSONRPCError
}
```

### 1. JSONRPCRequest
```json
{
  "jsonrpc": "2.0",
  "id": 1,  // String or Number (auto-incremented)
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": { "path": "/foo/bar.txt" }
  }
}
```

**Kotlin Class**:
```kotlin
@Serializable
data class JSONRPCRequest(
    val id: RequestId,  // NumberId(n) or StringId(s)
    val method: String,
    val params: JsonElement = EmptyJsonObject,
    val jsonrpc: String = "2.0"
) : JSONRPCMessage
```

### 2. JSONRPCResponse
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "File contents here" }
    ]
  },
  "error": null
}
```

**Kotlin Class**:
```kotlin
@Serializable
data class JSONRPCResponse(
    val id: RequestId,
    val jsonrpc: String = "2.0",
    val result: RequestResult? = null,
    val error: JSONRPCError? = null
) : JSONRPCMessage
```

### 3. JSONRPCNotification
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/selection_changed",
  "params": {
    "file_path": "/foo/bar.txt",
    "range": { "start": { "line": 10, "character": 5 }, "end": { "line": 10, "character": 20 } }
  }
}
```

**NO `id` field** (fire-and-forget, no response expected)

---

## 🎯 Method Types

### Client → Server Requests

#### 1. `initialize`
```json
{
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {}
    },
    "clientInfo": {
      "name": "Claude Code JetBrains Plugin",
      "version": "0.1.11-beta"
    }
  }
}
```

**Response**:
```json
{
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "logging": {},
      "prompts": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "My MCP Server",
      "version": "1.0.0"
    }
  }
}
```

#### 2. `tools/list`
```json
{
  "method": "tools/list",
  "params": {
    "cursor": null
  }
}
```

**Response**:
```json
{
  "result": {
    "tools": [
      {
        "name": "read_file",
        "description": "Read contents of a file",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "File path" }
          },
          "required": ["path"]
        }
      },
      {
        "name": "openDiff",
        "description": "Opens a diff viewer in the IDE",
        "inputSchema": {
          "type": "object",
          "properties": {
            "old_file_path": { "type": "string" },
            "new_file_contents": { "type": "string" },
            "tab_name": { "type": "string" }
          },
          "required": ["old_file_path", "new_file_contents"]
        }
      }
    ],
    "nextCursor": null
  }
}
```

#### 3. `tools/call`
```json
{
  "method": "tools/call",
  "params": {
    "name": "openDiff",
    "arguments": {
      "old_file_path": "src/main.ts",
      "new_file_contents": "console.log('Hello World');",
      "tab_name": "Fix main.ts"
    }
  }
}
```

**Response** (Success):
```json
{
  "result": {
    "content": [
      { "type": "text", "text": "FILE_SAVED" },
      { "type": "text", "text": "console.log('Hello World');" }
    ]
  }
}
```

**Response** (Rejected):
```json
{
  "result": {
    "content": [
      { "type": "text", "text": "DIFF_REJECTED" }
    ]
  }
}
```

#### 4. `ping`
```json
{
  "method": "ping",
  "params": {}
}
```

**Response**:
```json
{
  "result": {}
}
```

---

### Server → Client Notifications

#### 1. `notifications/initialized`
```json
{
  "method": "notifications/initialized",
  "params": {}
}
```

#### 2. `notifications/ide_connected`
```json
{
  "method": "notifications/ide_connected",
  "params": {
    "project_path": "/path/to/project"
  }
}
```

#### 3. `notifications/selection_changed`
```json
{
  "method": "notifications/selection_changed",
  "params": {
    "file_path": "src/main.ts",
    "range": {
      "start": { "line": 10, "character": 5 },
      "end": { "line": 15, "character": 20 }
    }
  }
}
```

#### 4. `notifications/tools/list_changed`
```json
{
  "method": "notifications/tools/list_changed",
  "params": {}
}
```

---

## 🔧 JetBrains Plugin Tools

### FileTools
- `open_file` - Open file in editor
- `close_tab` - Close tab
- `list_opened_files` - List currently opened files
- `reformat_file` - Reformat file using IDE formatter

### EditorTools
- `get_cursor_position` - Get current cursor position
- `set_cursor_position` - Set cursor position
- `get_selection` - Get current selection
- `set_selection` - Set selection range

### DiagnosticTools
- `get_diagnostics` - Get errors/warnings from IDE

**Response**:
```json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": JSON.stringify({
          "diagnostics": [
            {
              "file_path": "src/main.ts",
              "line": 10,
              "column": 5,
              "severity": "ERROR",
              "message": "Cannot find name 'foo'"
            }
          ]
        })
      }
    ]
  }
}
```

### DiffTools
- `openDiff` - Opens side-by-side diff viewer with approve/reject actions

---

## 🔐 Authentication

### Connection Flow
1. Client connects to `ws://localhost:<port>/mcp`
2. Server checks `X-Claude-Code-Ide-Authorization` header
3. If invalid: close with `CloseReason.VIOLATED_POLICY`
4. If valid: accept connection

### Lock File
The plugin creates a lock file at `.claude-code/<port>.json`:
```json
{
  "port": 12345,
  "authToken": "randomly-generated-token",
  "projectPath": "/path/to/project"
}
```

---

## 🚀 Connection Lifecycle

### 1. Handshake
```
Client → Server: initialize
Server → Client: initialize response
Client → Server: notifications/initialized
```

### 2. Tool Discovery
```
Client → Server: tools/list
Server → Client: tools/list response
```

### 3. Tool Execution
```
Client → Server: tools/call
Server: (executes tool, may show UI)
Server → Client: tools/call response
```

### 4. Health Check
```
Client → Server: ping (every 5 seconds)
Server → Client: ping response
```

### 5. Disconnection
```
Client: closes WebSocket
Server: cleanup resources, delete lock file
```

---

## 📊 Error Handling

### Error Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32600,
    "message": "Invalid Request",
    "data": { "details": "..." }
  }
}
```

### Standard Error Codes (JSON-RPC 2.0)
- `-32700` Parse error
- `-32600` Invalid Request
- `-32601` Method not found
- `-32602` Invalid params
- `-32603` Internal error

---

## 🎨 Tool Result Format

All tool results use this format:
```json
{
  "content": [
    { "type": "text", "text": "result data here" }
  ],
  "isError": false
}
```

For errors:
```json
{
  "content": [
    { "type": "text", "text": "Error message" }
  ],
  "isError": true
}
```

---

## 🔄 Async Operations (CompletableDeferred)

The JetBrains plugin uses **Kotlin coroutines** with `CompletableDeferred` to handle async tool execution:

```kotlin
val result = CompletableDeferred<CallToolResult>()

// Show UI (diff viewer, approval dialog, etc.)
showDiffViewer(onApprove = {
  result.complete(CallToolResult(...))
})

// Wait for user action
return result.await()
```

This pattern allows:
- Tools to block until user interaction completes
- Clean async/await flow
- Automatic timeout handling

---

## 🧪 Example Session

```
# 1. Connect
→ WebSocket CONNECT ws://localhost:54321/mcp
← 101 Switching Protocols

# 2. Initialize
→ {"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}
← {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",...}}

→ {"jsonrpc":"2.0","method":"notifications/initialized","params":{}}

# 3. List Tools
→ {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
← {"jsonrpc":"2.0","id":2,"result":{"tools":[...]}}

# 4. Call Tool
→ {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"openDiff",...}}
← {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"FILE_SAVED"}]}}

# 5. Ping
→ {"jsonrpc":"2.0","id":4,"method":"ping","params":{}}
← {"jsonrpc":"2.0","id":4,"result":{}}

# 6. Disconnect
→ WebSocket CLOSE
```

---

## 🛠️ Implementation Notes

### Server-Side (Plugin)
- Use **Ktor** for WebSocket server
- Use **kotlinx.serialization** for JSON
- Implement `Protocol` class for request/response handling
- Use `CompletableDeferred` for async tool execution
- Health check: ping every 5s, remove dead connections

### Client-Side (CLI)
- Use **WebSocket client** library
- Send `initialize` first, wait for response
- Send `notifications/initialized` after initialize
- Call `tools/list` to discover available tools
- Handle tool responses (success/error/rejection)

---

## 📚 Key Classes

```kotlin
// Base protocol handler
abstract class Protocol(options: ProtocolOptions) {
    suspend fun request(message: JSONRPCRequest): JSONRPCResponse
    suspend fun notification(message: JSONRPCNotification)
    fun addTool(name: String, description: String, inputSchema: JsonObject, handler: suspend (CallToolRequest) -> CallToolResult)
}

// Server implementation
class Server(serverInfo: Implementation, options: ServerOptions) : Protocol(options) {
    fun addTool(...) // Register tool handlers
    suspend fun connect(transport: Transport) // Start serving
}

// Client implementation
class Client(clientInfo: Implementation, options: ClientOptions) : Protocol(options) {
    suspend fun callTool(request: CallToolRequest): CallToolResult
    suspend fun listTools(): ListToolsResult
}

// Transport abstraction
interface Transport {
    suspend fun send(message: JSONRPCMessage)
    suspend fun start()
    suspend fun close()
    fun onMessage(handler: suspend (JSONRPCMessage) -> Unit)
    fun onError(handler: (Throwable) -> Unit)
    fun onClose(handler: () -> Unit)
}

// WebSocket transport
class WebSocketMcpTransport(val session: WebSocketSession) : Transport {
    // Handles WebSocket frame serialization/deserialization
}
```

---

## 🎯 Next Steps

1. **Implement MCP Client in TypeScript** for Nexus CLI
2. **Build Custom JetBrains Plugin** with our own tools
3. **Add DiffViewer tool** with terminal UI
4. **Extend with custom IDE integrations** (refactoring, code generation, etc.)

---

**Generated from**: Decompiled JARs using CFR 0.152
**Author**: SAAAM LLC
**Date**: 2025-01-23
