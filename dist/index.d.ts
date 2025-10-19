/**
 * Nexus Code - Main Application
 * Production-ready multi-agent AI coding system
 */
import { EventEmitter } from 'events';
import { NexusConfig, Result } from './core/types/index.js';
import { MCPServer } from './core/mcp/client.js';
import { AgentOrchestrator } from './core/orchestration/orchestrator.js';
import { AuditLogger, ProvenanceTracker } from './security/audit/index.js';
/**
 * Nexus Code - Main Application Class
 */
export declare class NexusCode extends EventEmitter {
    private config;
    private rpcServer?;
    private mcpServer;
    private orchestrator;
    private abac;
    private sandboxManager;
    private permissionManager;
    private auditLogger;
    private provenanceTracker;
    private initialized;
    constructor(config: NexusConfig);
    /**
     * Initialize the system
     */
    initialize(): Promise<Result<void>>;
    /**
     * Initialize all agents
     */
    private initializeAgents;
    /**
     * Setup default security policies
     */
    private setupDefaultSecurityPolicies;
    /**
     * Setup event handlers
     */
    private setupEventHandlers;
    /**
     * Execute a coding task
     */
    executeTask(description: string, input: any): Promise<Result<any>>;
    /**
     * Generate code
     */
    generateCode(description: string, requirements: string[], specifications?: any): Promise<Result<any>>;
    /**
     * Analyze security
     */
    analyzeSecurity(codePath: string): Promise<Result<any>>;
    /**
     * Get system status
     */
    getStatus(): {
        initialized: boolean;
        agents: {
            totalAgents: number;
            activeExecutions: number;
            taskAssignments: number;
            agentsByRole: {
                [k: string]: number;
            };
        };
        audit: {
            total: number;
            byResult: {
                success: number;
                failure: number;
                denied: number;
            };
            byAgent: {
                [k: string]: number;
            };
            oldestLog: Date;
            newestLog: Date;
        };
        provenance: {
            total: number;
            totalTransformations: number;
            byAgent: {
                [k: string]: number;
            };
        };
        security: {
            policies: number;
            sandboxes: number;
        };
    };
    /**
     * Shutdown the system
     */
    shutdown(): Promise<void>;
    /**
     * Get orchestrator
     */
    getOrchestrator(): AgentOrchestrator;
    /**
     * Get MCP server
     */
    getMCPServer(): MCPServer;
    /**
     * Get audit logger
     */
    getAuditLogger(): AuditLogger;
    /**
     * Get provenance tracker
     */
    getProvenanceTracker(): ProvenanceTracker;
}
/**
 * Create and initialize Nexus Code instance
 */
export declare function createNexusCode(config: NexusConfig): Promise<Result<NexusCode>>;
//# sourceMappingURL=index.d.ts.map