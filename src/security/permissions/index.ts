/**
 * Nexus Code - Security Framework
 * ABAC/ReBAC security with sandboxing
 */

import { EventEmitter } from 'events';
import Docker from 'dockerode';
import {
  Permission,
  PermissionAction,
  ResourceType,
  SecurityContext,
  SandboxConfig,
  Result,
  success,
  failure,
} from '../../core/types/index.js';

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  active: boolean;
}

export interface SecurityRule {
  id: string;
  subject: string; // user, role, or attribute
  action: PermissionAction;
  resource: ResourceType;
  resourcePattern: string;
  conditions?: Record<string, any>;
  effect: 'allow' | 'deny';
}

/**
 * ABAC (Attribute-Based Access Control) Engine
 */
export class ABACEngine extends EventEmitter {
  private policies = new Map<string, SecurityPolicy>();
  private userAttributes = new Map<string, Record<string, any>>();

  /**
   * Add a security policy
   */
  addPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.id, policy);
    this.emit('policy:added', { policyId: policy.id });
  }

  /**
   * Remove a security policy
   */
  removePolicy(policyId: string): boolean {
    const removed = this.policies.delete(policyId);
    if (removed) {
      this.emit('policy:removed', { policyId });
    }
    return removed;
  }

  /**
   * Set user attributes
   */
  setUserAttributes(userId: string, attributes: Record<string, any>): void {
    this.userAttributes.set(userId, attributes);
  }

  /**
   * Check if action is permitted
   */
  isPermitted(
    userId: string,
    action: PermissionAction,
    resource: ResourceType,
    resourcePath: string,
    context?: Record<string, any>,
  ): boolean {
    const userAttrs = this.userAttributes.get(userId) || {};
    let permitted = false; // Default deny

    // Evaluate all active policies
    for (const policy of this.policies.values()) {
      if (!policy.active) continue;

      for (const rule of policy.rules) {
        // Check if rule matches
        if (!this.ruleMatches(rule, userId, action, resource, resourcePath, userAttrs, context)) {
          continue;
        }

        // Apply rule effect
        if (rule.effect === 'allow') {
          permitted = true;
        } else {
          // Explicit deny overrides allow
          return false;
        }
      }
    }

    this.emit('permission:checked', {
      userId,
      action,
      resource,
      resourcePath,
      permitted,
    });

    return permitted;
  }

  /**
   * Check if rule matches
   */
  private ruleMatches(
    rule: SecurityRule,
    userId: string,
    action: PermissionAction,
    resource: ResourceType,
    resourcePath: string,
    userAttrs: Record<string, any>,
    context?: Record<string, any>,
  ): boolean {
    // Check action
    if (rule.action !== action) {
      return false;
    }

    // Check resource type
    if (rule.resource !== resource) {
      return false;
    }

    // Check resource pattern (glob match)
    if (!this.globMatch(resourcePath, rule.resourcePattern)) {
      return false;
    }

    // Check subject (user or attribute)
    if (rule.subject !== '*' && rule.subject !== userId) {
      // Check if subject is an attribute
      const [attrKey, attrValue] = rule.subject.split('=');
      if (userAttrs[attrKey] !== attrValue) {
        return false;
      }
    }

    // Check conditions
    if (rule.conditions && context) {
      for (const [key, value] of Object.entries(rule.conditions)) {
        if (context[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Glob pattern matching
   */
  private globMatch(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Get all policies
   */
  getPolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values());
  }
}

/**
 * Sandbox Manager - Docker, gVisor, Firecracker
 */
export class SandboxManager extends EventEmitter {
  private docker: Docker;
  private activeSandboxes = new Map<string, { container: Docker.Container; config: SandboxConfig }>();

  constructor() {
    super();
    this.docker = new Docker();
  }

  /**
   * Create a sandbox
   */
  async createSandbox(sessionId: string, config: SandboxConfig): Promise<Result<string>> {
    try {
      if (config.type === 'docker') {
        return await this.createDockerSandbox(sessionId, config);
      }
      // gVisor and Firecracker would be implemented similarly
      return failure(new Error(`Sandbox type '${config.type}' not yet implemented`));
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Create Docker sandbox
   */
  private async createDockerSandbox(sessionId: string, config: SandboxConfig): Promise<Result<string>> {
    try {
      const container = await this.docker.createContainer({
        Image: config.image || 'ubuntu:22.04',
        Cmd: ['/bin/bash'],
        Tty: true,
        OpenStdin: true,
        NetworkDisabled: !config.networkEnabled,
        HostConfig: {
          Memory: this.parseMemoryLimit(config.memoryLimit || '512m'),
          NanoCpus: (config.cpuLimit || 1) * 1e9,
          Binds: config.volumeMounts?.map(m =>
            `${m.source}:${m.target}${m.readonly ? ':ro' : ''}`
          ) || [],
          // Security options
          SecurityOpt: ['no-new-privileges:true'],
          CapDrop: ['ALL'],
          ReadonlyRootfs: false,
        },
      });

      await container.start();

      this.activeSandboxes.set(sessionId, { container, config });
      this.emit('sandbox:created', { sessionId });

      return success(container.id);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Execute command in sandbox
   */
  async executeInSandbox(sessionId: string, command: string): Promise<Result<string>> {
    const sandbox = this.activeSandboxes.get(sessionId);
    if (!sandbox) {
      return failure(new Error(`Sandbox '${sessionId}' not found`));
    }

    try {
      const exec = await sandbox.container.exec({
        Cmd: ['/bin/sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Detach: false });

      let output = '';
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      this.emit('sandbox:executed', { sessionId, command });
      return success(output);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Destroy sandbox
   */
  async destroySandbox(sessionId: string): Promise<Result<void>> {
    const sandbox = this.activeSandboxes.get(sessionId);
    if (!sandbox) {
      return failure(new Error(`Sandbox '${sessionId}' not found`));
    }

    try {
      await sandbox.container.stop();
      await sandbox.container.remove();

      this.activeSandboxes.delete(sessionId);
      this.emit('sandbox:destroyed', { sessionId });

      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Parse memory limit string (e.g., "512m", "2g")
   */
  private parseMemoryLimit(limit: string): number {
    const units: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = limit.toLowerCase().match(/^(\d+)([bkmg])$/);
    if (!match) {
      throw new Error(`Invalid memory limit: ${limit}`);
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  /**
   * Get active sandboxes
   */
  getActiveSandboxes(): string[] {
    return Array.from(this.activeSandboxes.keys());
  }
}

/**
 * Permission Manager - Manages permissions and contexts
 */
export class PermissionManager extends EventEmitter {
  private abac: ABACEngine;
  private contexts = new Map<string, SecurityContext>();

  constructor(abac: ABACEngine) {
    super();
    this.abac = abac;
  }

  /**
   * Create security context for session
   */
  createContext(
    sessionId: string,
    userId: string,
    permissions: Permission[],
    sandboxed: boolean,
    sandboxConfig?: SandboxConfig,
  ): SecurityContext {
    const context: SecurityContext = {
      userId,
      sessionId,
      permissions,
      sandboxed,
      sandboxConfig,
    };

    this.contexts.set(sessionId, context);
    this.emit('context:created', { sessionId });

    return context;
  }

  /**
   * Check permission using ABAC
   */
  checkPermission(
    sessionId: string,
    action: PermissionAction,
    resource: ResourceType,
    resourcePath: string,
  ): boolean {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return false;
    }

    // Check ABAC
    return this.abac.isPermitted(
      context.userId,
      action,
      resource,
      resourcePath,
    );
  }

  /**
   * Get context
   */
  getContext(sessionId: string): SecurityContext | undefined {
    return this.contexts.get(sessionId);
  }

  /**
   * Remove context
   */
  removeContext(sessionId: string): boolean {
    const removed = this.contexts.delete(sessionId);
    if (removed) {
      this.emit('context:removed', { sessionId });
    }
    return removed;
  }
}
