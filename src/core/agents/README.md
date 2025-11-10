# Nexus Agent SDK Integration

The Nexus Agent SDK module provides a complete integration of the **Claude Agent SDK** with the Nexus Code CLI ecosystem. This allows you to leverage autonomous AI agents with specialized roles, multi-agent orchestration, and seamless access to Nexus tools.

## 🚀 Quick Start

```typescript
import { createNexusAgent, NexusAgentFactory } from './core/agents';
import { FileTools } from './core/tools/file-tools';
import { WebTools } from './core/tools/web-tools';
import { MemoryTool } from './core/tools/memory-tool';

// Initialize Nexus tools
const fileTools = new FileTools(process.cwd());
const webTools = new WebTools();
const memoryTool = new MemoryTool(process.cwd());

// Create an agent with Nexus tools integrated
const agent = createNexusAgent(fileTools, webTools, memoryTool, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  enableSubagents: true,
});

// Execute a query
const result = await agent.executeQuery(
  'Review the code in src/index.ts and suggest improvements'
);
```

## 📦 Components

### 1. AgentSDKManager

The core manager for interacting with the Claude Agent SDK. It handles:
- Query execution with streaming
- Session management and resumption
- Permission handling
- Custom tool integration
- Subagent delegation

```typescript
import { AgentSDKManager } from './core/agents';

const manager = new AgentSDKManager({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-5-20250929',
  enableSubagents: true,
  enableCustomTools: true,
  enableHooks: true,
});

// Execute a query
const result = await manager.executeQuery('What is the weather in SF?');

// Resume a previous session
const resumedResult = await manager.resumeSession(
  sessionId,
  'What about New York?'
);
```

### 2. AgentOrchestrator

Coordinates multiple agents working on complex tasks with different execution strategies.

```typescript
import { AgentOrchestrator } from './core/agents';

const orchestrator = new AgentOrchestrator({
  apiKey: process.env.ANTHROPIC_API_KEY,
  enableSubagents: true,
});

// Define tasks
orchestrator.addTasks([
  {
    id: 'analyze',
    description: 'Analyze the codebase architecture',
    agentType: 'architect',
  },
  {
    id: 'review',
    description: 'Review code for security issues',
    agentType: 'security-auditor',
    dependencies: ['analyze'], // Runs after analyze completes
  },
  {
    id: 'document',
    description: 'Create architecture documentation',
    agentType: 'documentation-writer',
    dependencies: ['analyze'],
  },
]);

// Execute with dependency-based strategy
const results = await orchestrator.execute({ strategy: 'conditional' });
console.log(orchestrator.getSummary());
```

**Execution Strategies:**
- **`sequential`** - Tasks run one after another
- **`parallel`** - Tasks run concurrently (with max concurrency limit)
- **`conditional`** - Tasks run based on dependencies (topological sort)

### 3. NexusAgentFactory

Factory for creating Agent SDK instances pre-configured with Nexus tools.

```typescript
import { NexusAgentFactory } from './core/agents';

const factory = new NexusAgentFactory(fileTools, webTools, memoryTool);

// Create specialized agents
const reviewer = factory.createCodeReviewer();
const tester = factory.createTestGenerator();
const architect = factory.createArchitect();
const securityAuditor = factory.createSecurityAuditor();
const docWriter = factory.createDocumentationWriter();

// Use the agent
const result = await reviewer.executeQuery('Review src/app.ts');
```

### 4. MCP Adapter

Bridges existing Nexus MCP tools with the Agent SDK, allowing agents to use:
- **File Tools** (read, write, edit, search, list)
- **Web Tools** (fetch, search)
- **Memory Tool** (store, recall, search)

All Nexus tools are automatically available to agents when using `NexusAgentFactory` or `createNexusAgent`.

## 🤖 Subagents

The Agent SDK comes with 5 pre-configured specialist agents:

### Code Reviewer
- **Role**: Expert code reviewer
- **Focus**: Bugs, security, performance, best practices
- **Tools**: Read, Grep, Glob
- **Model**: Sonnet

### Test Generator
- **Role**: Creates comprehensive test suites
- **Focus**: Unit tests, integration tests, edge cases
- **Tools**: Read, Write, Edit, Grep
- **Model**: Sonnet

### Documentation Writer
- **Role**: Technical documentation expert
- **Focus**: Clear docs, code examples, accessibility
- **Tools**: Read, Write, Edit, Grep, Glob
- **Model**: Sonnet

### Architect
- **Role**: System design expert
- **Focus**: Architecture, technology choices, scalability
- **Tools**: Read, Grep, Glob, Write
- **Model**: Opus (for complex reasoning)

### Security Auditor
- **Role**: Security expert
- **Focus**: OWASP Top 10, secure coding, vulnerabilities
- **Tools**: Read, Grep, Glob
- **Model**: Sonnet

## 🔧 Custom Tools

Create custom tools using Zod schemas:

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const myTools = createSdkMcpServer({
  name: 'my-tools',
  version: '1.0.0',
  tools: [
    tool(
      'greet',
      'Greet a user',
      {
        name: z.string().describe('Name to greet'),
        language: z.enum(['en', 'es', 'fr']).default('en'),
      },
      async (args) => {
        const greetings = {
          en: `Hello, ${args.name}!`,
          es: `¡Hola, ${args.name}!`,
          fr: `Bonjour, ${args.name}!`,
        };
        return {
          content: [{
            type: 'text' as const,
            text: greetings[args.language],
          }],
        };
      }
    ),
  ],
});

// Use in agent config
const agent = new AgentSDKManager({
  apiKey: process.env.ANTHROPIC_API_KEY,
  mcpServers: { 'my-tools': myTools },
  allowedTools: ['mcp__my-tools__greet'],
});
```

## 🔐 Permission System

Control what agents can do with permission modes:

```typescript
// Auto-approve file edits
await manager.executeWithPermissionMode(
  'Refactor the codebase',
  'acceptEdits'
);

// Bypass all permission checks (use carefully!)
await manager.executeWithPermissionMode(
  'Implement feature X',
  'bypassPermissions'
);
```

**Permission Modes:**
- `default` - Standard permission checks
- `acceptEdits` - Auto-approve file edits
- `bypassPermissions` - Skip all checks

## 🪝 Hooks

Monitor and track agent activities:

```typescript
const manager = new AgentSDKManager({
  enableHooks: true,
  onToolCall: (toolName) => console.log(`Tool used: ${toolName}`),
  onSessionUpdate: (sessionId) => console.log(`Session: ${sessionId}`),
  onError: (error) => console.error('Agent error:', error),
});
```

## 📝 Session Management

Continue conversations across multiple interactions:

```typescript
// First interaction
const result1 = await agent.executeQuery('Hello! My name is Michael.');
const sessionId = agent.getSessionId();

// Continue session
const result2 = await agent.executeQuery('What is my name?');
// Returns: "Your name is Michael"

// Fork session to explore different path
const forkedResult = await agent.forkSession(
  sessionId,
  'Tell me a joke instead'
);
```

## 🏗️ Integration with Nexus

The Agent SDK is integrated into the main Nexus CLI at startup:

```typescript
// In nexus-tui.ts
const agentFactory = new NexusAgentFactory(fileTools, webTools, memoryTool);

// Available in TUI component
const NexusTUI: React.FC<Props> = ({ ..., agentFactory }) => {
  // Use agentFactory when needed
  if (agentFactory) {
    const agent = agentFactory.createAgent();
    // ...
  }
};
```

The Agent SDK is **optional** and only initialized if `ANTHROPIC_API_KEY` is set. It works alongside the existing `UnifiedModelManager` without interfering with GPT or Gemini providers.

## 🎯 Examples

### Multi-Agent Code Review Pipeline

```typescript
const orchestrator = new AgentOrchestrator({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

orchestrator.addTasks([
  {
    id: 'security-scan',
    description: 'Scan for security vulnerabilities',
    agentType: 'security-auditor',
  },
  {
    id: 'code-review',
    description: 'Review code quality',
    agentType: 'code-reviewer',
  },
  {
    id: 'generate-tests',
    description: 'Generate missing tests',
    agentType: 'test-generator',
    dependencies: ['code-review'],
  },
]);

await orchestrator.execute({ strategy: 'conditional' });
```

### Architecture Planning

```typescript
const factory = new NexusAgentFactory(fileTools, webTools, memoryTool);
const architect = factory.createArchitect();

const result = await architect.executeQuery(`
  Design a scalable microservices architecture for an e-commerce platform.
  Include recommendations for:
  - Service boundaries
  - Data storage
  - Communication patterns
  - Deployment strategy
`);
```

## 🚨 Important Notes

1. **Backward Compatible**: The Agent SDK integration does NOT break existing GPT+Claude functionality. The `UnifiedModelManager` continues to work as before.

2. **Optional Feature**: Agent SDK is only available when `ANTHROPIC_API_KEY` is set. It gracefully handles missing keys.

3. **Tool Integration**: All existing Nexus tools (file, web, memory) are automatically available to agents via the MCP adapter.

4. **No UI Components Yet**: Agent visualization UI components are planned but not yet implemented. Current integration is programmatic only.

## 📚 API Reference

See the individual files for detailed API documentation:
- `agent-sdk-manager.ts` - Core SDK manager
- `agent-orchestrator.ts` - Multi-agent orchestration
- `nexus-agent-factory.ts` - Factory for creating agents
- `mcp-adapter.ts` - Nexus tool integration

## 🔜 Future Enhancements

- [ ] Agent visualization UI components
- [ ] Agent collaboration and communication
- [ ] Custom agent templates
- [ ] Agent performance metrics dashboard
- [ ] Integration with Nexus Skills system
- [ ] Multi-agent conversation support

---

For questions or issues, please refer to the main Nexus Code documentation or file an issue on GitHub.
