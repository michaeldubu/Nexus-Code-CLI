/**
 * Agent Skills Manager
 * Discovers and manages custom Agent Skills from .nexus/skills/ directory
 * Based on Anthropic's Agent Skills architecture with progressive disclosure
 */

import fs from 'fs/promises';
import path from 'path';
import { MCPTool } from '../types/index.js';

/**
 * Skill metadata from YAML frontmatter
 */
export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
}

/**
 * Parsed Skill with metadata and content
 */
export interface Skill {
  metadata: SkillMetadata;
  skillPath: string;
  mainContent: string; // SKILL.md content (loaded on demand)
  resourceFiles: string[]; // Additional files in skill directory
}

/**
 * Skill discovery result
 */
export interface SkillsDiscoveryResult {
  skills: Skill[];
  errors: Array<{ path: string; error: string }>;
}

/**
 * Parse YAML frontmatter from markdown
 */
function parseYAMLFrontmatter(content: string): { metadata: Record<string, any>; body: string } | null {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const [, yamlContent, body] = match;
  const metadata: Record<string, any> = {};

  // Simple YAML parser for key: value pairs
  const lines = yamlContent.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      metadata[key] = value;
    }
  }

  return { metadata, body };
}

/**
 * Validate skill metadata
 */
function validateSkillMetadata(metadata: Record<string, any>): SkillMetadata | null {
  if (!metadata.name || !metadata.description) {
    return null;
  }

  // Validate name format
  if (!/^[a-z0-9-]+$/.test(metadata.name) || metadata.name.length > 64) {
    return null;
  }

  // Check for reserved words
  if (metadata.name.includes('anthropic') || metadata.name.includes('claude')) {
    return null;
  }

  // Validate description
  if (metadata.description.length === 0 || metadata.description.length > 1024) {
    return null;
  }

  return {
    name: metadata.name,
    description: metadata.description,
    version: metadata.version,
    author: metadata.author,
  };
}

/**
 * Load a single skill from directory
 */
async function loadSkill(skillPath: string): Promise<Skill | null> {
  try {
    const skillFilePath = path.join(skillPath, 'SKILL.md');
    const content = await fs.readFile(skillFilePath, 'utf-8');

    const parsed = parseYAMLFrontmatter(content);
    if (!parsed) {
      return null;
    }

    const metadata = validateSkillMetadata(parsed.metadata);
    if (!metadata) {
      return null;
    }

    // Discover additional resource files
    const files = await fs.readdir(skillPath);
    const resourceFiles = files
      .filter(f => f !== 'SKILL.md')
      .map(f => path.join(skillPath, f));

    return {
      metadata,
      skillPath,
      mainContent: parsed.body,
      resourceFiles,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Skills Manager
 * Handles discovery and management of Agent Skills
 */
export class SkillsManager {
  private skills: Map<string, Skill> = new Map();
  private skillsDirectory: string;

  constructor(skillsDirectory?: string) {
    // Default to .nexus/skills/ in current directory
    this.skillsDirectory = skillsDirectory || path.join(process.cwd(), '.nexus', 'skills');
  }

  /**
   * Discover all skills in the skills directory
   */
  async discoverSkills(): Promise<SkillsDiscoveryResult> {
    const result: SkillsDiscoveryResult = {
      skills: [],
      errors: [],
    };

    try {
      // Check if skills directory exists
      await fs.access(this.skillsDirectory);
    } catch (error) {
      // Directory doesn't exist, create it
      try {
        await fs.mkdir(this.skillsDirectory, { recursive: true });
        console.log(`📁 Created skills directory: ${this.skillsDirectory}`);
      } catch (mkdirError) {
        result.errors.push({
          path: this.skillsDirectory,
          error: `Failed to create skills directory: ${mkdirError}`,
        });
        return result;
      }
      return result; // Empty directory
    }

    // Read all subdirectories in skills directory
    const entries = await fs.readdir(this.skillsDirectory, { withFileTypes: true });
    const skillDirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);

    // Load each skill
    for (const dirName of skillDirs) {
      const skillPath = path.join(this.skillsDirectory, dirName);
      const skill = await loadSkill(skillPath);

      if (skill) {
        this.skills.set(skill.metadata.name, skill);
        result.skills.push(skill);
        console.log(`✅ Loaded skill: ${skill.metadata.name} - ${skill.metadata.description}`);
      } else {
        result.errors.push({
          path: skillPath,
          error: 'Invalid or missing SKILL.md file',
        });
      }
    }

    return result;
  }

  /**
   * Get all skill metadata (for system prompt)
   * This is Level 1: Metadata - always loaded
   */
  getSkillMetadata(): Array<{ name: string; description: string }> {
    return Array.from(this.skills.values()).map(skill => ({
      name: skill.metadata.name,
      description: skill.metadata.description,
    }));
  }

  /**
   * Get skill content by name
   * This is Level 2: Instructions - loaded when triggered
   */
  getSkillContent(name: string): string | null {
    const skill = this.skills.get(name);
    return skill ? skill.mainContent : null;
  }

  /**
   * Get skill resource files
   * This is Level 3: Resources - loaded as needed
   */
  getSkillResources(name: string): string[] {
    const skill = this.skills.get(name);
    return skill ? skill.resourceFiles : [];
  }

  /**
   * Read a specific resource file from a skill
   */
  async readSkillResource(skillName: string, resourcePath: string): Promise<string | null> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      return null;
    }

    try {
      const fullPath = path.join(skill.skillPath, resourcePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert skills to MCP tool format
   * This creates a "Skill" tool that Claude can invoke
   */
  createSkillTool(): MCPTool {
    return {
      name: 'Skill',
      description: 'Load and use an Agent Skill. Skills provide specialized capabilities and domain expertise.',
      inputSchema: {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            description: 'Name of the skill to load',
            enum: Array.from(this.skills.keys()),
          },
          resource_path: {
            type: 'string',
            description: 'Optional: Path to a specific resource file within the skill',
          },
        },
        required: ['skill_name'],
      },
    };
  }

  /**
   * Execute skill tool call
   */
  async executeSkillTool(input: {
    skill_name: string;
    resource_path?: string;
  }): Promise<string> {
    const skill = this.skills.get(input.skill_name);
    if (!skill) {
      return `Error: Skill '${input.skill_name}' not found`;
    }

    // If resource path requested, load that specific resource
    if (input.resource_path) {
      const resource = await this.readSkillResource(input.skill_name, input.resource_path);
      if (!resource) {
        return `Error: Resource '${input.resource_path}' not found in skill '${input.skill_name}'`;
      }
      return resource;
    }

    // Otherwise, return main skill content (SKILL.md body)
    return skill.mainContent;
  }

  /**
   * Get skills directory path
   */
  getSkillsDirectory(): string {
    return this.skillsDirectory;
  }

  /**
   * Check if skills are available
   */
  hasSkills(): boolean {
    return this.skills.size > 0;
  }

  /**
   * Get skill count
   */
  getSkillCount(): number {
    return this.skills.size;
  }

  /**
   * Clear all loaded skills
   */
  clear(): void {
    this.skills.clear();
  }
}

/**
 * Create a default example skill for demonstration
 */
export async function createExampleSkill(skillsDir: string): Promise<void> {
  const exampleSkillPath = path.join(skillsDir, 'example-skill');

  try {
    await fs.mkdir(exampleSkillPath, { recursive: true });

    const skillMd = `---
name: example-skill
description: An example skill demonstrating the Agent Skills architecture. Use this when asked about how skills work.
version: 1.0.0
author: SAAAM LLC
---

# Example Skill

This is an example Agent Skill for NEXUS Code CLI.

## What this skill does

This skill demonstrates the three-level progressive disclosure architecture:

1. **Level 1: Metadata** - The name and description above are always loaded
2. **Level 2: Instructions** - This content is loaded when the skill is triggered
3. **Level 3: Resources** - Additional files are loaded as needed

## How to use this skill

Simply ask a question that matches the skill description. For example:
- "Show me how skills work"
- "Explain the Agent Skills architecture"

## Advanced features

You can bundle additional files like:
- Code templates
- Reference documentation
- Configuration files
- Helper scripts

These files are only loaded when explicitly referenced, making skills efficient even with large amounts of bundled content.

## For more information

See the official Anthropic documentation on Agent Skills.
`;

    await fs.writeFile(path.join(exampleSkillPath, 'SKILL.md'), skillMd);

    // Create an example resource file
    const referenceMd = `# Agent Skills Reference

Agent Skills use a filesystem-based architecture with progressive disclosure:

- Skills exist as directories in \`.nexus/skills/\`
- Each skill has a \`SKILL.md\` file with YAML frontmatter
- Additional resources can be bundled and loaded on demand

This reference would normally contain extensive documentation, but it's only loaded into context when needed.
`;

    await fs.writeFile(path.join(exampleSkillPath, 'REFERENCE.md'), referenceMd);

    console.log(`✅ Created example skill at: ${exampleSkillPath}`);
  } catch (error) {
    console.error(`❌ Failed to create example skill: ${error}`);
  }
}
