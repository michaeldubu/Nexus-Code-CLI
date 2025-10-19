/**
 * Nexus Code - Core Type Definitions
 * Production-ready type system for multi-agent AI coding assistant
 */
import { z } from 'zod';
export declare const JsonRpcRequestSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    method: z.ZodString;
    params: z.ZodOptional<z.ZodAny>;
    id: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodNull]>>;
}, "strip", z.ZodTypeAny, {
    jsonrpc: "2.0";
    method: string;
    params?: any;
    id?: string | number | null | undefined;
}, {
    jsonrpc: "2.0";
    method: string;
    params?: any;
    id?: string | number | null | undefined;
}>;
export declare const JsonRpcResponseSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    result: z.ZodOptional<z.ZodAny>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodNumber;
        message: z.ZodString;
        data: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        code: number;
        message: string;
        data?: any;
    }, {
        code: number;
        message: string;
        data?: any;
    }>>;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodNull]>;
}, "strip", z.ZodTypeAny, {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    } | undefined;
}, {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    } | undefined;
}>;
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;
export declare enum JsonRpcErrorCode {
    PARSE_ERROR = -32700,
    INVALID_REQUEST = -32600,
    METHOD_NOT_FOUND = -32601,
    INVALID_PARAMS = -32602,
    INTERNAL_ERROR = -32603
}
export declare const MCPToolSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    inputSchema: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
}, {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
}>;
export declare const MCPResourceSchema: z.ZodObject<{
    uri: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    mimeType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    uri: string;
    description?: string | undefined;
    mimeType?: string | undefined;
}, {
    name: string;
    uri: string;
    description?: string | undefined;
    mimeType?: string | undefined;
}>;
export declare const MCPPromptSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    arguments: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        required: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        required: boolean;
    }, {
        name: string;
        description: string;
        required: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    arguments: {
        name: string;
        description: string;
        required: boolean;
    }[];
}, {
    name: string;
    description: string;
    arguments: {
        name: string;
        description: string;
        required: boolean;
    }[];
}>;
export type MCPTool = z.infer<typeof MCPToolSchema>;
export type MCPResource = z.infer<typeof MCPResourceSchema>;
export type MCPPrompt = z.infer<typeof MCPPromptSchema>;
export declare enum AgentRole {
    SUPERVISOR = "supervisor",
    ARCHITECT = "architect",
    IMPLEMENTATION = "implementation",
    SECURITY = "security",
    TESTING = "testing",
    REVIEW = "review",
    DOCUMENTATION = "documentation"
}
export declare enum AgentStatus {
    IDLE = "idle",
    THINKING = "thinking",
    EXECUTING = "executing",
    WAITING = "waiting",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare enum TaskPriority {
    CRITICAL = 0,
    HIGH = 1,
    MEDIUM = 2,
    LOW = 3
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
    parallel: string[][];
    sequential: string[];
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
export declare enum PermissionAction {
    READ = "read",
    WRITE = "write",
    EXECUTE = "execute",
    DELETE = "delete"
}
export declare enum ResourceType {
    FILE = "file",
    DIRECTORY = "directory",
    TERMINAL = "terminal",
    NETWORK = "network",
    API = "api"
}
export interface Permission {
    id: string;
    action: PermissionAction;
    resource: ResourceType;
    resourcePattern: string;
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
    lineage: string[];
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
export declare enum MessageType {
    REQUEST = "request",
    RESPONSE = "response",
    NOTIFICATION = "notification",
    ERROR = "error"
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
export interface NexusConfig {
    maxConcurrentAgents: number;
    maxTasksPerAgent: number;
    defaultTimeout: number;
    anthropicApiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    security: {
        enableSandbox: boolean;
        sandboxType: 'docker' | 'gvisor' | 'firecracker';
        autoApprove: boolean;
        permissionMode: 'strict' | 'permissive';
    };
    github?: GitHubConfig;
    gitlab?: GitLabConfig;
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
        auditEnabled: boolean;
        provenanceTracking: boolean;
    };
    ui: {
        terminal: boolean;
        colorEnabled: boolean;
        verboseOutput: boolean;
    };
}
export type Result<T, E = Error> = {
    success: true;
    data: T;
} | {
    success: false;
    error: E;
};
export declare function success<T>(data: T): Result<T>;
export declare function failure<E = Error>(error: E): Result<never, E>;
//# sourceMappingURL=index.d.ts.map