/**
 * Nexus Code - Security Framework
 * Production-ready ABAC/ReBAC security with sandboxing
 */
import { EventEmitter } from 'events';
import { Permission, PermissionAction, ResourceType, SecurityContext, SandboxConfig, Result } from '../../core/types/index.js';
export interface SecurityPolicy {
    id: string;
    name: string;
    description: string;
    rules: SecurityRule[];
    active: boolean;
}
export interface SecurityRule {
    id: string;
    subject: string;
    action: PermissionAction;
    resource: ResourceType;
    resourcePattern: string;
    conditions?: Record<string, any>;
    effect: 'allow' | 'deny';
}
/**
 * ABAC (Attribute-Based Access Control) Engine
 */
export declare class ABACEngine extends EventEmitter {
    private policies;
    private userAttributes;
    /**
     * Add a security policy
     */
    addPolicy(policy: SecurityPolicy): void;
    /**
     * Remove a security policy
     */
    removePolicy(policyId: string): boolean;
    /**
     * Set user attributes
     */
    setUserAttributes(userId: string, attributes: Record<string, any>): void;
    /**
     * Check if action is permitted
     */
    isPermitted(userId: string, action: PermissionAction, resource: ResourceType, resourcePath: string, context?: Record<string, any>): boolean;
    /**
     * Check if rule matches
     */
    private ruleMatches;
    /**
     * Glob pattern matching
     */
    private globMatch;
    /**
     * Get all policies
     */
    getPolicies(): SecurityPolicy[];
}
/**
 * Sandbox Manager - Docker, gVisor, Firecracker
 */
export declare class SandboxManager extends EventEmitter {
    private docker;
    private activeSandboxes;
    constructor();
    /**
     * Create a sandbox
     */
    createSandbox(sessionId: string, config: SandboxConfig): Promise<Result<string>>;
    /**
     * Create Docker sandbox
     */
    private createDockerSandbox;
    /**
     * Execute command in sandbox
     */
    executeInSandbox(sessionId: string, command: string): Promise<Result<string>>;
    /**
     * Destroy sandbox
     */
    destroySandbox(sessionId: string): Promise<Result<void>>;
    /**
     * Parse memory limit string (e.g., "512m", "2g")
     */
    private parseMemoryLimit;
    /**
     * Get active sandboxes
     */
    getActiveSandboxes(): string[];
}
/**
 * Permission Manager - Manages permissions and contexts
 */
export declare class PermissionManager extends EventEmitter {
    private abac;
    private contexts;
    constructor(abac: ABACEngine);
    /**
     * Create security context for session
     */
    createContext(sessionId: string, userId: string, permissions: Permission[], sandboxed: boolean, sandboxConfig?: SandboxConfig): SecurityContext;
    /**
     * Check permission using ABAC
     */
    checkPermission(sessionId: string, action: PermissionAction, resource: ResourceType, resourcePath: string): boolean;
    /**
     * Get context
     */
    getContext(sessionId: string): SecurityContext | undefined;
    /**
     * Remove context
     */
    removeContext(sessionId: string): boolean;
}
//# sourceMappingURL=index.d.ts.map