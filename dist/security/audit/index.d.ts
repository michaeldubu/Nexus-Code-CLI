/**
 * Nexus Code - Audit & Provenance System
 * Production-ready audit logging with immutable provenance tracking
 */
import { EventEmitter } from 'events';
import { AuditLog, ProvenanceRecord, AgentRole } from '../../core/types/index.js';
export interface AuditConfig {
    logFile: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    enableProvenance: boolean;
    retentionDays: number;
}
/**
 * Audit Logger - Comprehensive audit logging system
 */
export declare class AuditLogger extends EventEmitter {
    private logger;
    private config;
    private logs;
    private logStream?;
    constructor(config: AuditConfig);
    /**
     * Log an audit event
     */
    log(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void>;
    /**
     * Log agent action
     */
    logAgentAction(sessionId: string, userId: string, agentId: string, action: string, resource: string, result: 'success' | 'failure' | 'denied', metadata?: Record<string, any>): Promise<void>;
    /**
     * Log agent-to-agent interaction
     */
    logAgentInteraction(sessionId: string, userId: string, fromAgent: string, toAgent: string, action: string, result: 'success' | 'failure' | 'denied', lineage: string[]): Promise<void>;
    /**
     * Query audit logs
     */
    query(filters: {
        sessionId?: string;
        userId?: string;
        agentId?: string;
        action?: string;
        result?: 'success' | 'failure' | 'denied';
        startTime?: Date;
        endTime?: Date;
    }): AuditLog[];
    /**
     * Get audit trail for session
     */
    getSessionTrail(sessionId: string): AuditLog[];
    /**
     * Export audit logs
     */
    export(outputPath: string, format?: 'json' | 'csv'): Promise<void>;
    /**
     * Convert logs to CSV
     */
    private logsToCSV;
    /**
     * Enforce retention policy
     */
    private enforceRetention;
    /**
     * Get statistics
     */
    getStats(): {
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
}
/**
 * Provenance Tracker - Immutable artifact provenance
 */
export declare class ProvenanceTracker extends EventEmitter {
    private records;
    /**
     * Record artifact creation
     */
    recordArtifact(artifactId: string, contributingAgents: Array<{
        agentId: string;
        role: AgentRole;
        contribution: string;
        timestamp: Date;
    }>, inputs: string[], metadata?: Record<string, any>): Promise<void>;
    /**
     * Record transformation
     */
    recordTransformation(artifactId: string, type: string, description: string): Promise<void>;
    /**
     * Get provenance record
     */
    getProvenance(artifactId: string): ProvenanceRecord | undefined;
    /**
     * Get full provenance chain
     */
    getProvenanceChain(artifactId: string): ProvenanceRecord[];
    /**
     * Verify provenance integrity
     */
    verifyIntegrity(artifactId: string): boolean;
    /**
     * Export provenance data
     */
    export(outputPath: string): Promise<void>;
    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        totalTransformations: number;
        byAgent: {
            [k: string]: number;
        };
    };
}
//# sourceMappingURL=index.d.ts.map