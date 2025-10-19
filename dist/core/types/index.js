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
// JSON-RPC Error Codes
export var JsonRpcErrorCode;
(function (JsonRpcErrorCode) {
    JsonRpcErrorCode[JsonRpcErrorCode["PARSE_ERROR"] = -32700] = "PARSE_ERROR";
    JsonRpcErrorCode[JsonRpcErrorCode["INVALID_REQUEST"] = -32600] = "INVALID_REQUEST";
    JsonRpcErrorCode[JsonRpcErrorCode["METHOD_NOT_FOUND"] = -32601] = "METHOD_NOT_FOUND";
    JsonRpcErrorCode[JsonRpcErrorCode["INVALID_PARAMS"] = -32602] = "INVALID_PARAMS";
    JsonRpcErrorCode[JsonRpcErrorCode["INTERNAL_ERROR"] = -32603] = "INTERNAL_ERROR";
})(JsonRpcErrorCode || (JsonRpcErrorCode = {}));
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
// ============================================================================
// Agent Types
// ============================================================================
export var AgentRole;
(function (AgentRole) {
    AgentRole["SUPERVISOR"] = "supervisor";
    AgentRole["ARCHITECT"] = "architect";
    AgentRole["IMPLEMENTATION"] = "implementation";
    AgentRole["SECURITY"] = "security";
    AgentRole["TESTING"] = "testing";
    AgentRole["REVIEW"] = "review";
    AgentRole["DOCUMENTATION"] = "documentation";
})(AgentRole || (AgentRole = {}));
export var AgentStatus;
(function (AgentStatus) {
    AgentStatus["IDLE"] = "idle";
    AgentStatus["THINKING"] = "thinking";
    AgentStatus["EXECUTING"] = "executing";
    AgentStatus["WAITING"] = "waiting";
    AgentStatus["COMPLETED"] = "completed";
    AgentStatus["FAILED"] = "failed";
})(AgentStatus || (AgentStatus = {}));
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority[TaskPriority["CRITICAL"] = 0] = "CRITICAL";
    TaskPriority[TaskPriority["HIGH"] = 1] = "HIGH";
    TaskPriority[TaskPriority["MEDIUM"] = 2] = "MEDIUM";
    TaskPriority[TaskPriority["LOW"] = 3] = "LOW";
})(TaskPriority || (TaskPriority = {}));
// ============================================================================
// Security & Permission Types
// ============================================================================
export var PermissionAction;
(function (PermissionAction) {
    PermissionAction["READ"] = "read";
    PermissionAction["WRITE"] = "write";
    PermissionAction["EXECUTE"] = "execute";
    PermissionAction["DELETE"] = "delete";
})(PermissionAction || (PermissionAction = {}));
export var ResourceType;
(function (ResourceType) {
    ResourceType["FILE"] = "file";
    ResourceType["DIRECTORY"] = "directory";
    ResourceType["TERMINAL"] = "terminal";
    ResourceType["NETWORK"] = "network";
    ResourceType["API"] = "api";
})(ResourceType || (ResourceType = {}));
// ============================================================================
// Communication Types (Agent-to-Agent)
// ============================================================================
export var MessageType;
(function (MessageType) {
    MessageType["REQUEST"] = "request";
    MessageType["RESPONSE"] = "response";
    MessageType["NOTIFICATION"] = "notification";
    MessageType["ERROR"] = "error";
})(MessageType || (MessageType = {}));
export function success(data) {
    return { success: true, data };
}
export function failure(error) {
    return { success: false, error };
}
//# sourceMappingURL=index.js.map