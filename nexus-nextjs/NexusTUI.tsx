/**
 * Nexus TUI - Next.js Web Version
 * Full-featured chat interface converted from INK terminal UI
 */
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  streamMultiModelMessage,
  handleQuickSwitch as quickSwitchHelper,
  QUICK_SWITCHES,
} from './MultiModelManager.js';
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
  memoryTool: any;
  mcpServer: any;
  mcpManager: any;
  toolDefinitions: any[];
  intelligence?: any;
  intelligentCommands?: any;
}

export const NexusTUI: React.FC<Props> = ({ 
  modelManager, 
  fileSystem, 
  fileTools, 
  memoryTool, 
  mcpServer, 
  mcpManager, 
  toolDefinitions, 
  intelligence, 
  intelligentCommands 
}) => {
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

  // Debounce/spam prevention
  const [lastToggleTime, setLastToggleTime] = useState(0);
  const [thinkingToggling, setThinkingToggling] = useState(false);
  const tabTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const abortStreamRef = useRef(false);

  // Editing mode state
  const [editingMode, setEditingMode] = useState<EditingMode>('normal');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load initial data and setup approval callbacks
  useEffect(() => {
    const setup = fileSystem.loadSetup();
    setApprovedCommands(setup.approvedCommands || []);
    setDeniedCommands(setup.deniedCommands || []);

    // Setup bash approval callback
    fileTools.setBashApprovalCallback(async (command: string) => {
      if (editingMode === 'yolo') {
        return true;
      }

      if (editingMode === 'plan') {
        return false;
      }

      if (sessionApprovedCommands.some(pattern => command.startsWith(pattern))) {
        return true;
      }
      if (sessionDeniedCommands.some(pattern => command.startsWith(pattern))) {
        return false;
      }

      return new Promise((resolve) => {
        setPendingBashCommand(command);
        setBashApprovalResolver(() => resolve);
        setActiveDialog('bash-approval');
      });
    });

    // Setup file approval callback
    fileTools.setFileApprovalCallback(async (operation: string, filePath: string, details?: string) => {
      if (editingMode === 'yolo' || editingMode === 'autoedit') {
        return true;
      }

      if (editingMode === 'plan') {
        return false;
      }

      return new Promise((resolve) => {
        setPendingFileOperation({ operation, filePath, details });
        setFileApprovalResolver(() => resolve);
        setActiveDialog('file-approval');
      });
    });
  }, [editingMode, sessionApprovedCommands, sessionDeniedCommands]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key handling
      if (e.key === 'Escape') {
        if (isProcessing) {
          abortStreamRef.current = true;
          setIsProcessing(false);
        } else if (activeDialog) {
          setActiveDialog(null);
          setCommandFilter('');
          setSelectedCommandIndex(0);
        }
        return;
      }

      // Command dialog navigation
      if (activeDialog === 'commands') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCommandIndex(prev => Math.max(0, prev - 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const filteredCommands = COMMANDS.filter(cmd =>
            cmd.name.toLowerCase().includes(commandFilter.toLowerCase()) ||
            cmd.description.toLowerCase().includes(commandFilter.toLowerCase())
          );
          setSelectedCommandIndex(prev => Math.min(filteredCommands.length - 1, prev + 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const filteredCommands = COMMANDS.filter(cmd =>
            cmd.name.toLowerCase().includes(commandFilter.toLowerCase()) ||
            cmd.description.toLowerCase().includes(commandFilter.toLowerCase())
          );
          if (filteredCommands[selectedCommandIndex]) {
            handleCommand(filteredCommands[selectedCommandIndex].name);
          }
        }
      }

      // Tab key for thinking toggle
      if (e.key === 'Tab' && !activeDialog && !isProcessing) {
        e.preventDefault();
        handleThinkingToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDialog, isProcessing, commandFilter, selectedCommandIndex]);

  const handleThinkingToggle = useCallback(() => {
    const now = Date.now();
    if (now - lastToggleTime < 300 || thinkingToggling) return;

    setLastToggleTime(now);
    setThinkingToggling(true);

    if (tabTimeoutRef.current) {
      clearTimeout(tabTimeoutRef.current);
    }

    const config = modelManager.getModelConfig();
    if (config.supportsThinking) {
      const currentState = modelManager.isThinkingEnabled();
      modelManager.setThinking(!currentState);
      
      setMessages(prev => [...prev, {
        role: 'system' as const,
        content: `Extended thinking ${!currentState ? 'enabled' : 'disabled'} 🧠`,
        timestamp: new Date().toISOString(),
      }]);
    }

    tabTimeoutRef.current = setTimeout(() => {
      setThinkingToggling(false);
    }, 300);
  }, [lastToggleTime, thinkingToggling, modelManager]);

  const handleCommand = async (cmd: string) => {
    setActiveDialog(null);
    setCommandFilter('');
    setSelectedCommandIndex(0);

    const args = cmd.split(' ').slice(1).join(' ');
    const baseCmd = cmd.split(' ')[0];

    // Handle quick switches
    if (QUICK_SWITCHES[baseCmd]) {
      const result = quickSwitchHelper(baseCmd, modelManager, setMessages);
      if (result) {
        setSelectedModels([result.modelId]);
      }
      return;
    }

    // Handle all other commands
    switch (baseCmd) {
      case '/help':
        setMessages(prev => [...prev, {
          role: 'system' as const,
          content: generateHelpMessage(),
          timestamp: new Date().toISOString(),
        }]);
        break;

      case '/clear':
        setMessages([]);
        setMessages(prev => [...prev, {
          role: 'system' as const,
          content: 'Conversation cleared! Fresh start 🧹',
          timestamp: new Date().toISOString(),
        }]);
        break;

      case '/models':
        setActiveDialog('models');
        break;

      case '/permissions':
        setActiveDialog('permissions');
        break;

      case '/chaos':
        setChaosMode(!chaosMode);
        setMessages(prev => [...prev, {
          role: 'system' as const,
          content: `Chaos mode ${!chaosMode ? 'ENABLED' : 'disabled'} 🎭`,
          timestamp: new Date().toISOString(),
        }]);
        break;

      case '/exit':
      case '/fuckit':
        if (typeof window !== 'undefined') {
          window.close();
        }
        break;

      case '/status':
        const statusInfo = generateStatusMessage();
        setMessages(prev => [...prev, {
          role: 'system' as const,
          content: statusInfo,
          timestamp: new Date().toISOString(),
        }]);
        break;

      case '/memory':
        const tokenEstimate = estimateConversationTokens(messages);
        setMessages(prev => [...prev, {
          role: 'system' as const,
          content: `Memory usage: ~${tokenEstimate.toLocaleString()} tokens`,
          timestamp: new Date().toISOString(),
        }]);
        break;

      case '/caching':
        const cachingEnabled = modelManager.toggleCaching();
        setMessages(prev => [...prev, {
          role: 'system' as const,
          content: `Prompt caching ${cachingEnabled ? 'enabled' : 'disabled'} 💾`,
          timestamp: new Date().toISOString(),
        }]);
        break;

      case '/interleaved':
        handleThinkingToggle();
        break;

      default:
        // Pass command to intelligent command handler if available
        if (intelligentCommands) {
          const result = await intelligentCommands.handleCommand(baseCmd, args);
          if (result) {
            setMessages(prev => [...prev, {
              role: 'system' as const,
              content: result,
              timestamp: new Date().toISOString(),
            }]);
          }
        } else {
          setMessages(prev => [...prev, {
            role: 'system' as const,
            content: `Unknown command: ${baseCmd}. Type /help for available commands.`,
            timestamp: new Date().toISOString(),
          }]);
        }
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);

    // Show command autocomplete when starting with /
    if (value.startsWith('/') && !activeDialog) {
      setCommandFilter(value.slice(1));
      setActiveDialog('commands');
      setSelectedCommandIndex(0);
    } else if (activeDialog === 'commands' && !value.startsWith('/')) {
      setActiveDialog(null);
      setCommandFilter('');
    }
  };

  const handleInputSubmit = async (content: string | InputContentBlock[]) => {
    if (!content || (typeof content === 'string' && !content.trim())) return;

    const textContent = typeof content === 'string' ? content : 
      content.map(block => block.type === 'text' ? block.text : '[Image]').join('\n');

    // Check if it's a command
    if (textContent.startsWith('/')) {
      await handleCommand(textContent);
      setInputValue('');
      setInputHistory(prev => [...prev, textContent]);
      setHistoryIndex(-1);
      return;
    }

    // Add to history
    setInputHistory(prev => [...prev, textContent]);
    setHistoryIndex(-1);

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: textContent,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);
    abortStreamRef.current = false;

    try {
      if (chaosMode && selectedModels.length > 1) {
        // Chaos mode: all models respond simultaneously
        await streamMultiModelMessage(
          [...messages, userMessage],
          selectedModels,
          modelManager,
          fileTools,
          toolDefinitions,
          (modelId, chunk) => {
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant' && lastMsg.model === modelId) {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMsg, content: (lastMsg.content as string) + chunk }
                ];
              } else {
                return [...prev, {
                  role: 'assistant' as const,
                  content: chunk,
                  model: modelId,
                  timestamp: new Date().toISOString(),
                }];
              }
            });
          },
          () => abortStreamRef.current
        );
      } else {
        // Normal mode: single model
        const modelId = selectedModels[0];
        let fullResponse = '';
        
        await modelManager.streamMessage(
          [...messages, userMessage],
          (chunk) => {
            if (abortStreamRef.current) {
              throw new Error('Stream aborted');
            }
            fullResponse += chunk;
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.model) {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMsg, content: fullResponse }
                ];
              } else {
                return [...prev, {
                  role: 'assistant' as const,
                  content: fullResponse,
                  model: modelId,
                  timestamp: new Date().toISOString(),
                }];
              }
            });
          },
          toolDefinitions
        );
      }
    } catch (error: any) {
      if (error.message !== 'Stream aborted') {
        setMessages(prev => [...prev, {
          role: 'system' as const,
          content: `Error: ${error.message}`,
          timestamp: new Date().toISOString(),
        }]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const generateHelpMessage = (): string => {
    const commandsByCategory = {
      'Core Commands': ['/help', '/status', '/clear', '/compact', '/exit', '/fuckit'],
      'Model Management': ['/models', '/chaos', '/.claude', '/.sonnet', '/.gpt4', '/.o1'],
      'Intelligence': ['/analyze', '/context', '/relevant', '/suggest', '/issues', '/plan'],
      'File Operations': ['/add-dir', '/complex', '/deps', '/hotspots', '/restore-code'],
      'Settings': ['/permissions', '/caching', '/interleaved', '/computer-use', '/autosuggest', '/verbose'],
      'Utilities': ['/memory', '/cost', '/export', '/doctor', '/skill', '/bashes'],
    };

    let help = '=== NEXUS COMMANDS ===\n\n';
    for (const [category, commands] of Object.entries(commandsByCategory)) {
      help += `${category}:\n`;
      commands.forEach(cmd => {
        const command = COMMANDS.find(c => c.name === cmd);
        if (command) {
          help += `  ${command.name.padEnd(20)} ${command.description}\n`;
        }
      });
      help += '\n';
    }
    return help;
  };

  const generateStatusMessage = (): string => {
    const config = modelManager.getModelConfig();
    const modelNames = selectedModels.map(id => AVAILABLE_MODELS[id]?.name || id);
    
    return `=== NEXUS STATUS ===

Active Models: ${modelNames.join(', ')}
Working Directory: ${fileTools.getWorkingDirectory()}
Messages: ${messages.filter(m => m.role !== 'system').length}
Thinking: ${config.supportsThinking ? (modelManager.isThinkingEnabled() ? 'Enabled' : 'Disabled') : 'N/A'}
Caching: ${modelManager.isCachingEnabled() ? 'Enabled' : 'Disabled'}
Mode: ${MODE_DESCRIPTIONS[editingMode]}
Chaos Mode: ${chaosMode ? 'ENABLED 🎭' : 'Disabled'}
MCP: ${mcpManager?.isReady() ? 'Connected' : 'Disconnected'}`;
  };

  if (showBoot) {
    return <BootSequence onComplete={() => setShowBoot(false)} />;
  }

  const modelNames = selectedModels.map(id => AVAILABLE_MODELS[id]?.name || id);
  const config = modelManager.getModelConfig();

  return (
    <div className="nexus-container">
      <style jsx>{`
        .nexus-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #0a0e14;
          color: #b3b9c5;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          scroll-behavior: smooth;
        }

        .message {
          margin-bottom: 16px;
          padding: 12px;
          border-radius: 8px;
          animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
          background: #1a1f2e;
          border-left: 3px solid #ff9500;
        }

        .message.assistant {
          background: #15191f;
          border-left: 3px solid #00ff9f;
        }

        .message.system {
          background: #1a1a2e;
          border-left: 3px solid #ffcc00;
          font-style: italic;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
          opacity: 0.7;
        }

        .message-content {
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .input-container {
          padding: 20px;
          background: #0d1117;
          border-top: 1px solid #30363d;
        }

        .input-wrapper {
          position: relative;
        }

        .input-field {
          width: 100%;
          min-height: 60px;
          max-height: 200px;
          padding: 12px;
          background: #1a1f2e;
          border: 2px solid #30363d;
          border-radius: 8px;
          color: #b3b9c5;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          transition: border-color 0.2s;
        }

        .input-field:focus {
          outline: none;
          border-color: #ff9500;
        }

        .input-field:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .processing-indicator {
          text-align: center;
          padding: 12px;
          color: #ff9500;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease-in;
        }

        .dialog-content {
          background: #1a1f2e;
          border: 2px solid #ff9500;
          border-radius: 12px;
          padding: 24px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .help-text {
          text-align: center;
          padding: 12px;
          color: #ff9500;
          opacity: 0.7;
          font-size: 12px;
        }

        .status-bar {
          padding: 12px 20px;
          background: #0d1117;
          border-top: 1px solid #30363d;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          background: #1a1f2e;
          color: #ff9500;
        }

        .command-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .command-item {
          padding: 12px;
          cursor: pointer;
          border-radius: 6px;
          margin-bottom: 4px;
          transition: background 0.2s;
        }

        .command-item:hover {
          background: #252a35;
        }

        .command-item.selected {
          background: #ff9500;
          color: #0a0e14;
        }

        .command-name {
          font-weight: bold;
          margin-bottom: 4px;
        }

        .command-description {
          font-size: 12px;
          opacity: 0.7;
        }
      `}</style>

      {/* Messages */}
      <div className="messages-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-header">
              <span>{msg.role === 'user' ? '👤 You' : msg.role === 'assistant' ? `🤖 ${msg.model || modelNames[0]}` : '⚙️ System'}</span>
              {msg.timestamp && <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>}
            </div>
            <div className="message-content">
              <MessageRenderer messages={[msg]} currentModel={modelNames[0]} />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="processing-indicator">
          ⚡ {modelNames.join(', ')} is processing...
        </div>
      )}

      {/* Command Dialog */}
      {activeDialog === 'commands' && (
        <div className="dialog-overlay" onClick={() => setActiveDialog(null)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#ff9500' }}>Commands</h3>
            <div className="command-list">
              {COMMANDS
                .filter(cmd =>
                  cmd.name.toLowerCase().includes(commandFilter.toLowerCase()) ||
                  cmd.description.toLowerCase().includes(commandFilter.toLowerCase())
                )
                .map((cmd, idx) => (
                  <div
                    key={cmd.name}
                    className={`command-item ${idx === selectedCommandIndex ? 'selected' : ''}`}
                    onClick={() => handleCommand(cmd.name)}
                  >
                    <div className="command-name">{cmd.name}</div>
                    <div className="command-description">{cmd.description}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Model Selector Dialog */}
      {activeDialog === 'models' && (
        <div className="dialog-overlay" onClick={() => setActiveDialog(null)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}

      {/* Permissions Dialog */}
      {activeDialog === 'permissions' && (
        <div className="dialog-overlay" onClick={() => setActiveDialog(null)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}

      {/* Bash Approval Dialog */}
      {activeDialog === 'bash-approval' && pendingBashCommand && (
        <div className="dialog-overlay">
          <div className="dialog-content">
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
          </div>
        </div>
      )}

      {/* File Approval Dialog */}
      {activeDialog === 'file-approval' && pendingFileOperation && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <FileApprovalPrompt
              operation={pendingFileOperation.operation}
              filePath={pendingFileOperation.filePath}
              details={pendingFileOperation.details}
            />
          </div>
        </div>
      )}

      {/* Input */}
      <div className="input-container">
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            className="input-field"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleInputSubmit(inputValue);
              }
              if (e.key === 'ArrowUp' && inputValue === '' && inputHistory.length > 0) {
                e.preventDefault();
                const newIndex = historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIndex);
                setInputValue(inputHistory[newIndex]);
              }
              if (e.key === 'ArrowDown' && historyIndex !== -1) {
                e.preventDefault();
                const newIndex = Math.min(inputHistory.length - 1, historyIndex + 1);
                setHistoryIndex(newIndex);
                setInputValue(newIndex === inputHistory.length - 1 ? '' : inputHistory[newIndex]);
              }
            }}
            placeholder="Ready when you are... (/ for commands, Enter to send, Shift+Enter for new line)"
            disabled={isProcessing}
          />
        </div>
        <div className="help-text">
          {isProcessing
            ? 'Press ESC to interrupt'
            : '/ = commands | ↑↓ = history | Tab = thinking | Esc = cancel | /help = all commands'
          }
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <StatusBar
          models={modelNames}
          workingDir={fileTools.getWorkingDirectory()}
          messageCount={messages.filter((m) => m.role !== 'system').length}
          thinkingEnabled={config.supportsThinking ? modelManager.isThinkingEnabled() : undefined}
          reasoningLevel={config.supportsReasoning ? modelManager.getReasoningEffort() : undefined}
          mode={editingMode}
          mcpConnected={mcpManager?.isReady()}
        />
      </div>
    </div>
  );
};
