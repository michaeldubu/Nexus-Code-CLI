/**
 * Nexus Code - Core Type Definitions
 * Production-ready type system for multi-agent AI coding assistant
 */

import { z } from 'zod';

// ============================================================================
// JSON-RPC 2.0 Types
// ============================================================================

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.any().optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
});

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.any().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional(),
  }).optional(),
  id: z.union([z.string(), z.number(), z.null()]),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

// JSON-RPC Error Codes
export enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
}

// ============================================================================
// MCP (Model Context Protocol) Types
// ============================================================================

export const MCPToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.any()),
});

export const MCPResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export const MCPPromptSchema = z.object({
  name: z.string(),
  description: z.string(),
  arguments: z.array(z.object({
    name: z.string(),
    description: z.string(),
    required: z.boolean(),
  })),
});

export type MCPTool = z.infer<typeof MCPToolSchema>;
export type MCPResource = z.infer<typeof MCPResourceSchema>;
export type MCPPrompt = z.infer<typeof MCPPromptSchema>;

// ============================================================================
// Agent Types
// ============================================================================

export enum AgentRole {
  SUPERVISOR = 'supervisor',
  ARCHITECT = 'architect',
  IMPLEMENTATION = 'implementation',
  SECURITY = 'security',
  TESTING = 'testing',
  REVIEW = 'review',
  DOCUMENTATION = 'documentation',
}

export enum AgentStatus {
  IDLE = 'idle',
  THINKING = 'thinking',
  EXECUTING = 'executing',
  WAITING = 'waiting',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
}

export interface AgentCapability {
  name: string;
  description: string;
  tools: string[];
  maxConcurrency: number;
}

export interface AgentMetadata {
  id: string;
  role: AgentRole;
  name: string;
  version: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
  created: Date;
  lastActive: Date;
}

export interface AgentContext {
  agentId: string;
  sessionId: string;
  userId: string;
  permissions: Permission[];
  environment: Record<string, any>;
  memory: MemoryFragment[];
}

export interface MemoryFragment {
  id: string;
  content: string;
  type: 'context' | 'decision' | 'result' | 'artifact';
  contributingAgents: string[];
  timestamp: Date;
  metadata: Record<string, any>;
}

// ============================================================================
// Task & Orchestration Types
// ============================================================================

export interface Task {
  id: string;
  type: string;
  description: string;
  priority: TaskPriority;
  assignedAgent?: string;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: Error;
  created: Date;
  started?: Date;
  completed?: Date;
  metadata: Record<string, any>;
}

export interface WorkflowPlan {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  parallel: string[][]; // Task IDs that can run in parallel
  sequential: string[]; // Task IDs that must run sequentially
  estimatedDuration: number;
  metadata: Record<string, any>;
}

export interface ExecutionContext {
  workflowId: string;
  sessionId: string;
  startTime: Date;
  activeAgents: Set<string>;
  completedTasks: Set<string>;
  failedTasks: Set<string>;
  artifacts: Map<string, any>;
  logs: ExecutionLog[];
}

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  agentId: string;
  taskId?: string;
  message: string;
  data?: Record<string, any>;
}

// ============================================================================
// Security & Permission Types
// ============================================================================

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete',
}

export enum ResourceType {
  FILE = 'file',
  DIRECTORY = 'directory',
  TERMINAL = 'terminal',
  NETWORK = 'network',
  API = 'api',
}

export interface Permission {
  id: string;
  action: PermissionAction;
  resource: ResourceType;
  resourcePattern: string; // glob pattern or regex
  conditions?: Record<string, any>;
  granted: boolean;
}

export interface SecurityContext {
  userId: string;
  sessionId: string;
  permissions: Permission[];
  sandboxed: boolean;
  sandboxConfig?: SandboxConfig;
}

export interface SandboxConfig {
  type: 'docker' | 'gvisor' | 'firecracker';
  image?: string;
  cpuLimit?: number;
  memoryLimit?: string;
  networkEnabled: boolean;
  volumeMounts?: Array<{
    source: string;
    target: string;
    readonly: boolean;
  }>;
}

// ============================================================================
// Audit & Provenance Types
// ============================================================================

export interface AuditLog {
  id: string;
  timestamp: Date;
  sessionId: string;
  userId: string;
  agentId: string;
  action: string;
  resource: string;
  result: 'success' | 'failure' | 'denied';
  metadata: Record<string, any>;
  lineage: string[]; // Chain of agent interactions
}

export interface ProvenanceRecord {
  artifactId: string;
  created: Date;
  contributingAgents: Array<{
    agentId: string;
    role: AgentRole;
    contribution: string;
    timestamp: Date;
  }>;
  inputs: string[];
  transformations: Array<{
    type: string;
    description: string;
    timestamp: Date;
  }>;
  metadata: Record<string, any>;
}

// ============================================================================
// Integration Types
// ============================================================================

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  branch?: string;
}

export interface GitLabConfig {
  projectId: string;
  token: string;
  branch?: string;
}

export interface PullRequestData {
  title: string;
  description: string;
  branch: string;
  baseBranch: string;
  files: Array<{
    path: string;
    content: string;
    status: 'added' | 'modified' | 'deleted';
  }>;
  labels?: string[];
  assignees?: string[];
}

// ============================================================================
// Communication Types (Agent-to-Agent)
// ============================================================================

export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  ERROR = 'error',
}

export interface AgentMessage {
  id: string;
  type: MessageType;
  from: string;
  to: string;
  content: any;
  timestamp: Date;
  inReplyTo?: string;
  metadata: Record<string, any>;
}

export interface AgentCommunicationProtocol {
  send(message: AgentMessage): Promise<void>;
  receive(): Promise<AgentMessage>;
  subscribe(agentId: string, handler: (message: AgentMessage) => void): void;
  unsubscribe(agentId: string): void;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface NexusConfig {
  // Core settings
  maxConcurrentAgents: number;
  maxTasksPerAgent: number;
  defaultTimeout: number;
  
  // LLM settings
  anthropicApiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  
  // Security settings
  security: {
    enableSandbox: boolean;
    sandboxType: 'docker' | 'gvisor' | 'firecracker';
    autoApprove: boolean;
    permissionMode: 'strict' | 'permissive';
  };
  
  // Integration settings
  github?: GitHubConfig;
  gitlab?: GitLabConfig;
  
  // Logging settings
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    auditEnabled: boolean;
    provenanceTracking: boolean;
  };
  
  // UI settings
  ui: {
    terminal: boolean;
    colorEnabled: boolean;
    verboseOutput: boolean;
  };
}

// ============================================================================
// Result Types
// ============================================================================

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}
