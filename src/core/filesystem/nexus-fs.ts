/**
 * Nexus Filesystem Manager
 * Handles .nexus directory structure, conversation history, file backups, and configuration
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface NexusSetup {
  systemPrompt?: string;
  approvedCommands: string[];
  deniedCommands: string[];
  defaultModel: string;
  modelPreferences: {
    [model: string]: {
      temperature?: number;
      maxTokens?: number;
      thinking?: boolean;
      reasoning?: 'high' | 'low';
    };
  };
  permissions: {
    autoApprove: boolean;
    allowedPaths: string[];
    deniedPaths: string[];
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: string;
  thinking?: string;
  toolCalls?: any[];
  fileChanges?: FileChange[];
}

export interface FileChange {
  path: string;
  action: 'create' | 'edit' | 'delete';
  timestamp: string;
  backupPath?: string;
  diff?: string;
}

export interface ConversationSession {
  id: string;
  startTime: string;
  lastActive: string;
  model: string;
  messages: ConversationMessage[];
  fileChanges: FileChange[];
  workingDirectory: string;
}

export class NexusFileSystem {
  private nexusDir: string;
  private conversationsDir: string;
  private fileHistoryDir: string;
  private logsDir: string;
  private modelsDir: string;
  private setupPath: string;
  private currentSessionPath: string;
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    // .nexus in the user's home directory
    this.nexusDir = join(homedir(), '.nexus');
    this.workingDir = workingDir;
    this.conversationsDir = join(this.nexusDir, 'conversations');
    this.fileHistoryDir = join(this.nexusDir, 'file-history');
    this.logsDir = join(this.nexusDir, 'logs');
    this.modelsDir = join(this.nexusDir, 'models');
    this.setupPath = join(this.nexusDir, 'setup.json');
    this.currentSessionPath = join(this.conversationsDir, 'current.json');

    this.ensureDirectories();
  }

  /**
   * Ensure all required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.nexusDir,
      this.conversationsDir,
      this.fileHistoryDir,
      this.logsDir,
      this.modelsDir,
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Load or create setup configuration
   */
  loadSetup(): NexusSetup {
    if (existsSync(this.setupPath)) {
      const data = readFileSync(this.setupPath, 'utf-8');
      return JSON.parse(data);
    }

    // Default setup with pre-approved safe commands
    const defaultSetup: NexusSetup = {
      systemPrompt: undefined,
      approvedCommands: [
        'ls',
        'pwd',
        'cat',
        'git status',
        'git diff',
        'git log',
      ],
      deniedCommands: [
        'rm -rf',
        'sudo',
        'chmod 777',
        'dd',
      ],
      defaultModel: 'claude-haiku-4-5-20250514',
      modelPreferences: {
        'claude-sonnet-4-5-20250929': {
          temperature: 1.0,
          maxTokens: 64000,
          thinking: true,
        },
        'claude-haiku-4-5-20250514': {
          temperature: 1.0,
          maxTokens: 64000,
          thinking: false,
        },
        'gpt-5': {
          temperature: 1.0,
          maxTokens: 30000,
          reasoning: 'high',
        },
      },
      permissions: {
        autoApprove: false,
        allowedPaths: [],
        deniedPaths: ['credentials.json', '*.key', '*.pem'],
      },
    };

    this.saveSetup(defaultSetup);
    return defaultSetup;
  }

  /**
   * Save setup configuration
   */
  saveSetup(setup: NexusSetup): void {
    writeFileSync(this.setupPath, JSON.stringify(setup, null, 2), 'utf-8');
  }

  /**
   * Create a new conversation session
   */
  createSession(model: string): ConversationSession {
    const session: ConversationSession = {
      id: uuidv4(),
      startTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      model,
      messages: [],
      fileChanges: [],
      workingDirectory: process.cwd(),
    };

    this.saveSession(session);
    this.setCurrentSession(session);
    return session;
  }

  /**
   * Load current session or create new one
   */
  loadCurrentSession(model?: string): ConversationSession {
    if (existsSync(this.currentSessionPath)) {
      const data = readFileSync(this.currentSessionPath, 'utf-8');
      const session = JSON.parse(data) as ConversationSession;

      // Update last active
      session.lastActive = new Date().toISOString();

      return session;
    }

    return this.createSession(model || 'claude-haiku-4-5-20250514');
  }

  /**
   * Save session to disk
   */
  saveSession(session: ConversationSession): void {
    const sessionPath = join(this.conversationsDir, `session-${session.id}.json`);
    writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * Set current session
   */
  setCurrentSession(session: ConversationSession): void {
    writeFileSync(this.currentSessionPath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * Add message to current session
   */
  addMessage(message: ConversationMessage): void {
    const session = this.loadCurrentSession();
    session.messages.push(message);
    session.lastActive = new Date().toISOString();

    this.saveSession(session);
    this.setCurrentSession(session);
  }

  /**
   * Backup a file before editing
   */
  backupFile(filePath: string): string {
    if (!existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = filePath.replace(/\//g, '_');
    const backupPath = join(this.fileHistoryDir, `${fileName}-${timestamp}.backup`);

    const content = readFileSync(filePath, 'utf-8');
    writeFileSync(backupPath, content, 'utf-8');

    return backupPath;
  }

  /**
   * Record a file change
   */
  recordFileChange(change: FileChange): void {
    const session = this.loadCurrentSession();
    session.fileChanges.push(change);

    this.saveSession(session);
    this.setCurrentSession(session);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ConversationSession[] {
    const files = readdirSync(this.conversationsDir);
    const sessions: ConversationSession[] = [];

    for (const file of files) {
      if (file.startsWith('session-') && file.endsWith('.json')) {
        const filePath = join(this.conversationsDir, file);
        const data = readFileSync(filePath, 'utf-8');
        sessions.push(JSON.parse(data));
      }
    }

    // Sort by last active (most recent first)
    return sessions.sort((a, b) =>
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    );
  }

  /**
   * Get recent file changes (for /restore-code)
   */
  getRecentFileChanges(limit: number = 10): FileChange[] {
    const session = this.loadCurrentSession();
    return session.fileChanges.slice(-limit).reverse();
  }

  /**
   * Restore file from backup
   */
  restoreFile(backupPath: string, targetPath: string): void {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup does not exist: ${backupPath}`);
    }

    const content = readFileSync(backupPath, 'utf-8');
    writeFileSync(targetPath, content, 'utf-8');
  }

  /**
   * Log to nexus log file
   */
  log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const logPath = join(this.logsDir, 'nexus.log');
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    writeFileSync(logPath, logLine, { flag: 'a', encoding: 'utf-8' });
  }

  /**
   * Clear current session (start fresh)
   */
  clearCurrentSession(): void {
    if (existsSync(this.currentSessionPath)) {
      // Archive current session first
      const session = this.loadCurrentSession();
      this.saveSession(session);

      // Remove current.json
      const fs = require('fs');
      fs.unlinkSync(this.currentSessionPath);
    }
  }

  /**
   * Get messages for restoration (fork points)
   */
  getRestorePoints(limit: number = 15): Array<{
    index: number;
    message: ConversationMessage;
    preview: string;
  }> {
    const session = this.loadCurrentSession();
    const assistantMessages = session.messages
      .map((msg, idx) => ({ msg, idx }))
      .filter(({ msg }) => msg.role === 'assistant' && (msg.fileChanges?.length || 0) > 0)
      .slice(-limit)
      .reverse();

    return assistantMessages.map(({ msg, idx }) => ({
      index: idx,
      message: msg,
      preview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
    }));
  }

  /**
   * Fork conversation from a specific point
   */
  forkFromMessage(messageIndex: number): ConversationSession {
    const session = this.loadCurrentSession();

    // Create new session with messages up to the fork point
    const forkedSession: ConversationSession = {
      id: uuidv4(),
      startTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      model: session.model,
      messages: session.messages.slice(0, messageIndex + 1),
      fileChanges: session.fileChanges.filter(change => {
        const changeTime = new Date(change.timestamp);
        const forkMessage = session.messages[messageIndex];
        const forkTime = new Date(forkMessage.timestamp);
        return changeTime <= forkTime;
      }),
      workingDirectory: session.workingDirectory,
    };

    this.saveSession(forkedSession);
    this.setCurrentSession(forkedSession);

    return forkedSession;
  }
}
