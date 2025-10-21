/**
 * Agents Dialog Component
 * Create and manage specialized agents
 */
import React from 'react';
import { Box, Text } from 'ink';

export interface Agent {
  name: string;
  description: string;
  tools: string[];
}

interface Props {
  agents: Agent[];
  selectedIndex: number;
  onCreate: (agentType: string) => void;
  onCancel: () => void;
}

const AVAILABLE_AGENT_TYPES = [
  {
    name: 'general-purpose',
    description:
      'General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks.',
    tools: ['*'],
  },
  {
    name: 'statusline-setup',
    description: "Use this agent to configure the user's Claude Code status line setting.",
    tools: ['Read', 'Edit'],
  },
  {
    name: 'output-style-setup',
    description: 'Use this agent to create a Claude Code output style.',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
  },
  {
    name: 'Explore',
    description:
      'Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns.',
    tools: ['Glob', 'Grep', 'Read', 'Bash'],
  },
];

export const AgentsDialog: React.FC<Props> = ({ agents, selectedIndex }) => {
  const hasAgents = agents.length > 0;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box>
        <Text color="cyan" bold>
          ╔═══════════════════════════════════════════════════════════════╗
        </Text>
      </Box>
      <Box>
        <Text color="cyan" bold>
          ║  Agents{' '.repeat(56)}║
        </Text>
      </Box>
      <Box>
        <Text color="cyan" bold>
          ╠═══════════════════════════════════════════════════════════════╣
        </Text>
      </Box>

      {/* Status */}
      {!hasAgents && (
        <Box marginLeft={1} marginTop={1}>
          <Text color="cyan">║ </Text>
          <Text color="green">No agents found{' '.repeat(44)}</Text>
          <Text color="cyan">║</Text>
        </Box>
      )}

      {hasAgents && (
        <>
          <Box marginLeft={1} marginTop={1}>
            <Text color="cyan">║ </Text>
            <Text color="green">Active Agents: {agents.length}</Text>
          </Box>
          {agents.map((agent, index) => (
            <Box key={index} marginLeft={1}>
              <Text color="cyan">║ </Text>
              <Text color="white">• {agent.name}</Text>
              <Text color="gray"> - {agent.description}</Text>
            </Box>
          ))}
        </>
      )}

      {/* Create new agent section */}
      <Box marginLeft={1} marginTop={2}>
        <Text color="cyan">║ </Text>
        <Text color="yellow" bold>
          Create new agent{' '.repeat(44)}
        </Text>
      </Box>

      <Box marginLeft={1} marginTop={1}>
        <Text color="cyan">║ </Text>
        <Text color="gray" dimColor>
          Each subagent has its own context window, custom system prompt, and
        </Text>
        <Text color="cyan">║</Text>
      </Box>
      <Box marginLeft={1}>
        <Text color="cyan">║ </Text>
        <Text color="gray" dimColor>
          specific tools. Try creating: Code Reviewer, Code Simplifier,
        </Text>
        <Text color="cyan">║</Text>
      </Box>
      <Box marginLeft={1}>
        <Text color="cyan">║ </Text>
        <Text color="gray" dimColor>
          Security Reviewer, Tech Lead, or UX Reviewer.{' '.repeat(18)}
        </Text>
        <Text color="cyan">║</Text>
      </Box>

      {/* Available agent types */}
      <Box marginLeft={1} marginTop={2}>
        {AVAILABLE_AGENT_TYPES.map((agentType, index) => {
          const isSelected = index === selectedIndex;
          const cursor = isSelected ? '→' : ' ';
          const nameColor = isSelected ? 'green' : 'white';

          return (
            <Box key={agentType.name} flexDirection="column">
              <Box>
                <Text color="cyan">║ </Text>
                <Text color={nameColor}>
                  {cursor} {agentType.name}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="cyan" bold>
          ╚═══════════════════════════════════════════════════════════════╝
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ Navigate | Enter = Create agent | Esc = Cancel
        </Text>
      </Box>
    </Box>
  );
};
