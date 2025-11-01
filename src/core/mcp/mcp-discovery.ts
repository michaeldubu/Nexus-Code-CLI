/**
 * Auto-discover running NEXUS JetBrains plugins
 * Searches for lock files and connects automatically
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

export interface PluginInstance {
  port: number;
  authToken: string;
  projectPath: string;
  projectName: string;
  lockFilePath: string;
}

/**
 * Find all running NEXUS plugin instances
 */
export function discoverPluginInstances(): PluginInstance[] {
  const instances: PluginInstance[] = [];

  // Search common project locations
  const searchPaths = [
    process.cwd(), // Current directory
    join(homedir(), 'Documents'),
    join(homedir(), 'Projects'),
    join(homedir(), 'dev'),
    // Removed hardcoded saaam_dev - let discovery find it naturally
  ];

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) continue;

    try {
      const found = findLockFilesRecursive(searchPath, 2); // Max depth 2
      instances.push(...found);
    } catch (error) {
      // Skip inaccessible directories
    }
  }

  return instances;
}

/**
 * Recursively find .nexus-code lock files
 */
function findLockFilesRecursive(dir: string, maxDepth: number): PluginInstance[] {
  if (maxDepth <= 0) return [];

  const instances: PluginInstance[] = [];
  const nexusDir = join(dir, '.nexus-code');

  // Check if this directory has a .nexus-code folder
  if (existsSync(nexusDir)) {
    try {
      const files = readdirSync(nexusDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const lockFilePath = join(nexusDir, file);
          const data = JSON.parse(readFileSync(lockFilePath, 'utf-8'));

          instances.push({
            port: data.port,
            authToken: data.authToken,
            projectPath: data.projectPath,
            projectName: data.projectName,
            lockFilePath,
          });
        }
      }
    } catch (error) {
      // Skip invalid lock files
    }
  }

  // Search subdirectories
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);

      // Skip common ignore patterns
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') {
        continue;
      }

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          instances.push(...findLockFilesRecursive(fullPath, maxDepth - 1));
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Skip inaccessible directories
  }

  return instances;
}

/**
 * Get the best plugin instance to use
 * Prioritizes current directory, then most recently modified
 */
export function getBestPluginInstance(): PluginInstance | null {
  const instances = discoverPluginInstances();

  if (instances.length === 0) return null;

  // Prefer instance in current directory
  const cwd = process.cwd();
  const cwdInstance = instances.find(i => i.projectPath === cwd);
  if (cwdInstance) return cwdInstance;

  // Otherwise return first found
  return instances[0];
}

/**
 * Build WebSocket URL from plugin instance
 */
export function getWebSocketUrl(instance: PluginInstance): string {
  return `ws://localhost:${instance.port}/mcp`;
}

/**
 * Get auth headers for plugin instance
 */
export function getAuthHeaders(instance: PluginInstance): Record<string, string> {
  return {
    'X-Claude-Code-Ide-Authorization': instance.authToken,
  };
}
