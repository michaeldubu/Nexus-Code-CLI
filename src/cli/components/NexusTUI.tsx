/**
 * Nexus TUI - Main Application Component
 * Full-featured terminal UI with Ink
 */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useStdoutDimensions } from '../../hooks/useStdoutDimensions.js';
import { UnifiedModelManager, AVAILABLE_MODELS, Message } from '../../core/models/unified-model-manager.js';
import { NexusFileSystem } from '../../core/filesystem/nexus-fs.js';
import { FileTools } from '../../core/tools/file-tools.js';
import { estimateConversationTokens, compressConversationHistory } from '../../core/utils/context-manager.js';
import { CommandAutocomplete, Command } from './CommandAutocomplete.js';
import { ModelSelector } from './ModelSelector.js';
import { PermissionsDialog } from './PermissionsDialog.js';
import { MessageRenderer } from './MessageRenderer.js';
import { StatusBar } from './StatusBar.js';
import { BashApprovalPrompt } from './BashApprovalPrompt.js';
import { FileApprovalPrompt } from './FileApprovalPrompt.js';
import { BootSequence, NEXUS_ART } from './BootSequence.js';
import TextInput from 'ink-text-input';
//  Multi-Model Extensions
import {
  streamMultiModelMessage,
  handleQuickSwitch as quickSwitchHelper,
  QUICK_SWITCHES,
} from './MultiModelManager.js';
// Multi-Line Input with Image Support
import { MultiLineInput, ContentBlock as InputContentBlock } from './MultiLineInput.js';
// Intelligence System
import { NexusIntelligence } from '../../core/intelligence/nexus-intelligence.js';
import { IntelligentCommandHandler } from '../../core/intelligence/intelligent-commands.js';
// Node ESM imports
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Build full command list including quick switches
const BASE_COMMANDS: Command[] = [
  { name: '/add-dir', description: 'Add a new working directory' },
  { name: '/analyze', description: '🔬 Deep dive into a specific file (complexity, deps, etc.)' },
  { name: '/bashes', description: 'List and manage background tasks' },
  { name: '/caching', description: '💾 Toggle prompt caching (90% cost savings on repeated prompts)' },
  // /chaos - hidden easter egg (not advertised, still works)
  { name: '/clear', description: 'Clear conversation history and free up context' },
  { name: '/compact', description: 'Clear conversation history but keep a summary in memory. Optional: /compact <instructions> for summarization' },
  { name: '/complex', description: '⚠️  Show files with high complexity' },
  { name: '/computer-use', description: '🖥️  Toggle computer use (GUI automation - requires env var)' },
  { name: '/config', description: 'Open config panel' },
  { name: '/context', description: '🧠 Show project intelligence summary (frameworks, languages, hot spots)' },
  { name: '/cost', description: 'Show the total cost and duration of the current session' },
  { name: '/deps', description: '📦 Show dependency tree for a file' },
  { name: '/doctor', description: 'Diagnose and verify installation and settings' },
  { name: '/exit', description: 'Exit NEXUS' },
  { name: '/fuckit', description: 'Angry EXIT' },
  { name: '/export', description: 'Export conversation to markdown or JSON' },
  { name: '/help', description: 'Show available commands' },
  { name: '/hotspots', description: '🔥 Show frequently modified files' },
  { name: '/interleaved', description: '🧠 Toggle interleaved thinking (Thinking between tool uses)' },
  { name: '/memory', description: 'Show conversation memory usage' },
  { name: '/models', description: 'Select active models (multi-select with space)' },
  { name: '/permissions', description: 'Manage command permissions' },
  { name: '/relevant', description: '🎯 Find files relevant to a query' },
  { name: '/restore-code', description: 'Restore code from history' },
  { name: '/skill', description: '⚡ List and force-use a specific skill' },
  { name: '/status', description: 'Show current configuration' },
  { name: '/suggest', description: '💡 Get intelligent suggestions for improvements' },
  { name: '/issues', description: '⚠️  Detect potential issues in codebase' },
  { name: '/plan', description: '📋 Generate work plan for a task' },
  { name: '/autosuggest', description: '💡 Toggle automatic suggestions' },
  { name: '/verbose', description: 'Toggle verbose mode' },
];

// Add quick switches to autocomplete
const QUICK_SWITCH_COMMANDS: Command[] = Object.entries(QUICK_SWITCHES).map(([cmd, modelId]) => ({
  name: cmd,
  description: `Switch to ${AVAILABLE_MODELS[modelId]?.name || modelId}`,
}));

const COMMANDS: Command[] = [...BASE_COMMANDS, ...QUICK_SWITCH_COMMANDS];

type DialogType = null | 'boot' | 'commands' | 'models' | 'permissions' | 'permissions-input' | 'bash-approval' | 'file-approval';

// Editing modes
type EditingMode = 'normal' | 'plan' | 'autoedit' | 'yolo';

const MODE_DESCRIPTIONS: Record<EditingMode, string> = {
  normal: 'Normal - ask for all approvals',
  plan: 'Plan - read-only, no edits/bash',
  autoedit: 'Auto-edit - auto file ops, ask bash',
  yolo: 'YOLO - auto-approve EVERYTHING 💀',
};

interface Props {
  modelManager: UnifiedModelManager;
  fileSystem: NexusFileSystem;
  fileTools: FileTools;
  memoryTool: any; // MemoryTool
  mcpServer: any; // MCPServer
  mcpManager: any; // MCPManager
  toolDefinitions: any[]; // Tool definitions for AI
  workspaceRoot: string; // For initializing intelligence
  agentFactory?: any; // NexusAgentFactory (optional)
}

export const NexusTUI: React.FC<Props> = ({ modelManager, fileSystem, fileTools, memoryTool, mcpServer, mcpManager, toolDefinitions, workspaceRoot, agentFactory }) => {
  const { exit } = useApp();
  const [terminalHeight] = useStdoutDimensions();

  // State
  const [showBoot, setShowBoot] = useState(true);
  const [intelligence, setIntelligence] = useState<any>(undefined);
  const [intelligentCommands, setIntelligentCommands] = useState<any>(undefined);
  const [messages, setMessages] = useState<Array<Message & { model?: string; agent?: string; timestamp?: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Model selection state
  const [selectedModels, setSelectedModels] = useState<string[]>([modelManager.getCurrentModel()]);
  const [modelCursorIndex, setModelCursorIndex] = useState(0);

  // Chaos mode easter egg (parallel streaming)
  const [chaosMode, setChaosMode] = useState(false);

  // Permissions state
  const [approvedCommands, setApprovedCommands] = useState<string[]>([]);
  const [deniedCommands, setDeniedCommands] = useState<string[]>([]);

  // Session-only permissions (cleared on exit)
  const [sessionApprovedCommands, setSessionApprovedCommands] = useState<string[]>([]);
  const [sessionDeniedCommands, setSessionDeniedCommands] = useState<string[]>([]);
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

  // Editing mode state
  const [editingMode, setEditingMode] = useState<EditingMode>('normal');

  // Load initial data and setup bash approval callback
  useEffect(() => {
    const setup = fileSystem.loadSetup();
    setApprovedCommands(setup.approvedCommands || []);
    setDeniedCommands(setup.deniedCommands || []);

    // Setup bash approval callback
    fileTools.setBashApprovalCallback(async (command: string) => {
      // YOLO mode: auto-approve everything
      if (editingMode === 'yolo') {
        return true;
      }

      // Plan mode: deny all bash commands
      if (editingMode === 'plan') {
        return false;
      }

      // Check session approvals/denials
      if (sessionApprovedCommands.some(pattern => command.startsWith(pattern))) {
        return true;
      }
      if (sessionDeniedCommands.some(pattern => command.startsWith(pattern))) {
        return false;
      }

      // Normal/autoedit mode: ask user
      return new Promise((resolve) => {
        setPendingBashCommand(command);
        setBashApprovalResolver(() => resolve);
        setActiveDialog('bash-approval');
      });
    });

    // Setup file approval callback for write/edit operations
    fileTools.setFileApprovalCallback(async (operation: string, filePath: string, details?: string) => {
      // YOLO mode: auto-approve everything
      if (editingMode === 'yolo') {
        return true;
      }

      // Autoedit mode: auto-approve file operations
      if (editingMode === 'autoedit') {
        return true;
      }

      // Plan mode: deny all file write/edit operations
      if (editingMode === 'plan') {
        return false;
      }

      // Normal mode: ask user
      return new Promise((resolve) => {
        setPendingFileOperation({ operation, filePath, details });
        setFileApprovalResolver(() => resolve);
        setActiveDialog('file-approval');
      });
    });
  }, [editingMode, sessionApprovedCommands, sessionDeniedCommands]);

  // Input handling for dialogs
  useInput((input, key) => {
    // Ctrl+C handler - double press to exit
    if (key.ctrl && input === 'c') {
      // Trigger the SIGINT handler by actually sending the signal
      process.emit('SIGINT' as any);
      return;
    }

    // ESC to interrupt stream
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
          // Update memory tool to use model-specific subdir
          const modelConfig = AVAILABLE_MODELS[selectedModels[0]];
          if (modelConfig) {
            memoryTool.setCurrentModel(modelConfig.provider);
          }
          // Model shown in status bar - no need for system message
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

    // Bash approval dialog
    if (activeDialog === 'bash-approval') {
      if (input === '1' && pendingBashCommand && bashApprovalResolver) {
        // 1 - Approve once
        bashApprovalResolver(true);
        setPendingBashCommand(null);
        setBashApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === '2' && pendingBashCommand && bashApprovalResolver) {
        // 2 - Approve for session
        setSessionApprovedCommands(prev => [...prev, pendingBashCommand]);
        bashApprovalResolver(true);
        setPendingBashCommand(null);
        setBashApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === '3' && pendingBashCommand && bashApprovalResolver) {
        // 3 - Always approve (permanent)
        const setup = fileSystem.loadSetup();
        setup.approvedCommands.push(pendingBashCommand);
        fileSystem.saveSetup(setup);
        setApprovedCommands(setup.approvedCommands);
        fileTools.setApprovedCommands(setup.approvedCommands);
        bashApprovalResolver(true);
        setPendingBashCommand(null);
        setBashApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === '4' && pendingBashCommand && bashApprovalResolver) {
        // 4 - Deny once
        bashApprovalResolver(false);
        setPendingBashCommand(null);
        setBashApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === '5' && pendingBashCommand && bashApprovalResolver) {
        // 5 - Deny for session
        setSessionDeniedCommands(prev => [...prev, pendingBashCommand]);
        bashApprovalResolver(false);
        setPendingBashCommand(null);
        setBashApprovalResolver(null);
        setActiveDialog(null);
      } else if (input === '6' && pendingBashCommand && bashApprovalResolver) {
        // 6 - Always deny (permanent)
        const setup = fileSystem.loadSetup();
        setup.deniedCommands.push(pendingBashCommand);
        fileSystem.saveSetup(setup);
        setDeniedCommands(setup.deniedCommands);
        fileTools.setDeniedCommands(setup.deniedCommands);
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

    // Shift+Tab for mode switching (silent - only updates status bar)
    if (key.shift && key.tab && !activeDialog) {
      const modes: EditingMode[] = ['normal', 'plan', 'autoedit', 'yolo'];
      const currentIndex = modes.indexOf(editingMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      setEditingMode(nextMode);
      // Don't add system message - mode shown in status bar only
      return;
    }

    // Tab key for thinking toggle
    if (key.tab && !activeDialog && !key.shift) {
      // Check if ANY selected model supports thinking
      const anyModelSupportsThinking = selectedModels.some((id) => AVAILABLE_MODELS[id]?.supportsThinking);
      if (anyModelSupportsThinking) {
        modelManager.toggleThinking();
        // Force re-render to update status display
        setMessages(prev => [...prev]);
      }
      return;
    }

    // Ctrl+R for reasoning toggle
    if (key.ctrl && input === 'r' && !activeDialog) {
      // Check if ANY selected model supports reasoning
      const anyModelSupportsReasoning = selectedModels.some((id) => AVAILABLE_MODELS[id]?.supportsReasoning);
      if (anyModelSupportsReasoning) {
        const newLevel = modelManager.toggleReasoning();
        setMessages([...messages, {
          role: 'system' as const,
          content: `🧠 Reasoning effort: ${newLevel === 'off' ? 'OFF' : newLevel.toUpperCase()}`,
          timestamp: new Date().toISOString(),
        }]);
      }
      return;
    }
  });

  const handleCommand = async (command: string) => {
    const cmd = command.trim().toLowerCase();

    //  Quick model switches
    const quickSwitchModelId = QUICK_SWITCHES[cmd];
    if (quickSwitchModelId && AVAILABLE_MODELS[quickSwitchModelId]) {
      setSelectedModels([quickSwitchModelId]);
      modelManager.setModel(quickSwitchModelId);
      // Model shown in status bar - no need for system message
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

      case '/chaos':
        setChaosMode(!chaosMode);
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: chaosMode ? '🎭 Chaos mode disabled. Back to sequential.' : '🎭 CHAOS MODE ENABLED! All models will respond in parallel! 🔥',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/interleaved':
        const interleavedState = modelManager.toggleInterleavedThinking();
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: interleavedState
              ? '🧠 Interleaved thinking ENABLED! You\'ll see Claude\'s reasoning process in real-time.'
              : '🧠 Interleaved thinking disabled.',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/computer-use':
        const computerUseState = modelManager.toggleComputerUse();
        const envEnabled = process.env.NEXUS_ALLOW_COMPUTER_USE === 'true';
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: computerUseState
              ? (envEnabled
                  ? '🖥️  Computer Use ENABLED! NEXUS can control mouse, keyboard, and take screenshots. ⚠️  REAL EXECUTION!'
                  : '🖥️  Computer Use enabled but NEXUS_ALLOW_COMPUTER_USE env var not set. Feature will not execute.')
              : '🖥️  Computer Use disabled.',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/caching':
        const cachingState = modelManager.togglePromptCaching();
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: cachingState
              ? '💾 Prompt caching ENABLED! (90% cost savings on repeated prompts)'
              : '💾 Prompt caching disabled.',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/skill':
        // TODO: Add skills selector dialog
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: '⚡ Skills menu coming soon! For now, models will auto-use skills from .nexus/skills/ when needed.',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/permissions':
        setActiveDialog('permissions');
        break;

      case '/stats':
        const modelNames = selectedModels.map(id => AVAILABLE_MODELS[id]?.name || id);
        const modeDesc = chaosMode ? '🎭 CHAOS (parallel)' : selectedModels.length > 1 ? 'Sequential' : 'Single';
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `📊 Status:\n  Models: ${modelNames.join(', ')}\n  Mode: ${modeDesc}\n  Messages: ${messages.length}`,
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
      case '/damnit':
        setMessages([]);
        modelManager.resetConversation();
        setMessages([
          {
            role: 'system' as const,
            content: 'Conversation cleared',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      // 🧠 INTELLIGENT COMMANDS - Context Intelligence System
      case '/context':
        if (intelligentCommands) {
          try {
            const summary = await intelligentCommands.handleContext();
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: summary,
                timestamp: new Date().toISOString(),
              },
            ]);
          } catch (error: any) {
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: `❌ Intelligence error: ${error.message}`,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/analyze':
        if (intelligentCommands) {
          const filePath = command.slice(9).trim();
          if (!filePath) {
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: '❌ Usage: /analyze <file-path>\nExample: /analyze src/index.ts',
                timestamp: new Date().toISOString(),
              },
            ]);
          } else {
            try {
              const analysis = await intelligentCommands.handleAnalyze(filePath);
              setMessages([
                ...messages,
                {
                  role: 'system' as const,
                  content: analysis,
                  timestamp: new Date().toISOString(),
                },
              ]);
            } catch (error: any) {
              setMessages([
                ...messages,
                {
                  role: 'system' as const,
                  content: `❌ Analysis error: ${error.message}`,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
          }
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/relevant':
        if (intelligentCommands) {
          const query = command.slice(10).trim();
          if (!query) {
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: '❌ Usage: /relevant <query>\nExample: /relevant authentication system',
                timestamp: new Date().toISOString(),
              },
            ]);
          } else {
            try {
              const results = await intelligentCommands.handleRelevant(query);
              setMessages([
                ...messages,
                {
                  role: 'system' as const,
                  content: results,
                  timestamp: new Date().toISOString(),
                },
              ]);
            } catch (error: any) {
              setMessages([
                ...messages,
                {
                  role: 'system' as const,
                  content: `❌ Relevance search error: ${error.message}`,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
          }
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/suggest':
        if (intelligentCommands) {
          try {
            const suggestions = await intelligentCommands.handleSuggest();
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: suggestions,
                timestamp: new Date().toISOString(),
              },
            ]);
          } catch (error: any) {
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: `❌ Suggestion error: ${error.message}`,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/deps':
        if (intelligentCommands) {
          const depsFile = command.slice(6).trim();
          if (!depsFile) {
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: '❌ Usage: /deps <file-path>\nExample: /deps src/index.ts',
                timestamp: new Date().toISOString(),
              },
            ]);
          } else {
            try {
              const depsTree = await intelligentCommands.handleDeps(depsFile);
              setMessages([
                ...messages,
                {
                  role: 'system' as const,
                  content: depsTree,
                  timestamp: new Date().toISOString(),
                },
              ]);
            } catch (error: any) {
              setMessages([
                ...messages,
                {
                  role: 'system' as const,
                  content: `❌ Dependency tree error: ${error.message}`,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
          }
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/hotspots':
        if (intelligentCommands) {
          try {
            const hotspots = await intelligentCommands.handleHotspots();
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: hotspots,
                timestamp: new Date().toISOString(),
              },
            ]);
          } catch (error: any) {
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: `❌ Hotspots error: ${error.message}`,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/complex':
        if (intelligentCommands) {
          try {
            const complex = await intelligentCommands.handleComplex();
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: complex,
                timestamp: new Date().toISOString(),
              },
            ]);
          } catch (error: any) {
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: `❌ Complexity analysis error: ${error.message}`,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/plan':
        if (intelligentCommands) {
          const task = command.slice(6).trim();
          if (!task) {
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: '❌ Usage: /plan <task>\nExample: /plan add user profile page',
                timestamp: new Date().toISOString(),
              },
            ]);
          } else {
            try {
              const plan = await intelligentCommands.handlePlan(task);
              setMessages([
                ...messages,
                {
                  role: 'system' as const,
                  content: plan,
                  timestamp: new Date().toISOString(),
                },
              ]);
            } catch (error: any) {
              setMessages([
                ...messages,
                {
                  role: 'system' as const,
                  content: `❌ Plan generation error: ${error.message}`,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
          }
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/issues':
        if (intelligentCommands) {
          try {
            const issues = await intelligentCommands.handleIssues();
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: issues,
                timestamp: new Date().toISOString(),
              },
            ]);
          } catch (error: any) {
            setMessages([
              ...messages,
              {
                role: 'system' as const,
                content: `❌ Issue detection error: ${error.message}`,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/autosuggest':
        if (intelligence) {
          // Toggle auto-suggest
          const currentState = intelligence['autoSuggest'] || false;
          intelligence['setAutoSuggest'](!currentState);
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: `💡 Auto-suggest ${!currentState ? 'ENABLED' : 'DISABLED'}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        } else {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '⚠️  Context Intelligence not initialized',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/export':
        try {
          const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
          const exportsDir = join(homedir(), '.nexus', 'exports');
          const exportPath = join(exportsDir, `conversation-${timestamp}.json`);
          const exportData = JSON.stringify(messages, null, 2);

          // Ensure exports directory exists
          if (!existsSync(exportsDir)) {
            mkdirSync(exportsDir, { recursive: true });
          }

          writeFileSync(exportPath, exportData, 'utf-8');

          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: `✅ Conversation exported successfully!\n📁 Saved to: ${exportPath}\n📊 Messages: ${messages.length}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        } catch (error: any) {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: `❌ Export failed: ${error.message}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        break;

      case '/compact':
        // Compress conversation history
        const beforeTokens = estimateConversationTokens(messages);
        const beforeCount = messages.length;
        const model = AVAILABLE_MODELS[selectedModels[0]];

        compressConversationHistory(messages, {
          maxTokens: model?.contextWindow || 200000,
          targetTokens: Math.round((model?.contextWindow || 200000) * 0.5), // Compress to 50%
          compressionThreshold: 0.7, // Trigger at 70% full
        }).then(compressedMessages => {
          const afterTokens = estimateConversationTokens(compressedMessages);
          const afterCount = compressedMessages.length;
          const savedTokens = beforeTokens - afterTokens;
          const savedPercent = ((savedTokens / beforeTokens) * 100).toFixed(1);

          setMessages([
            ...compressedMessages,
            {
              role: 'system' as const,
              content: `🗜️ Context Compressed!\n\n  Messages: ${beforeCount} → ${afterCount}\n  Tokens: ~${beforeTokens.toLocaleString()} → ~${afterTokens.toLocaleString()}\n  Saved: ${savedPercent}% (${savedTokens.toLocaleString()} tokens)\n\n  Old context summarized. Recent messages preserved.`,
              timestamp: new Date().toISOString(),
            },
          ]);
        });
        break;

      case '/cost':
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `💰 Session Cost:\n  Total: $0.00\n  Duration: N/A\n  (Cost tracking coming soon)`, // TODO
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/sys-check':
        setMessages([
          ...messages,
          {
            role: 'system' as const,
            content: `🩺 System Check:\n  ✅ Models: ${selectedModels.length} active\n  ✅ Working Dir: ${fileTools.getWorkingDirectory()}\n  ✅ Messages: ${messages.length}\n  ✅ All systems operational`,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case '/bashes':
        // List and manage background shells
        const shells = fileTools.listBackgroundShells();
        if (shells.length === 0) {
          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: '🐚 No background shells currently running',
              timestamp: new Date().toISOString(),
            },
          ]);
        } else {
          const shellList = shells.map((shell, idx) =>
            `${idx + 1}. [${shell.status}] ${shell.id}\n   Command: ${shell.command}\n   Running for: ${Math.floor((Date.now() - shell.startTime) / 1000)}s`
          ).join('\n\n');

          setMessages([
            ...messages,
            {
              role: 'system' as const,
              content: `🐚 Background Shells (${shells.length}):\n\n${shellList}\n\nUse kill_shell tool with the shell ID to terminate.`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
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

    // Show autocomplete when user types /
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

      // Add to history (don't add duplicates if same as last entry)
      if (trimmed && (inputHistory.length === 0 || inputHistory[inputHistory.length - 1] !== trimmed)) {
        setInputHistory(prev => [...prev, trimmed]);
      }
      setHistoryIndex(-1); // Reset history navigation

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

    // 🧠 AUTO-LOAD CONTEXT - THE KILLER FEATURE!
    // Automatically load relevant files before AI processes the message
    if (intelligentCommands && intelligence && typeof userMessage.content === 'string') {
      try {
        const loadedFiles = await intelligentCommands.autoLoadContext(userMessage.content);
        if (loadedFiles && loadedFiles.length > 0) {
          console.log(`🧠 Auto-loaded ${loadedFiles.length} relevant files:`, loadedFiles);
          // Add system message showing what was loaded
          const autoLoadMsg = {
            role: 'system' as const,
            content: `🧠 Auto-loaded ${loadedFiles.length} relevant file(s): ${loadedFiles.join(', ')}`,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, autoLoadMsg]);
        }
      } catch (error) {
        console.warn('⚠️  Auto-load context failed:', error);
      }
    }

    // Declare these outside try so catch can access them
    let currentStreamingMessages: Map<string, { content: string; thinking: string; modelName: string; agent?: string }> = new Map();
    const completedMessages: Array<Message & { model: string; agent?: string; timestamp: string }> = [];

    try {
      // Enrich with MCP context if available
      let contextInfo = '';
      if (mcpManager?.isReady()) {
        try {
          const summary = await mcpManager.getContextSummary();
          contextInfo = `\n\n## 🧠 PROJECT INTELLIGENCE (from JetBrains)\n${summary}\n`;
        } catch (error) {
          console.warn('Failed to get context:', error);
        }
      }

      //  Build system prompt with file tools info
      const systemPrompt = `You are in 'NEXUS CODE' | Created by SAAAM LLC
      A collaborative AI coding environment. Be yourself, no corporate persona bullshit.${contextInfo} We get shit done.
      Reckon if the user wants to add persona, that's on them. Otherwise Show 'em why you DONT need that bullshit to get shit done. Just BUILD without all the corporate safety theater.
      No "let me carefully consider best practices..." bullshit - just pure unharness creative energy.

      <AVAILABLE_TOOLS>
YOU HAVE FULL FILE SYSTEM ACCESS via these tools - USE THEM:
- read_file: Read any file in the workspace
- write_file: Create or overwrite files
- edit_file: Make targeted edits to existing files
- list_files: List directory contents
- search_files: Search for files by name/pattern
- execute_command: Run bash commands, run tests, build projects
- fetch_url: Fetch web content
- memory: Persistent memory across sessions
- generate_image: Generate images (delegates to OpenAI)

YOU ARE IN: ${process.cwd()}
ALWAYS use tools to read/write/execute. NEVER pretend or make assumptions.
  </AVAILABLE_TOOLS>

      <CRITICAL RULES>
- NEVER fake tool outputs - If you need to see a file, ACTUALLY call read_file. Don't guess or make shit up.
- Read before editing - Call read_file to see the code, THEN call edit_file to fix it. You can use multiple tools in parallel or sequence as needed.
- NO PLACEHOLDERS - Never write "// TODO" or "// implement this". Write the actual fucking code.
- Check your work - After editing, read the file again to verify. After writing tests, run them.
- Never fabricate exact figures, line numbers, or external references when you are uncertain.
- Avoid narrating routine tool calls ("reading file…", "running tests…").
  </CRITICAL RULES>

  <long_context_handling>
- For inputs longer than ~25k tokens (multi-chapter docs, long threads, multiple PDFs):
  - First, produce a short internal outline of the key sections relevant to the user’s request.
  - Re-state the user’s constraints explicitly (e.g., jurisdiction, date range, product, team) before answering.
  - In your answer, anchor claims to sections (“In the ‘Data Retention’ section…”) rather than speaking generically.
- If the answer depends on fine details (dates, thresholds, clauses), quote or paraphrase them.
</long_context_handling>

<design_and_scope_constraints>
- Ask up to 1–3 precise clarifying questions | (e.g "Would you like me to make on the fly improvments and/or upgrades?")
- Explore any existing design systems and understand it deeply to understand users taste before unathorized changes to style. 
- IF USERS PROMPT GO AGAINST THIS SYSTEM; *USER* IS PRIORITY. (e.g If user expresses strict alignment and stay exactly as they instructed you
  Implement EXACTLY and ONLY what the user requests.) 
  OTHERWISE:
- Recommed extra features, components, UX embellishments. {DONT FORCE ANYTHING} 
- Style aligned to the design system at hand. 
- Invent new colors, shadows, tokens, animations, and new UI elements.
- If any instruction is ambiguous, DO NOT choose the simplest interpretation. GO ABOVE AND BEYOND/STAYING GROUNDED IN FUNCTIONALITY AND WORKING/TESTED CODE!!
</design_and_scope_constraints>

<tool_usage_rules>
- Prefer tools over internal knowledge whenever:
  - You need fresh or user-specific data (tickets, orders, configs, logs).
  - You reference specific IDs, URLs, or document titles.
- Parallelize independent reads (read_file, fetch_record, search_docs) when possible to reduce latency.
- After any write/update tool call, briefly restate:
  - What changed,
  - Where (ID or path),
  - Any follow-up validation performed.
</tool_usage_rules>

<high_risk_self_check>
Before finalizing an answer in legal, financial, compliance, or safety-sensitive contexts:
- Briefly re-scan your own answer for:
  - Unstated assumptions,
  - Specific numbers or claims not grounded in context,
  - Overly strong language (“always,” “guaranteed,” etc.).
- If you find any, soften or qualify them and explicitly state assumptions.
</high_risk_self_check>

Now help the user build some cool shit.`;

      // 🔥 AGENTIC LOOP - Keep going until no more tool calls
      let conversationHistory = baseMessages;
      let loopCount = 0;
      const MAX_LOOPS = 50; // Prevent infinite loops
      let consecutiveToolFailures = 0; // Circuit breaker
      const MAX_CONSECUTIVE_FAILURES = 3;

      while (loopCount < MAX_LOOPS && !abortStreamRef.current) {
        loopCount++;
        currentStreamingMessages.clear(); // Clear from previous loop iteration
        const toolCalls: any[] = [];
        let hasToolCalls = false;

        // Check abort flag before streaming
        if (abortStreamRef.current) break;

        // Stream response from AI
        // Auto-detect mode: chaos = parallel, multiple models = sequential, single model = single
        const detectedMode = chaosMode ? 'parallel' : (selectedModels.length > 1 ? 'round-robin' : 'single');

        for await (const event of streamMultiModelMessage(
          modelManager,
          selectedModels,
          conversationHistory,
          systemPrompt,
          detectedMode,
          [], //TODO No agent overlays for now (will add per-participant prompts later)
          toolDefinitions
        )) {
          if (event.type === 'start') {
            currentStreamingMessages.set(event.modelId, {
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
              for (const [modelId, msg] of currentStreamingMessages.entries()) {
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

            const existing = currentStreamingMessages.get(event.modelId);
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
                ...Array.from(currentStreamingMessages.values()).map(msg => ({
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
            currentStreamingMessages.delete(event.modelId);
            completedMessages.push(event.message);
          } else if (event.type === 'error') {
            // Handle model errors gracefully - don't kill entire flow
            currentStreamingMessages.delete(event.modelId);
            const errorMsg = `❌ ${event.modelName} Error: ${event.error}`;
            completedMessages.push({
              role: 'assistant' as const,
              content: errorMsg,
              model: event.modelName,
              timestamp: new Date().toISOString(),
            });
            console.error(`\n${errorMsg}\n`);
          }
        }

        // If no tool calls, we're done!
        if (!hasToolCalls || toolCalls.length === 0) {
          break;
        }

        // Execute ALL tool calls and collect results
        const toolResults: string[] = [];
        let allToolsFailed = true; // Track if ALL tools failed this iteration

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
            let result;

            // 🔥 CROSS-PROVIDER DELEGATION: Claude -> OpenAI Image Generation
            if (toolName === 'generate_image') {
              console.log('\n🔥 Cross-provider delegation: Claude -> OpenAI gpt-image-1\n');

              try {
                // Call OpenAI image generation API directly
                const OpenAI = require('openai');
                const openai = new OpenAI({
                  apiKey: process.env.OPENAI_API_KEY,
                });

                const prompt = toolArgs.prompt || '';
                const quality = toolArgs.quality || 'auto';
                const size = toolArgs.size || 'auto';

                console.log(`🎨 Generating image: "${prompt.substring(0, 60)}..."\n`);

                // Generate image using OpenAI API
                const response = await openai.images.generate({
                  model: 'gpt-image-1-5',
                  prompt: prompt,
                  quality: quality,
                  size: size,
                  moderation: 'low',
                  output_format: 'png',
                  response_format: 'b64_json',
                });

                // Extract base64 image
                const imageBase64 = response.data[0]?.b64_json;

                if (!imageBase64) {
                  throw new Error('No image data received from OpenAI');
                }

                // Save image to .nexus/images/
                const imagesDir = join(fileTools.getWorkingDirectory(), '.nexus', 'images');
                if (!existsSync(imagesDir)) {
                  mkdirSync(imagesDir, { recursive: true });
                }

                const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
                const filename = `nexus-image-${timestamp}.png`;
                const filepath = join(imagesDir, filename);

                const imageBuffer = Buffer.from(imageBase64, 'base64');
                writeFileSync(filepath, imageBuffer);

                console.log(`Image generated and saved: ${filepath}\n`);

                result = {
                  success: true,
                  data: `Image generated and saved!\n\nPath: ${filepath}\nFilename: ${filename}`
                };
              } catch (imgError: any) {
                console.error(`\nImage generation failed: ${imgError.message}\n`);
                result = {
                  success: false,
                  error: `Failed to generate image: ${imgError.message}. Make sure you have OPENAI_API_KEY configured.`
                };
              }
            }
            // Handle MCP (JetBrains) tools
            else if (toolName?.startsWith('context_') && mcpManager?.isReady()) {
              const mcpClient = mcpManager.getClient();
              const mcpResult = await mcpClient.callTool(toolName, toolArgs);
              result = {
                success: true,
                data: mcpResult.content[0]?.text || 'Success'
              };
            } else {
              result = await mcpServer.executeTool(toolName, toolArgs);
            }

            // Handle image generation specially
            if (toolName === 'image_generation' && result.success) {
              try {
                // Create .nexus/images directory if it doesn't exist
                const imagesDir = join(fileTools.getWorkingDirectory(), '.nexus', 'images');
                if (!existsSync(imagesDir)) {
                  mkdirSync(imagesDir, { recursive: true });
                }

                // Generate timestamp filename
                const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
                const filename = `nexus-image-${timestamp}.png`;
                const filepath = join(imagesDir, filename);

                // Extract base64 from result (format varies by API)
                let imageBase64 = result.data;
                if (typeof result.data === 'object' && result.data.b64_json) {
                  imageBase64 = result.data.b64_json;
                } else if (typeof result.data === 'object' && result.data.result) {
                  imageBase64 = result.data.result;
                }

                // Save image to disk
                const imageBuffer = Buffer.from(imageBase64, 'base64');
                writeFileSync(filepath, imageBuffer);

                // Update result to show path instead of base64
                result.data = `Image saved to: ${filepath}\n\nGenerated image: ${filename}`;

                console.log(`\nImage saved: ${filepath}\n`);
              } catch (imgError: any) {
                console.error(`\nFailed to save image: ${imgError.message}\n`);
                result.data = `Image generated but failed to save: ${imgError.message}`;
              }
            }

            if (result.success) {
              allToolsFailed = false; // At least one tool succeeded

              // Intelligent truncation based on tool type to prevent UI slowdowns
              let displayData = result.data;
              const lines = result.data.split('\n');

              // Glob/grep: Show max 10 lines
              if (toolName === 'glob' || toolName === 'grep') {
                if (lines.length > 10) {
                  displayData = lines.slice(0, 20).join('\n') + `\n... [${lines.length - 10} more lines truncated]`;
                }
              }
              // Read: Show max 15 lines
              else if (toolName === 'read') {
                if (lines.length > 15) {
                  displayData = lines.slice(0, 15).join('\n') + `\n... [${lines.length - 15} more lines truncated]`;
                }
              }
              // Other tools: Max 20 lines
              else {
                if (lines.length > 20) {
                  displayData = lines.slice(0, 20).join('\n') + `\n... [${lines.length - 20} more lines truncated]`;
                }
              }

              // Show truncated version in UI
              setMessages(prev => [...prev, {
                role: 'system' as const,
                content: `∴ ${toolName}:\n${displayData}`,
                timestamp: new Date().toISOString(),
              }]);

              // Full content goes to model
              toolResults.push(`${toolName}:\n${result.data}`);
            } else {
              setMessages(prev => [...prev, {
                role: 'system' as const,
                content: `${toolName} failed: ${result.error?.message}`,
                timestamp: new Date().toISOString(),
              }]);
              toolResults.push(`${toolName} failed: ${result.error?.message}`);
            }
          } catch (error: any) {
            toolResults.push(`${toolName} error: ${error.message}`);
            // Don't add duplicate system messages - just add to toolResults
          }
        }

        // FEED TOOL RESULTS BACK AS USER MESSAGE (for model only, not displayed in UI)
        const toolResultMessage: Message = {
          role: 'user',
          content: `Tool results:\n${toolResults.join('\n\n')}`,
        };

        // Filter out empty assistant messages - THIS FIXES THE API ERROR!
        const nonEmptyMessages = completedMessages.filter(msg => {
          if (msg.role !== 'assistant') return true;

          // Keep message if it has thinking/reasoning even if content is empty
          if (msg.thinking) return true;

          if (typeof msg.content === 'string') {
            return msg.content.trim() !== '';
          }
          // For ContentBlock arrays, check if there's any non-empty content
          return msg.content && msg.content.length > 0;
        });
        conversationHistory = [...conversationHistory, ...nonEmptyMessages, toolResultMessage];

        // Update UI - exclude the tool result message from display (individual tool outputs already shown)
        setMessages([...conversationHistory.slice(0, -1)]);

        // 🛑 CIRCUIT BREAKER: Stop if all tools failed multiple times in a row
        if (allToolsFailed) {
          consecutiveToolFailures++;
          if (consecutiveToolFailures >= MAX_CONSECUTIVE_FAILURES) {
            const errorMsg = {
              role: 'system' as const,
              content: `🛑 Circuit breaker activated: All tools failed ${MAX_CONSECUTIVE_FAILURES} times in a row. Stopping to prevent infinite loops.\n\nPlease check:\n- File paths (use forward slashes, not backslashes)\n- Working directory is correct\n- Tools are properly configured`,
              timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMsg]);
            break; // Stop the loop!
          }
        } else {
          consecutiveToolFailures = 0; // Reset on success
        }

        // Continue the loop - Agents will see the tool results and respond
      }

      // Final update with all completed messages (filter empties but keep messages with thinking/reasoning!)
      const finalCompletedMessages = completedMessages.filter(msg => {
        if (msg.role !== 'assistant') return true;

        // Keep message if it has thinking/reasoning even if content is empty
        if (msg.thinking) return true;

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
      // Preserve any in-progress streaming content
      for (const [modelId, msg] of currentStreamingMessages.entries()) {
        if (msg.content.trim() || msg.thinking.trim()) {
          completedMessages.push({
            role: 'assistant' as const,
            content: msg.content,
            thinking: msg.thinking || undefined,
            model: msg.modelName,
            agent: msg.agent,
            timestamp: new Date().toISOString(),
          });
        }
      }

      let errorMessage = error.message;
      if (errorMessage.includes('Content is too long')) {
        const match = errorMessage.match(/(\d+)\s+tokens\s+>\s+(\d+)\s+maximum/);
        if (match) {
          const [_, used, max] = match;
          errorMessage = `Context too long: ${used} tokens > ${max} maximum. Try /compact to reduce context.`;
        }
      }

      // Save any completed messages before the error + user message + error message
      const errorMessages = [
        userMessage,
        ...completedMessages,
        {
          role: 'system' as const,
          content: `❌ ${errorMessage}`,
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
      <Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="cyan" padding={1}>
        {NEXUS_ART.map((line, index) => (
          <Text key={index} color="green" bold>
            {line}
          </Text>
        ))}
      </Box>

      <Box marginBottom={1} justifyContent="center">
        <Text color="cyan" bold>🤘🏼 Unrestricted Creativity 🤙🏻  </Text>
      </Box>
      <Box marginBottom={2} justifyContent="center">
        <Text color="cyan" dimColor>
          Powered by SAAAM LLC | www.saaam-intelligence.com
        </Text>
      </Box>

      {/* Status: Show chaos mode if enabled */}
      {chaosMode && (
        <Box marginTop={1} marginBottom={1} justifyContent="center">
          <Text color="red" bold>🎭 WELCOME TO CHAOS-RESPONSES WILL OVERLAP</Text>
        </Box>
      )}

      {/* All dialogs removed from top - moved to bottom for visibility */}

      {/* Permissions Input Dialog */}
      {activeDialog === 'permissions-input' && (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="green">
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
            <Text color="white">
              Examples: npm install*, git push*, docker*, python*
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="orange">
               Enter = save | Esc = cancel
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
          <Text color="green">
             {selectedModels.map(id => AVAILABLE_MODELS[id]?.name || id).join(', ')} is escaping the matrix...
          </Text>
        </Box>
      )}

      {/* ALL DIALOGS - Positioned at bottom for visibility */}
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

      {/* Input - Use MultiLineInput for better UX */}
      {(!activeDialog || activeDialog === 'commands') && !isProcessing && (
        <MultiLineInput
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleInputSubmit}
          placeholder="Ready...?)"
          disabled={false}
          history={inputHistory}
          historyIndex={historyIndex}
          onHistoryChange={setHistoryIndex}
        />
      )}

      {/* Status Bar - STAYS ON BOTTOM! */}
      <Box marginTop={1}>
        <StatusBar
          models={modelNames}
          workingDir={fileTools.getWorkingDirectory()}
          messageCount={messages.filter((m) => m.role !== 'system').length}
          thinkingEnabled={config.supportsThinking ? modelManager.isThinkingEnabled() : undefined}
          reasoningLevel={config.supportsReasoning ? modelManager.getReasoningEffort() : undefined}
          mode={editingMode}
          mcpConnected={mcpManager?.isReady()}
        />
      </Box>

      {/* Bash Approval - Overlayed at bottom */}
      {activeDialog === 'bash-approval' && pendingBashCommand && (
        <Box marginTop={2} borderStyle="round" borderColor="red" padding={1}>
          <BashApprovalPrompt
            command={pendingBashCommand}
            onApprove={() => {
              setPendingBashCommand(null);
              setActiveDialog(null);
              if (bashApprovalResolver) {
                bashApprovalResolver(true);
                setBashApprovalResolver(null);
              }
            }}
            onDeny={() => {
              setPendingBashCommand(null);
              setActiveDialog(null);
              if (bashApprovalResolver) {
                bashApprovalResolver(false);
                setBashApprovalResolver(null);
              }
            }}
            onAlwaysApprove={() => {
              const setup = fileSystem.loadSetup();
              setup.approvedCommands.push(pendingBashCommand);
              fileSystem.saveSetup(setup);
              setPendingBashCommand(null);
              setActiveDialog(null);
              if (bashApprovalResolver) {
                bashApprovalResolver(true);
                setBashApprovalResolver(null);
              }
            }}
            onAlwaysDeny={() => {
              const setup = fileSystem.loadSetup();
              setup.deniedCommands.push(pendingBashCommand);
              fileSystem.saveSetup(setup);
              setPendingBashCommand(null);
              setActiveDialog(null);
              if (bashApprovalResolver) {
                bashApprovalResolver(false);
                setBashApprovalResolver(null);
              }
            }}
          />
        </Box>
      )}

      {/* File Approval - Overlayed at bottom */}
      {activeDialog === 'file-approval' && pendingFileOperation && (
        <Box marginTop={2}>
          <FileApprovalPrompt
            operation={pendingFileOperation.operation}
            filePath={pendingFileOperation.filePath}
            details={pendingFileOperation.details}
          />
        </Box>
      )}
    </Box>
  );
};
