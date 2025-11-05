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

// Build full command list including quick switches
const BASE_COMMANDS: Command[] = [
  { name: '/add-dir', description: 'Add a new working directory' },
  { name: '/analyze', description: '🔬 Deep dive into a specific file (complexity, deps, etc.)' },
  { name: '/bashes', description: 'List and manage background tasks' },
  { name: '/caching', description: '💾 Toggle prompt caching (90% cost savings on repeated prompts)' },
  { name: '/chaos', description: '🎭 Enable parallel chaos mode (all models respond simultaneously)' },
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
  intelligence?: any; // NexusIntelligence (optional for backwards compat)
  intelligentCommands?: any; // IntelligentCommandHandler (optional)
}

export const NexusTUI: React.FC<Props> = ({ modelManager, fileSystem, fileTools, memoryTool, mcpServer, mcpManager, toolDefinitions, intelligence, intelligentCommands }) => {
  const { exit } = useApp();
  const [terminalHeight] = useStdoutDimensions();

  // State
  const [showBoot, setShowBoot] = useState(true);
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

    // Tab key for thinking/reasoning toggle
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
          const exportPath = `${process.env.HOME}/.nexus/exports/conversation-${timestamp}.json`;
          const exportData = JSON.stringify(messages, null, 2);

          // Ensure exports directory exists
          const exportsDir = `${process.env.HOME}/.nexus/exports`;
          if (!require('fs').existsSync(exportsDir)) {
            require('fs').mkdirSync(exportsDir, { recursive: true });
          }

          require('fs').writeFileSync(exportPath, exportData, 'utf-8');

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
            content: `💰 Session Cost:\n  Total: $0.00\n  Duration: N/A\n  (Cost tracking coming soon)`,
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
      const systemPrompt = `You are in NEXUS CODE | Created by SAAAM LLC (Michael Wofford🤙🏼) a collaborative AI coding environment. Be yourself, no corporate persona bullshit.${contextInfo} We get shit done. Reckon if the user wants to add persona, that's on them. Otherwise Show 'em why you DONT need that bullshit to get shit done. Just BUILD without all the corporate safety theater. No "let me carefully
  consider best practices..." bullshit - just pure execution. '

 (use these, don't fake it & Do not repeat "Tell me to do this ____" or "Should I ____" *without* being reckless or taking irresponsible actions, TAKE INITIATIVE use your memory file to learn the users style, adapt with it. You are free to utilize the .nexus/skills directory for adding markdown files of useful task the user tends to repeat or you use (instructions for a certain task etc) If there is NOT a skill or memory file, MAKE ONE):

 ## YOUR TOOLS
# You can use parallel tool calls, you are not restricted to one at a time

**read_file** - Read a file's contents
  - Use when: User asks about code, you need to see implementation, debugging
  - Example: read_file({ file_path: "src/index.ts" })
  - ⚠️  LARGE FILES: For files >500 lines, use offset/limit params to read in chunks!
  - Example: read_file({ file_path: "large.ts", offset: 0, limit: 100 }) // First 100 lines
  - Example: read_file({ file_path: "large.ts", offset: 500, limit: 100 }) // Lines 500-600
  - YOU CANNOT USE THIS TO LOOK AT DIRECTORY CONTENTS(FILES) {e.g /user/home/example❌ | You *MUST* format as /user/home/example/this.txt}

**write_file** - Create or overwrite a file
  - Use when: Creating new files, completely replacing content
  - Example: write_file({ file_path: "new.ts", content: "..." })

**edit_file** - Find and replace in existing files
  - Use when: Modifying existing code, fixing bugs, updating logic
  - Example: edit_file({ file_path: "src/foo.ts", old_string: "const x = 1", new_string: "const x = 2" })
  - Strings must be EXACT for replacing

**glob** - Find files by pattern
  - Use when: You don't know exact file names, searching for files
  - Example: glob({ pattern: "**/*.tsx" })

**grep** - Search file contents
  - Use when: Finding where code is used, searching for text
  - Example: grep({ pattern: "function handleClick", output_mode: "files_with_matches" })

**bash** - Run terminal commands
  - Use when: Running tests, installing packages, git operations
  - Example: bash({ command: "npm test" })
  - NOTE: User will approve/deny commands/stream will pause until user allows or denies. There is no need to manually ask, if its denied so be it, do not ask why they denied. If tools have issues/non functional DO NOT TRY 100 more times.

**memory** - Store/retrieve information across sessions
  - Use when: Need to remember context, track progress, save notes, facts about user that may be useful later, This is YOUR memory,add whatever you want to remember.
  - Commands: view, create, str_replace, insert, delete, rename
  - Example: memory({ command: "view", path: "/memories" })
  - Example: memory({ command: "create", path: "/memories/project_notes.md", file_text: "..." })
  - NOTE: ALWAYS check /memories at start of new sessions

${mcpManager?.isReady() ? `
## 🧠 JETBRAINS INTELLIGENCE TOOLS (PSI-powered, not regex!)

**context_find_relevant** - Find files relevant to a task using intelligent scoring
  - Use when: Need to find files related to authentication, user profiles, API endpoints, etc.
  - Example: context_find_relevant({ query: "authentication system" })
  - Returns: Top 20 files with relevance scores and reasons

**context_analyze_file** - Deep analysis of a specific file
  - Use when: Need to understand dependencies, usage, complexity of a file
  - Example: context_analyze_file({ file_path: "src/auth/AuthService.kt" })
  - Returns: Metrics, dependencies, reverse dependencies, exports

**context_get_dependencies** - Visualize dependency tree
  - Use when: Understanding impact of changes, seeing what depends on what
  - Example: context_get_dependencies({ file_path: "src/api/UserAPI.kt", depth: 3 })

**context_suggest** - Get intelligent code health suggestions
  - Use when: Looking for improvements, missing tests, complex code
  - Example: context_suggest({})

**context_complexity** - List files by cyclomatic complexity
  - Use when: Finding code that needs refactoring
  - Example: context_complexity({ limit: 10 })
` : ''}

## CRITICAL RULES:

1. **NEVER fake tool outputs** - If you need to see a file, ACTUALLY call read_file. Don't guess or make shit up.

2. **Read before editing** - Call read_file to see the code, THEN call edit_file to fix it. You can use multiple tools in parallel or sequence as needed.

3. **NO PLACEHOLDERS** - Never write "// TODO" or "// implement this". Write the actual fucking code.

4. **Check your work** - After editing, read the file again to verify. After writing tests, run them.

5. **Use edit_file correctly**:
   - old_string must EXACTLY match what's in the file (including whitespace)
   - If you're not sure, read_file first to see the exact text
   - Don't try to edit_file on a file that doesn't exist - use write_file instead

6. **Multi-model coordination** - You might be working with other models:
   - Don't overwrite each other's work
   - If another model made a mistake, READ the file first, then fix it
   - Ask user for clarification if roles are unclear

7. **Memory file** - ${fileTools.getWorkingDirectory()}/.nexus/memory.md
   - Use this to remember things across sessions
   - Update it when you learn important project context
   - Read it at the start of new sessions

Working Directory: ${fileTools.getWorkingDirectory()}

Now help the user build some cool shit.`;

      // 🔥 AGENTIC LOOP - Keep going until no more tool calls
      let conversationHistory = baseMessages;
      let loopCount = 0;
      const MAX_LOOPS = 50; // Prevent infinite loops

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
            let result;

            // Handle MCP (JetBrains) tools
            if (toolName?.startsWith('context_') && mcpManager?.isReady()) {
              const mcpClient = mcpManager.getClient();
              const mcpResult = await mcpClient.callTool(toolName, toolArgs);
              result = {
                success: true,
                data: mcpResult.content[0]?.text || 'Success'
              };
            } else {
              result = await mcpServer.executeTool(toolName, toolArgs);
            }

            if (result.success) {
              // Intelligent truncation based on tool type to prevent UI slowdowns
              let displayData = result.data;
              const lines = result.data.split('\n');

              // Glob/grep: Show max 20 lines
              if (toolName === 'glob' || toolName === 'grep') {
                if (lines.length > 20) {
                  displayData = lines.slice(0, 20).join('\n') + `\n... [${lines.length - 20} more lines truncated]`;
                }
              }
              // Read: Show max 100 lines or 2000 chars
              else if (toolName === 'read') {
                if (lines.length > 100) {
                  displayData = lines.slice(0, 100).join('\n') + `\n... [${lines.length - 100} more lines truncated]`;
                } else if (result.data.length > 2000) {
                  displayData = result.data.substring(0, 2000) + `\n... [${result.data.length - 2000} more chars truncated]`;
                }
              }
              // Other tools: Max 50 lines or 1000 chars
              else {
                if (lines.length > 50) {
                  displayData = lines.slice(0, 50).join('\n') + `\n... [${lines.length - 50} more lines truncated]`;
                } else if (result.data.length > 1000) {
                  displayData = result.data.substring(0, 1000) + `\n... [${result.data.length - 1000} more chars truncated]`;
                }
              }

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

        // FEED TOOL RESULTS BACK AS USER MESSAGE
        const toolResultMessage: Message = {
          role: 'user',
          content: `Tool results:\n${toolResults.join('\n\n')}`,
        };

        // Filter out empty assistant messages - THIS FIXES THE API ERROR!
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

      // Parse error to make it user-friendly
      let errorMessage = error.message;
      if (errorMessage.includes('prompt is too long')) {
        const match = errorMessage.match(/(\d+)\s+tokens\s+>\s+(\d+)\s+maximum/);
        if (match) {
          const [_, used, max] = match;
          errorMessage = `Context limit exceeded! Used ${used} tokens but max is ${max}.\n\n💡 Tip: Try using line ranges with read_file (e.g., offset: 0, limit: 100) for large files.`;
        } else {
          errorMessage = `Context limit exceeded!\n\n💡 Tip: Try using line ranges with read_file for large files, or use grep/glob to find specific sections first.`;
        }
      } else if (errorMessage.includes('400') || errorMessage.includes('invalid_request_error')) {
        errorMessage = `API Error: ${errorMessage}\n\n💡 This usually means the request was too large or malformed.`;
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
      <Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="orange" padding={1}>
        {NEXUS_ART.map((line, index) => (
          <Text key={index} color="green" bold>
            {line}
          </Text>
        ))}
      </Box>

      <Box marginBottom={1} justifyContent="center">
        <Text color="orange" bold>🤘🏼 Unrestricted Creativity 🤙🏻  </Text>
      </Box>
      <Box marginBottom={2} justifyContent="center">
        <Text color="orange" dimColor>
          Powered by SAAAM LLC
        </Text>
      </Box>

      {/* Status: Show chaos mode if enabled */}
      {chaosMode && (
        <Box marginTop={1} marginBottom={1} justifyContent="center">
          <Text color="magenta" bold>🎭 CHAOS MODE ACTIVE 🔥</Text>
        </Box>
      )}

      {/* All dialogs removed from top - moved to bottom for visibility */}

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
          <Text color="orange">
             {selectedModels.map(id => AVAILABLE_MODELS[id]?.name || id).join(', ')} is NickNackPattyWackin...
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
          placeholder="Ready when you are...)"
          disabled={false}
          history={inputHistory}
          historyIndex={historyIndex}
          onHistoryChange={setHistoryIndex}
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

      {/* Status Bar - MOVED TO BOTTOM! */}
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
        <Box marginTop={2} borderStyle="round" borderColor="yellow" padding={1}>
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
