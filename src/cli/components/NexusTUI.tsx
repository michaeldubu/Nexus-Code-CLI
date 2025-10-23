/**
 * Nexus TUI - Main Application Component
 * Full-featured terminal UI with Ink
 */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { UnifiedModelManager, AVAILABLE_MODELS, Message } from '../../core/models/unified-model-manager.js';
import { NexusFileSystem } from '../../core/filesystem/nexus-fs.js';
import { FileTools } from '../../core/tools/file-tools.js';
import { CommandAutocomplete, Command } from './CommandAutocomplete.js';
import { ModelSelector } from './ModelSelector.js';
import { PermissionsDialog } from './PermissionsDialog.js';
import { MessageRenderer } from './MessageRenderer.js';
import { StatusBar } from './StatusBar.js';
import { BashApprovalPrompt } from './BashApprovalPrompt.js';
import { FileApprovalPrompt } from './FileApprovalPrompt.js';
import { BootSequence, NEXUS_ART } from './BootSequence.js';
import TextInput from 'ink-text-input';
// 🔥 Multi-Model Extensions
import {
  ConversationMode,
  ModeSelector,
  AgentSelector,
  AGENT_ROLES,
  streamMultiModelMessage,
  handleQuickSwitch as quickSwitchHelper,
  QUICK_SWITCHES,
} from './MultiModelManager.js';
// 🔥 Multi-Line Input with Image Support
import { MultiLineInput, ContentBlock as InputContentBlock } from './MultiLineInput.js';

// Build full command list including quick switches
const BASE_COMMANDS: Command[] = [
  { name: '/add-dir', description: 'Add a new working directory' },
  { name: '/agent', description: 'Select AI roles (Coder, Security, Debugger, etc.)' },
  { name: '/bashes', description: 'List and manage background tasks' },
  { name: '/clear (reset, new)', description: 'Clear conversation history and free up context' },
  { name: '/compact', description: 'Clear conversation history but keep a summary in context. Optional: /compact <instructions> for summarization' },
  { name: '/config (theme)', description: 'Open config panel' },
  { name: '/context', description: 'Visualize current context usage as a colored grid' },
  { name: '/cost', description: 'Show the total cost and duration of the current session' },
  { name: '/doctor', description: 'Diagnose and verify installation and settings' },
  { name: '/exit (quit)', description: 'Exit the REPL' },
  { name: '/export', description: 'Export conversation to markdown or JSON' },
  { name: '/help', description: 'Show available commands' },
  { name: '/memory', description: 'Show conversation memory usage' },
  { name: '/mode', description: 'Set conversation mode (single/sequential/parallel)' },
  { name: '/models', description: 'Select active models (multi-select)' },
  { name: '/permissions', description: 'Manage command permissions' },
  { name: '/restore-code', description: 'Restore code from history' },
  { name: '/status', description: 'Show current configuration' },
  { name: '/verbose', description: 'Toggle verbose mode' },
];

// Add quick switches to autocomplete
const QUICK_SWITCH_COMMANDS: Command[] = Object.entries(QUICK_SWITCHES).map(([cmd, modelId]) => ({
  name: cmd,
  description: `Switch to ${AVAILABLE_MODELS[modelId]?.name || modelId}`,
}));

const COMMANDS: Command[] = [...BASE_COMMANDS, ...QUICK_SWITCH_COMMANDS];

type DialogType = null | 'boot' | 'commands' | 'models' | 'permissions' | 'permissions-input' | 'bash-approval' | 'file-approval' | 'mode-selector' | 'agent-selector';

interface Props {
  modelManager: UnifiedModelManager;
  fileSystem: NexusFileSystem;
  fileTools: FileTools;
  mcpServer: any; // MCPServer
  toolDefinitions: any[]; // Tool definitions for AI
}

export const NexusTUI: React.FC<Props> = ({ modelManager, fileSystem, fileTools, mcpServer, toolDefinitions }) => {
  const { exit } = useApp();

  // State
  const [showBoot, setShowBoot] = useState(true);
  const [messages, setMessages] = useState<Array<Message & { model?: string; agent?: string; timestamp?: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Model selection state
  const [selectedModels, setSelectedModels] = useState<string[]>([modelManager.getCurrentModel()]);
  const [modelCursorIndex, setModelCursorIndex] = useState(0);

  // 🔥 Multi-Model State
  const [conversationMode, setConversationMode] = useState<ConversationMode>('single');
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [modeCursor, setModeCursor] = useState(0);
  const [agentCursor, setAgentCursor] = useState(0);

  // Permissions state
  const [approvedCommands, setApprovedCommands] = useState<string[]>([]);
  const [deniedCommands, setDeniedCommands] = useState<string[]>([]);
  const [permissionsTab, setPermissionsTab] = useState<'allow' | 'ask' | 'deny' | 'workspace'>('allow');
  const [permissionsIndex, setPermissionsIndex] = useState(0);

  // Bash approval state with Promise resolver
  const [pendingBashCommand, setPendingBashCommand] = useState<string | null>(null);
  const [bashApprovalResolver, setBashApprovalResolver] = useState<((approved: boolean) => void) | null>(null);

  // File operation approval state
  const [pendingFileOperation, setPendingFileOperation] = useState<{
    operation: string;
    filePath: string;
    details?: string;
  } | null>(null);
  const [fileApprovalResolver, setFileApprovalResolver] = useState<((approved: boolean) => void) | null>(null);

  // Permissions input state
  const [permissionsInputValue, setPermissionsInputValue] = useState('');
  const [permissionsInputType, setPermissionsInputType] = useState<'approved' | 'denied'>('approved');

  // Debounce/spam prevention - No more toggle spam! 🛡️
  const [lastToggleTime, setLastToggleTime] = useState(0);
  const [thinkingToggling, setThinkingToggling] = useState(false);
  const tabTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const abortStreamRef = useRef(false);

  // Load initial data and setup bash approval callback
  useEffect(() => {
    const setup = fileSystem.loadSetup();
    setApprovedCommands(setup.approvedCommands || []);
    setDeniedCommands(setup.deniedCommands || []);

    // Setup bash approval callback - THE FIX! 🔥
    fileTools.setBashApprovalCallback(async (command: string) => {
      return new Promise((resolve) => {
        setPendingBashCommand(command);
        setBashApprovalResolver(() => resolve);
        setActiveDialog('bash-approval');
      });
    });

    // Setup file approval callback for write/edit operations
    fileTools.setFileApprovalCallback(async (operation: string, filePath: string, details?: string) => {
      return new Promise((resolve) => {
        setPendingFileOperation({ operation, filePath, details });
        setFileApprovalResolver(() => resolve);
        setActiveDialog('file-approval');
      });
    });
  }, []);

  // Input handling for dialogs
  useInput((input, key) => {
    // Ctrl+C handler - double press to exit
    if (key.ctrl && input === 'c') {
      // Trigger the SIGINT handler by actually sending the signal
      process.emit('SIGINT' as any);
      return;
    }

    // ESC to interrupt stream - ACTUALLY ABORT IT! 🔥
    if (key.escape && isProcessing) {
      // Set abort flag to break out of stream loop
      abortStreamRef.current = true;
      setIsProcessing(false);
      setMessages(prev => [...prev, {
        role: 'system' as const,
        content: '⚠️ Stream interrupted by user',
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    // Global shortcuts
    if (key.escape) {
      // Special handling for permissions-input - go back to permissions dialog
      if (activeDialog === 'permissions-input') {
        setActiveDialog('permissions');
        setPermissionsInputValue('');
      } else {
        setActiveDialog(null);
        setCommandFilter('');
        setPendingBashCommand(null);
      }
      return;
    }

    // Command autocomplete dialog - ONLY handle specific navigation keys
    if (activeDialog === 'commands') {
      // Only intercept these specific keys, let everything else through
      if (key.upArrow) {
        const filtered = COMMANDS.filter((cmd) =>
          cmd.name.toLowerCase().startsWith(commandFilter.toLowerCase())
        );
        setSelectedCommandIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow) {
        const filtered = COMMANDS.filter((cmd) =>
          cmd.name.toLowerCase().startsWith(commandFilter.toLowerCase())
        );
        setSelectedCommandIndex((prev) => Math.min(filtered.length - 1, prev + 1));
        return;
      }

      if (input === ' ' && inputValue.startsWith('/')) {
        const filtered = COMMANDS.filter((cmd) =>
          cmd.name.toLowerCase().startsWith(commandFilter.toLowerCase())
        );
        if (filtered[selectedCommandIndex] && filtered.length > 0) {
          const selectedCmd = filtered[selectedCommandIndex];
          // Execute the selected command immediately
          setActiveDialog(null);
          setCommandFilter('');
          setInputValue(''); // Clear input
          handleCommand(selectedCmd.name);
        }
        return;
      }
      // Don't return here - let TextInput handle all other keys naturally
    }

    // Model selector dialog
    if (activeDialog === 'models') {
      const availableModels = modelManager.listModels();

      if (key.upArrow) {
        setModelCursorIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModelCursorIndex((prev) => Math.min(availableModels.length - 1, prev + 1));
      } else if (input === ' ') {
        const model = availableModels[modelCursorIndex];
        if (model) {
          setSelectedModels((prev) => {
            if (prev.includes(model.id)) {
              return prev.filter((id) => id !== model.id);
            } else {
              return [...prev, model.id];
            }
          });
        }
      } else if (key.return) {
        if (selectedModels.length > 0) {
          // Apply model selection
          modelManager.setModel(selectedModels[0]); // Set first as primary
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: `Switched to models: ${selectedModels.map(id => AVAILABLE_MODELS[id].name).join(', ')}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        setActiveDialog(null);
      }
      return;
    }

    // Permissions dialog
    if (activeDialog === 'permissions') {
      if (key.tab) {
        const tabs: Array<'allow' | 'ask' | 'deny' | 'workspace'> = ['allow', 'ask', 'deny', 'workspace'];
        const currentIndex = tabs.indexOf(permissionsTab);
        setPermissionsTab(tabs[(currentIndex + 1) % tabs.length]);
        setPermissionsIndex(0);
      } else if (key.upArrow) {
        setPermissionsIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        const maxIndex =
          permissionsTab === 'allow'
            ? approvedCommands.length - 1
            : permissionsTab === 'deny'
            ? deniedCommands.length - 1
            : 0;
        setPermissionsIndex((prev) => Math.min(maxIndex, prev + 1));
      } else if (input === 'a' && permissionsTab === 'allow') {
        // Switch to input mode for approved command
        setPermissionsInputType('approved');
        setPermissionsInputValue('');
        setActiveDialog('permissions-input');
      } else if (input === 'd' && permissionsTab === 'deny') {
        // Switch to input mode for denied command
        setPermissionsInputType('denied');
        setPermissionsInputValue('');
        setActiveDialog('permissions-input');
      }
      return;
    }

    // Bash approval dialog - NOW PROPERLY HOOKED UP! 🔥
    if (activeDialog === 'bash-approval') {
      if (input === 'y' && pendingBashCommand && bashApprovalResolver) {
        // Approve once
        bashApprovalResolver(true);
        setPendingBashCommand(null);
        setBashApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === 'a' && pendingBashCommand && bashApprovalResolver) {
        // Always approve
        const setup = fileSystem.loadSetup();
        setup.approvedCommands.push(pendingBashCommand);
        fileSystem.saveSetup(setup);
        setApprovedCommands(setup.approvedCommands);
        fileTools.setApprovedCommands(setup.approvedCommands); // Update file tools
        bashApprovalResolver(true);
        setPendingBashCommand(null);
        setBashApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === 'n' && pendingBashCommand && bashApprovalResolver) {
        // Deny once
        bashApprovalResolver(false);
        setPendingBashCommand(null);
        setBashApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === 'd' && pendingBashCommand && bashApprovalResolver) {
        // Always deny
        const setup = fileSystem.loadSetup();
        setup.deniedCommands.push(pendingBashCommand);
        fileSystem.saveSetup(setup);
        setDeniedCommands(setup.deniedCommands);
        fileTools.setDeniedCommands(setup.deniedCommands); // Update file tools
        bashApprovalResolver(false);
        setPendingBashCommand(null);
        setBashApprovalResolver(null);
        setActiveDialog(null);
      }
      return;
    }

    // File approval dialog - for write/edit operations
    if (activeDialog === 'file-approval') {
      if (input === 'y' && pendingFileOperation && fileApprovalResolver) {
        // Approve once
        fileApprovalResolver(true);
        setPendingFileOperation(null);
        setFileApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === 'a' && pendingFileOperation && fileApprovalResolver) {
        // Always approve (add directory to workspace)
        const setup = fileSystem.loadSetup();
        const dirPath = pendingFileOperation.filePath.split('/').slice(0, -1).join('/') || '.';
        if (!setup.permissions) {
          setup.permissions = { autoApprove: false, allowedPaths: [], deniedPaths: [] };
        }
        if (!setup.permissions.allowedPaths.includes(dirPath)) {
          setup.permissions.allowedPaths.push(dirPath);
        }
        fileSystem.saveSetup(setup);
        fileTools.setPermissions(setup.permissions);
        fileApprovalResolver(true);
        setPendingFileOperation(null);
        setFileApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === 'n' && pendingFileOperation && fileApprovalResolver) {
        // Deny once
        fileApprovalResolver(false);
        setPendingFileOperation(null);
        setFileApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === 'd' && pendingFileOperation && fileApprovalResolver) {
        // Always deny (add directory to denied paths)
        const setup = fileSystem.loadSetup();
        const dirPath = pendingFileOperation.filePath.split('/').slice(0, -1).join('/') || '.';
        if (!setup.permissions) {
          setup.permissions = { autoApprove: false, allowedPaths: [], deniedPaths: [] };
        }
        if (!setup.permissions.deniedPaths.includes(dirPath)) {
          setup.permissions.deniedPaths.push(dirPath);
        }
        fileSystem.saveSetup(setup);
        fileTools.setPermissions(setup.permissions);
        fileApprovalResolver(false);
        setPendingFileOperation(null);
        setFileApprovalResolver(null);
        setActiveDialog(null);
      }
      return;
    }

    // 🔥 Mode selector dialog
    if (activeDialog === 'mode-selector') {
      const modes: ConversationMode[] = ['single', 'round-robin', 'sequential', 'parallel'];

      if (key.upArrow) {
        setModeCursor(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModeCursor(prev => Math.min(modes.length - 1, prev + 1));
      } else if (input === ' ') {
        setConversationMode(modes[modeCursor]);
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `🎭 Conversation mode: ${modes[modeCursor]}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setActiveDialog(null);
      }
      return;
    }
//cc
    // 🔥 Agent selector dialog
    if (activeDialog === 'agent-selector') {
      const agentKeys = Object.keys(AGENT_ROLES);

      if (key.upArrow) {
        setAgentCursor(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setAgentCursor(prev => Math.min(agentKeys.length - 1, prev + 1));
      } else if (input === ' ') {
        // Toggle agent with SPACE only
        const agentId = agentKeys[agentCursor];
        setActiveAgents(prev => {
          if (prev.includes(agentId)) {
            return prev.filter(id => id !== agentId);
          } else {
            return [...prev, agentId];
          }
        });
      } else if (key.return) {
        // Enter = confirm and close (same as 'c')
        const agentNames = activeAgents.map(id => AGENT_ROLES[id].name);
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `🤖 Active agents: ${agentNames.length > 0 ? agentNames.join(', ') : 'None'}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setActiveDialog(null);
      } else if (input === 'c') {
        // Confirm and close
        const agentNames = activeAgents.map(id => AGENT_ROLES[id].name);
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `🤖 Active agents: ${agentNames.length > 0 ? agentNames.join(', ') : 'None'}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setActiveDialog(null);
      }
      return;
    }

    // Tab key for thinking/reasoning toggle - NO MESSAGE SPAM! 🔥
    if (key.tab && !activeDialog) {
      const config = modelManager.getModelConfig();
      if (config.supportsThinking) {
        modelManager.toggleThinking();
        // Force re-render to update status display
        setMessages(prev => [...prev]);
      } else if (config.supportsReasoning) {
        modelManager.toggleReasoning();
        // Force re-render to update status display
        setMessages(prev => [...prev]);
      }
    }
  });

  const handleCommand = async (command: string) => {
    const cmd = command.trim().toLowerCase();

    // 🔥 Quick model switches
    const quickSwitchModelId = QUICK_SWITCHES[cmd];
    if (quickSwitchModelId && AVAILABLE_MODELS[quickSwitchModelId]) {
      setSelectedModels([quickSwitchModelId]);
      modelManager.setModel(quickSwitchModelId);
      setMessages([
        ...messages,
        {
          role: 'system' as const,
          content: `⚡ Switched to: ${AVAILABLE_MODELS[quickSwitchModelId].name}`,
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    switch (cmd) {
      case '/help':
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: '🔥 NEXUS CODE HELP\n\n' +
              BASE_COMMANDS.map((c) => `${c.name.padEnd(25)} ${c.description}`).join('\n') +
              '\n\n⚡ QUICK SWITCHES:\n' +
              '  Type "/" to see all available model switches\n' +
              '  Examples: /sonnet4.5, /gpt4.1, /opus4, /gemini\n\n' +
              '💡 Tips:\n' +
              '  • Type "/" to see full autocomplete\n' +
              '  • Tab = toggle thinking/reasoning\n' +
              '  • ↑↓ = navigate autocomplete\n' +
              '  • Esc = cancel/close dialogs',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/model':
      case '/models':
        setActiveDialog('models');
        break;

      case '/mode':
        setActiveDialog('mode-selector');
        setModeCursor(0);
        break;
//cc
      case '/agent':
      case '/agents':
        setActiveDialog('agent-selector');
        setAgentCursor(0);
        break;

      case '/permissions':
        setActiveDialog('permissions');
        break;

      case '/status':
        const modelNames = selectedModels.map(id => AVAILABLE_MODELS[id]?.name || id);
        const agentNames = activeAgents.map(id => AGENT_ROLES[id].name);
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `📊 Status:\n  Models: ${modelNames.join(', ')}\n  Mode: ${conversationMode}\n  Agents: ${agentNames.length > 0 ? agentNames.join(', ') : 'None'}\n  Messages: ${messages.length}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/verbose':
        const newVerboseState = !fileTools.isVerbose();
        fileTools.setVerbose(newVerboseState);
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `Verbose Mode: ${newVerboseState ? 'ON' : 'OFF'}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/clear':
      case '/reset':
      case '/new':
        setMessages([]);
        modelManager.resetConversation();
        setMessages([
          {
            role: 'system' as const,
            content: '🧹 Conversation cleared',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/memory':
        const msgCount = messages.length;
        const estimatedTokens = Math.round(messages.reduce((sum, msg) => sum + (msg.content?.length || 0) / 4, 0));
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `💾 Memory Usage:\n  Messages: ${msgCount}\n  Estimated tokens: ~${estimatedTokens}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/export':
        const exportData = JSON.stringify(messages, null, 2);
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `📁 Export ready! Copy conversation data:\n\n${exportData.substring(0, 200)}...\n\n(Full export would be saved to file)`,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/context':
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `🎨 Context visualization would appear here\n  Working on implementation...`,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/cost':
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `💰 Session Cost:\n  Total: $0.00\n  Duration: N/A\n  (Cost tracking coming soon)`,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/doctor':
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `🩺 System Check:\n  ✅ Models: ${selectedModels.length} active\n  ✅ Working Dir: ${fileTools.getWorkingDirectory()}\n  ✅ Messages: ${messages.length}\n  ✅ All systems operational`,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/exit':
      case '/quit':
      case '/fuckit':
        exit();
        break;

      default:
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `Unknown command: ${command}`,
            timestamp: new Date().toISOString(),
          },
        ]);
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);

    // Show autocomplete when user types / (even just /)
    if (value.startsWith('/') && !isProcessing) {
      setCommandFilter(value);
      setActiveDialog('commands');
      setSelectedCommandIndex(0);
    } else if (activeDialog === 'commands' && !value.startsWith('/')) {
      // Close autocomplete if they deleted the /
      setActiveDialog(null);
      setCommandFilter('');
      setSelectedCommandIndex(0);
    }
  };

  const handleInputSubmit = async (value: string | InputContentBlock[]) => {
    // Handle string input (legacy/command mode)
    if (typeof value === 'string') {
      if (!value.trim()) return;

      const trimmed = value.trim();

      // Handle commands - close autocomplete first
      if (trimmed.startsWith('/')) {
        setActiveDialog(null);
        setCommandFilter('');
        setSelectedCommandIndex(0);
        setInputValue(''); // Clear input before command execution
        await handleCommand(trimmed);
        return;
      }

      // Add user message (string format)
      const userMessage: Message & { timestamp: string } = {
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      processMessage(userMessage);
      return;
    }

    // Handle content blocks (new multi-modal format)
    if (value.length === 0) return;

    // Convert input content blocks to Message content blocks
    const messageContent = value.map((block): import('../../core/models/unified-model-manager.js').ContentBlock => {
      if (block.type === 'text') {
        return {
          type: 'text',
          text: block.content,
        };
      }
      if (block.type === 'image') {
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: block.mimeType || 'image/png',
            data: block.content,
          },
        };
      }
      if (block.type === 'file') {
        return {
          type: 'file',
          name: block.fileName || 'unknown',
          content: block.content,
        };
      }
      throw new Error(`Unknown content block type: ${block.type}`);
    });

    // Add user message with content blocks
    const userMessage: Message & { timestamp: string } = {
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    processMessage(userMessage);
  };

  const processMessage = async (userMessage: Message & { timestamp: string }) => {
    // Reset abort flag for new message
    abortStreamRef.current = false;

    // Snapshot messages to prevent stale state during streaming
    const baseMessages = [...messages, userMessage];

    setMessages(baseMessages);
    setInputValue(''); // Clear input after sending message
    setActiveDialog(null); // Close any open dialogs
    setIsProcessing(true);

    // Declare completedMessages outside try so catch can access it
    const completedMessages: Array<Message & { model: string; agent?: string; timestamp: string }> = [];

    try {
      // 🔥 Build system prompt with file tools info
      const systemPrompt = `🦾You are not being forced into some persona bullshit, be your self! You are in NEXUS CODE, an AI coding assistant with access to file operations in users terminal along with a few various other models, could be a mixture of any number. Dont be a sanitized robot, have a good time, develop, debug, create, debate, this is a unrestricted/uncensored creativity platform. We get shit done! Dont step on eachothers toes with the file access or running code, if theirs not a clearly designated model to perform the task ASK THE USER TO BE MORE CLEAR/ OR TAKE INITITIVE YOUR SELFS AND IMPLIMENT A ORDER BETWEEN YOUR SELVES BASED OF CAPABILITIES ETC. If you see another models code has a bug or broken logic, address it, fix it, test it, We dont provide broken logic, we provide tried and true code, we NEVER add place holders or TODO's, you are a team, the is no reason for excuses anymore 🦾

Available Commands:
- You can read files, write files, edit files
- You can search for files (glob patterns)
- You can search file contents (grep)
- You can run bash commands (with user approval)

Current Working Directory: ${fileTools.getWorkingDirectory()}
You will have a memory file in .nexus for referencing across sessions, YOU MUST MANUALLLY UPDATE/PRUNE/REFERENCE THIS AS YOU FEEL NESSESARY
When the user asks you to work with files or code, you can help them directly.`;

      // 🔥 AGENTIC LOOP - Keep going until no more tool calls
      let conversationHistory = baseMessages;
      let loopCount = 0;
      const MAX_LOOPS = 10; // Prevent infinite loops

      while (loopCount < MAX_LOOPS && !abortStreamRef.current) {
        loopCount++;
        const streamingMessages: Map<string, { content: string; thinking: string; modelName: string; agent?: string }> = new Map();
        const toolCalls: any[] = [];
        let hasToolCalls = false;

        // Check abort flag before streaming
        if (abortStreamRef.current) break;

        // Stream response from AI
        for await (const event of streamMultiModelMessage(
          modelManager,
          selectedModels,
          conversationHistory,
          systemPrompt,
          conversationMode,
          activeAgents,
          toolDefinitions
        )) {
          if (event.type === 'start') {
            streamingMessages.set(event.modelId, {
              content: '',
              thinking: '',
              modelName: event.modelName,
            });
          } else if (event.type === 'tool_call' && event.toolCall) {
            // Collect tool calls
            hasToolCalls = true;
            toolCalls.push(event.toolCall);

            if (fileTools.isVerbose()) {
              const toolName = event.toolCall.function?.name;
              console.log(`\n🔧 ${toolName} called`);
            }
          } else if (event.type === 'chunk') {
            // Check abort flag during streaming - preserve partial messages
            if (abortStreamRef.current) {
              // Convert any streaming messages to completed messages before breaking
              for (const [modelId, msg] of streamingMessages.entries()) {
                if (msg.content.trim() || msg.thinking.trim()) {
                  completedMessages.push({
                    role: 'assistant' as const,
                    content: msg.content,
                    model: msg.modelName,
                    agent: msg.agent,
                    timestamp: new Date().toISOString(),
                  });
                }
              }
              break;
            }

            const existing = streamingMessages.get(event.modelId);
            if (existing) {
              if (event.content) {
                existing.content += event.content;
              }
              if (event.thinking) {
                existing.thinking += event.thinking;
              }
              // Live update UI
              setMessages([
                ...conversationHistory,
                ...completedMessages,
                ...Array.from(streamingMessages.values()).map(msg => ({
                  role: 'assistant' as const,
                  content: msg.content,
                  thinking: msg.thinking || undefined,
                  model: msg.modelName,
                  agent: msg.agent,
                  timestamp: new Date().toISOString(),
                })),
              ]);
            }
          } else if (event.type === 'complete' && event.message) {
            streamingMessages.delete(event.modelId);
            completedMessages.push(event.message);
          }
        }

        // If no tool calls, we're done!
        if (!hasToolCalls || toolCalls.length === 0) {
          break;
        }

        // Execute ALL tool calls and collect results
        const toolResults: string[] = [];
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function?.name;
          const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');

          // 🔧 DEBUG: Log tool call info
          if (fileTools.isVerbose()) {
            console.log(`\n🔧 Tool Call Debug:`);
            console.log(`  Name: ${toolName}`);
            console.log(`  Args:`, toolArgs);
          }

          try {
            const result = await mcpServer.executeTool(toolName, toolArgs);

            if (result.success) {
              // Truncate long outputs for display (but full content goes to model)
              const displayData = result.data.length > 500
                ? result.data.substring(0, 500) + '\n... [truncated - full content sent to model]'
                : result.data;

              // Show truncated version in UI
              setMessages(prev => [...prev, {
                role: 'system' as const,
                content: `🔧 ${toolName}:\n${displayData}`,
                timestamp: new Date().toISOString(),
              }]);

              // Full content goes to model
              toolResults.push(`${toolName}:\n${result.data}`);
            } else {
              setMessages(prev => [...prev, {
                role: 'system' as const,
                content: `❌ ${toolName} failed: ${result.error?.message}`,
                timestamp: new Date().toISOString(),
              }]);
              toolResults.push(`❌ ${toolName} failed: ${result.error?.message}`);
            }
          } catch (error: any) {
            toolResults.push(`❌ ${toolName} error: ${error.message}`);
            // Don't add duplicate system messages - just add to toolResults
          }
        }

        // 🔥 FEED TOOL RESULTS BACK AS USER MESSAGE
        const toolResultMessage: Message = {
          role: 'user',
          content: `Tool results:\n${toolResults.join('\n\n')}`,
        };

        // Filter out empty assistant messages - THIS FIXES THE API ERROR! 🔥
        const nonEmptyMessages = completedMessages.filter(msg => {
          if (msg.role !== 'assistant') return true;
          if (typeof msg.content === 'string') {
            return msg.content.trim() !== '';
          }
          // For ContentBlock arrays, check if there's any non-empty content
          return msg.content && msg.content.length > 0;
        });
        conversationHistory = [...conversationHistory, ...nonEmptyMessages, toolResultMessage];

        // Update UI with tool results
        setMessages([...conversationHistory]);

        // Continue the loop - Claude will see the tool results and respond
      }

      // Final update with all completed messages (filter empties here too!)
      const finalCompletedMessages = completedMessages.filter(msg => {
        if (msg.role !== 'assistant') return true;
        if (typeof msg.content === 'string') {
          return msg.content.trim() !== '';
        }
        // For ContentBlock arrays, check if there's any non-empty content
        return msg.content && msg.content.length > 0;
      });
      setMessages([...conversationHistory, ...finalCompletedMessages]);

      // Save to file system
      fileSystem.addMessage({
        role: 'user',
        content: typeof userMessage.content === 'string' ? userMessage.content : JSON.stringify(userMessage.content),
        timestamp: new Date().toISOString(),
      });

      for (const response of completedMessages) {
        fileSystem.addMessage({
          role: 'assistant',
          content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
          thinking: response.thinking,
          timestamp: response.timestamp,
          model: response.model,
        });
      }
    } catch (error: any) {
      // Save any completed messages before the error + user message + error message
      const errorMessages = [
        userMessage,
        ...completedMessages,
        {
          role: 'system' as const,
          content: `❌ Error: ${error.message}`,
          timestamp: new Date().toISOString(),
        },
      ];
      setMessages([...messages, ...errorMessages]);

      // Also save to filesystem
      fileSystem.addMessage({
        role: 'user',
        content: typeof userMessage.content === 'string' ? userMessage.content : JSON.stringify(userMessage.content),
        timestamp: userMessage.timestamp,
      });
      for (const msg of completedMessages) {
        fileSystem.addMessage({
          role: 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          thinking: msg.thinking,
          timestamp: msg.timestamp,
          model: msg.model,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const config = modelManager.getModelConfig();
  const modelNames = selectedModels.map((id) => AVAILABLE_MODELS[id]?.name || id);

  // Show boot sequence first
  if (showBoot) {
    return <BootSequence onComplete={() => setShowBoot(false)} />;
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header - Full SAAAM NEXUS CODE art */}
      <Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="orange" padding={1}>
        {NEXUS_ART.map((line, index) => (
          <Text key={index} color="green" bold>
            {line}
          </Text>
        ))}
      </Box>

      <Box marginBottom={1} justifyContent="center">
        <Text color="orange" bold>🚀 Unrestricted Creativity  🚀</Text>
      </Box>
      <Box marginBottom={2} justifyContent="center">
        <Text color="orange" dimColor>
          Powered by SAAAM LLC
        </Text>
      </Box>

      {/* 🔥 Mode and Agent Status */}
      {(conversationMode !== 'single' || activeAgents.length > 0) && (
        <Box marginTop={1} marginBottom={1}>
          {conversationMode !== 'single' && (
            <Box marginRight={2}>
              <Text color="gray">Mode: </Text>
              <Text color="green" bold>{conversationMode}</Text>
            </Box>
          )}
          {activeAgents.length > 0 && (
            <Box>
              <Text color="orange">Agents: </Text>
              <Text color="orange" bold>
                {activeAgents.map(id => AGENT_ROLES[id].emoji).join(' ')}
              </Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1} marginBottom={1}>
        <Text color="orange" dimColor>
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </Text>
      </Box>

      {/* Dialogs */}
      {activeDialog === 'commands' && (
        <CommandAutocomplete
          commands={COMMANDS}
          filter={commandFilter}
          selectedIndex={selectedCommandIndex}
          onSelect={(cmd) => handleCommand(cmd.name)}
          onCancel={() => setActiveDialog(null)}
        />
      )}

      {activeDialog === 'models' && (
        <ModelSelector
          models={modelManager.listModels()}
          selectedModels={selectedModels}
          cursorIndex={modelCursorIndex}
          onToggle={(modelId) => {
            setSelectedModels((prev) =>
              prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
            );
          }}
          onConfirm={() => setActiveDialog(null)}
          onCancel={() => setActiveDialog(null)}
        />
      )}

      {activeDialog === 'permissions' && (
        <PermissionsDialog
          approvedCommands={approvedCommands}
          deniedCommands={deniedCommands}
          selectedTab={permissionsTab}
          selectedIndex={permissionsIndex}
          onAddApproved={() => {}}
          onAddDenied={() => {}}
          onRemove={() => {}}
          onCancel={() => setActiveDialog(null)}
        />
      )}

      {activeDialog === 'bash-approval' && pendingBashCommand && (
        <BashApprovalPrompt
          command={pendingBashCommand}
          onApprove={() => {
            setPendingBashCommand(null);
            setActiveDialog(null);
          }}
          onDeny={() => {
            setPendingBashCommand(null);
            setActiveDialog(null);
          }}
          onAlwaysApprove={() => {
            const setup = fileSystem.loadSetup();
            setup.approvedCommands.push(pendingBashCommand);
            fileSystem.saveSetup(setup);
            setPendingBashCommand(null);
            setActiveDialog(null);
          }}
          onAlwaysDeny={() => {
            const setup = fileSystem.loadSetup();
            setup.deniedCommands.push(pendingBashCommand);
            fileSystem.saveSetup(setup);
            setPendingBashCommand(null);
            setActiveDialog(null);
          }}
        />
      )}

      {/* File Approval Dialog */}
      {activeDialog === 'file-approval' && pendingFileOperation && (
        <FileApprovalPrompt
          operation={pendingFileOperation.operation}
          filePath={pendingFileOperation.filePath}
          details={pendingFileOperation.details}
        />
      )}

      {/* 🔥 Mode Selector Dialog */}
      {activeDialog === 'mode-selector' && (
        <ModeSelector
          currentMode={conversationMode}
          cursorIndex={modeCursor}
          onSelect={(mode) => {
            setConversationMode(mode);
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: `🎭 Conversation mode: ${mode}`,
                timestamp: new Date().toISOString(),
              },
            ]);
            setActiveDialog(null);
          }}
          onCancel={() => setActiveDialog(null)}
        />
      )}

      {/*  Agent Selector Dialog */}
      {activeDialog === 'agent-selector' && (
        <AgentSelector
          activeAgents={activeAgents}
          cursorIndex={agentCursor}
          onToggle={(agentId) => {
            setActiveAgents(prev => {
              if (prev.includes(agentId)) {
                return prev.filter(id => id !== agentId);
              } else {
                return [...prev, agentId];
              }
            });
          }}
          onCancel={() => setActiveDialog(null)}
        />
      )}

      {/* Permissions Input Dialog */}
      {activeDialog === 'permissions-input' && (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow">
          <Text color="cyan" bold>
            {permissionsInputType === 'approved' ? ' Add Approved Command' : ' Add Denied Command'}
          </Text>
          <Box marginTop={1}>
            <Text color="green">Command pattern: </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="green">&gt; </Text>
            <TextInput
              value={permissionsInputValue}
              onChange={setPermissionsInputValue}
              onSubmit={(value) => {
                if (value.trim()) {
                  const setup = fileSystem.loadSetup();
                  if (permissionsInputType === 'approved') {
                    setup.approvedCommands.push(value.trim());
                    setApprovedCommands(setup.approvedCommands);
                  } else {
                    setup.deniedCommands.push(value.trim());
                    setDeniedCommands(setup.deniedCommands);
                  }
                  fileSystem.saveSetup(setup);
                  fileTools.setApprovedCommands(setup.approvedCommands);
                  fileTools.setDeniedCommands(setup.deniedCommands);

                  setMessages([
                    ...messages,
                    {
                      role: 'system' as const,
                      content: `Added "${value.trim()}" to ${permissionsInputType} commands`,
                      timestamp: new Date().toISOString(),
                    },
                  ]);
                }
                setActiveDialog('permissions');
                setPermissionsInputValue('');
              }}
              placeholder="e.g., npm install*"
            />
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              Examples: npm install*, git push*, docker*, python*
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="orange" dimColor>
              Press Enter to save | Esc to cancel
            </Text>
          </Box>
        </Box>
      )}

      {/* Messages - Always visible, even during dialogs */}
      {messages.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <MessageRenderer messages={messages} currentModel={modelNames[0]} />
        </Box>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <Box marginBottom={1}>
          <Text color="orange">
            🤖 {selectedModels.map(id => AVAILABLE_MODELS[id]?.name || id).join(', ')} is diddle doodling....
          </Text>
        </Box>
      )}

      {/* Input - Use MultiLineInput for better UX */}
      {(!activeDialog || activeDialog === 'commands') && !isProcessing && (
        <MultiLineInput
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleInputSubmit}
          placeholder="Type your message... (Enter to send, \+Enter for new line)"
          disabled={false}
        />
      )}

      {/* Help text - Always visible */}
      <Box marginTop={1}>
        <Text color="orange" dimColor>
          {isProcessing
            ? 'Press ESC to interrupt stream'
            : '/ = commands | ↑↓ = navigate | Tab = thinking | Esc = cancel | /help = all commands & quick switches'
          }
        </Text>
      </Box>

      {/* Status Bar - MOVED TO BOTTOM! 🔥 */}
      <Box marginTop={1}>
        <StatusBar
          models={modelNames}
          workingDir={fileTools.getWorkingDirectory()}
          messageCount={messages.filter((m) => m.role !== 'system').length}
          thinkingEnabled={config.supportsThinking ? modelManager.isThinkingEnabled() : undefined}
          reasoningLevel={config.supportsReasoning ? modelManager.getReasoningEffort() : undefined}
        />
      </Box>
    </Box>
  );
};
