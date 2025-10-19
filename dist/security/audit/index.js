/**
 * Nexus Code - Audit & Provenance System
 * Production-ready audit logging with immutable provenance tracking
 */
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
/**
 * Audit Logger - Comprehensive audit logging system
 */
export class AuditLogger extends EventEmitter {
    logger;
    config;
    logs = [];
    logStream;
    constructor(config) {
        super();
        this.config = config;
        // Initialize Winston logger
        this.logger = winston.createLogger({
            level: config.level,
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [
                new winston.transports.File({ filename: config.logFile }),
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
                }),
            ],
        });
    }
    /**
     * Log an audit event
     */
    async log(log) {
        const auditLog = {
            id: uuidv4(),
            timestamp: new Date(),
            ...log,
        };
        // Store in memory
        this.logs.push(auditLog);
        // Write to Winston
        this.logger.info('AUDIT', auditLog);
        // Emit event
        this.emit('audit:logged', auditLog);
        // Enforce retention policy
        await this.enforceRetention();
    }
    /**
     * Log agent action
     */
    async logAgentAction(sessionId, userId, agentId, action, resource, result, metadata) {
        await this.log({
            sessionId,
            userId,
            agentId,
            action,
            resource,
            result,
            metadata: metadata || {},
            lineage: [],
        });
    }
    /**
     * Log agent-to-agent interaction
     */
    async logAgentInteraction(sessionId, userId, fromAgent, toAgent, action, result, lineage) {
        await this.log({
            sessionId,
            userId,
            agentId: fromAgent,
            action: `agent_interaction:${toAgent}:${action}`,
            resource: toAgent,
            result,
            metadata: { targetAgent: toAgent },
            lineage,
        });
    }
    /**
     * Query audit logs
     */
    query(filters) {
        return this.logs.filter(log => {
            if (filters.sessionId && log.sessionId !== filters.sessionId)
                return false;
            if (filters.userId && log.userId !== filters.userId)
                return false;
            if (filters.agentId && log.agentId !== filters.agentId)
                return false;
            if (filters.action && log.action !== filters.action)
                return false;
            if (filters.result && log.result !== filters.result)
                return false;
            if (filters.startTime && log.timestamp < filters.startTime)
                return false;
            if (filters.endTime && log.timestamp > filters.endTime)
                return false;
            return true;
        });
    }
    /**
     * Get audit trail for session
     */
    getSessionTrail(sessionId) {
        return this.query({ sessionId }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    /**
     * Export audit logs
     */
    async export(outputPath, format = 'json') {
        if (format === 'json') {
            await fs.writeFile(outputPath, JSON.stringify(this.logs, null, 2), 'utf-8');
        }
        else {
            // CSV export
            const csv = this.logsToCSV();
            await fs.writeFile(outputPath, csv, 'utf-8');
        }
        this.emit('logs:exported', { path: outputPath, format });
    }
    /**
     * Convert logs to CSV
     */
    logsToCSV() {
        if (this.logs.length === 0)
            return '';
        const headers = ['id', 'timestamp', 'sessionId', 'userId', 'agentId', 'action', 'resource', 'result'];
        const rows = this.logs.map(log => [
            log.id,
            log.timestamp.toISOString(),
            log.sessionId,
            log.userId,
            log.agentId,
            log.action,
            log.resource,
            log.result,
        ]);
        return [
            headers.join(','),
            ...rows.map(row => row.join(',')),
        ].join('\n');
    }
    /**
     * Enforce retention policy
     */
    async enforceRetention() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        const before = this.logs.length;
        this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);
        const removed = before - this.logs.length;
        if (removed > 0) {
            this.emit('retention:enforced', { removed });
        }
    }
    /**
     * Get statistics
     */
    getStats() {
        const total = this.logs.length;
        const byResult = {
            success: this.logs.filter(l => l.result === 'success').length,
            failure: this.logs.filter(l => l.result === 'failure').length,
            denied: this.logs.filter(l => l.result === 'denied').length,
        };
        const byAgent = new Map();
        for (const log of this.logs) {
            byAgent.set(log.agentId, (byAgent.get(log.agentId) || 0) + 1);
        }
        return {
            total,
            byResult,
            byAgent: Object.fromEntries(byAgent),
            oldestLog: this.logs[0]?.timestamp,
            newestLog: this.logs[this.logs.length - 1]?.timestamp,
        };
    }
}
/**
 * Provenance Tracker - Immutable artifact provenance
 */
export class ProvenanceTracker extends EventEmitter {
    records = new Map();
    /**
     * Record artifact creation
     */
    async recordArtifact(artifactId, contributingAgents, inputs, metadata) {
        const record = {
            artifactId,
            created: new Date(),
            contributingAgents,
            inputs,
            transformations: [],
            metadata: metadata || {},
        };
        this.records.set(artifactId, record);
        this.emit('provenance:recorded', { artifactId });
    }
    /**
     * Record transformation
     */
    async recordTransformation(artifactId, type, description) {
        const record = this.records.get(artifactId);
        if (!record) {
            throw new Error(`Artifact '${artifactId}' not found`);
        }
        record.transformations.push({
            type,
            description,
            timestamp: new Date(),
        });
        this.emit('provenance:transformation', { artifactId, type });
    }
    /**
     * Get provenance record
     */
    getProvenance(artifactId) {
        return this.records.get(artifactId);
    }
    /**
     * Get full provenance chain
     */
    getProvenanceChain(artifactId) {
        const chain = [];
        const visited = new Set();
        const traverse = (id) => {
            if (visited.has(id))
                return;
            visited.add(id);
            const record = this.records.get(id);
            if (!record)
                return;
            chain.push(record);
            // Traverse inputs
            for (const inputId of record.inputs) {
                traverse(inputId);
            }
        };
        traverse(artifactId);
        return chain.reverse(); // Oldest first
    }
    /**
     * Verify provenance integrity
     */
    verifyIntegrity(artifactId) {
        const record = this.records.get(artifactId);
        if (!record)
            return false;
        // Check all inputs exist
        for (const inputId of record.inputs) {
            if (!this.records.has(inputId)) {
                return false;
            }
        }
        // Check contributing agents
        if (record.contributingAgents.length === 0) {
            return false;
        }
        return true;
    }
    /**
     * Export provenance data
     */
    async export(outputPath) {
        const data = Array.from(this.records.values());
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
        this.emit('provenance:exported', { path: outputPath });
    }
    /**
     * Get statistics
     */
    getStats() {
        const total = this.records.size;
        const byAgent = new Map();
        let totalTransformations = 0;
        for (const record of this.records.values()) {
            totalTransformations += record.transformations.length;
            for (const agent of record.contributingAgents) {
                byAgent.set(agent.agentId, (byAgent.get(agent.agentId) || 0) + 1);
            }
        }
        return {
            total,
            totalTransformations,
            byAgent: Object.fromEntries(byAgent),
        };
    }
}
//# sourceMappingURL=index.js.map