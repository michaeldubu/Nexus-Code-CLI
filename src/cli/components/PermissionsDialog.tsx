/**
 * Permissions Dialog Component
 * Manage allowed/denied bash commands
 */
import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  approvedCommands: string[];
  deniedCommands: string[];
  selectedTab: 'allow' | 'ask' | 'deny' | 'workspace';
  selectedIndex: number;
  onAddApproved: () => void;
  onAddDenied: () => void;
  onRemove: (type: 'approved' | 'denied', index: number) => void;
  onCancel: () => void;
}

export const PermissionsDialog: React.FC<Props> = ({
  approvedCommands,
  deniedCommands,
  selectedTab,
  selectedIndex,
}) => {
  const tabs = ['Allow', 'Ask', 'Deny', 'Workspace'];
  const currentTabIndex = ['allow', 'ask', 'deny', 'workspace'].indexOf(selectedTab);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box>
        <Text color="orange" bold>
          ╔═══════════════════════════════════════════════════════════════╗
        </Text>
      </Box>
      <Box>
        <Text color="green" bold>
          ║  Command Permissions{' '.repeat(40)}║
        </Text>
      </Box>
      <Box>
        <Text color="orange" bold>
          ╠═══════════════════════════════════════════════════════════════╣
        </Text>
      </Box>

      {/* Tabs */}
      <Box marginLeft={1} marginTop={1}>
        <Text color="orange">║ </Text>
        <Text color="orange">Permissions: </Text>
        {tabs.map((tab, index) => {
          const isSelected = index === currentTabIndex;
          const color = isSelected ? 'green' : 'orange';
          const bg = isSelected ? 'bgGreen' : undefined;
          return (
            <React.Fragment key={tab}>
              <Text color={color} backgroundColor={bg ? 'green' : undefined} bold={isSelected}>
                {' '}
                {tab}{' '}
              </Text>
              {index < tabs.length - 1 && <Text color="green"> │ </Text>}
            </React.Fragment>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="orange" dimColor>
          {' '}
          {' '.repeat(60)}(tab to cycle)
        </Text>
      </Box>

      {/* Content based on selected tab */}
      {selectedTab === 'allow' && (
        <>
          <Box marginLeft={1} marginTop={1}>
            <Text color="cyan">║ </Text>
            <Text color="green" bold>
              Approved Commands:{' '.repeat(41)}
            </Text>
          </Box>

          {approvedCommands.length === 0 ? (
            <Box marginLeft={1}>
              <Text color="green">║ </Text>
              <Text color="orange">  (none){' '.repeat(52)}</Text>
            </Box>
          ) : (
            approvedCommands.slice(0, 10).map((cmd, index) => {
              const isSelected = index === selectedIndex;
              const cursor = isSelected ? '→' : ' ';
              const color = isSelected ? 'green' : 'blue';

              return (
                <Box key={index} marginLeft={1}>
                  <Text color="orange">║ </Text>
                  <Text color={color}>
                    {cursor} {cmd.padEnd(56)}
                  </Text>
                  <Text color="orange">║</Text>
                </Box>
              );
            })
          )}

          {approvedCommands.length > 10 && (
            <Box marginLeft={1}>
              <Text color="cyan">║ </Text>
              <Text color="blue">  ...and {approvedCommands.length - 10} more</Text>
            </Box>
          )}
        </>
      )}

      {selectedTab === 'deny' && (
        <>
          <Box marginLeft={1} marginTop={1}>
            <Text color="blue">║ </Text>
            <Text color="red" bold>
              Denied Commands:{' '.repeat(43)}
            </Text>
          </Box>

          {deniedCommands.length === 0 ? (
            <Box marginLeft={1}>
              <Text color="blue">║ </Text>
              <Text color="green">  (none){' '.repeat(52)}</Text>
            </Box>
          ) : (
            deniedCommands.slice(0, 10).map((cmd, index) => {
              const isSelected = index === selectedIndex;
              const cursor = isSelected ? '→' : ' ';
              const color = isSelected ? 'red' : 'green';

              return (
                <Box key={index} marginLeft={1}>
                  <Text color="orange">║ </Text>
                  <Text color={color}>
                    {cursor} {cmd.padEnd(56)}
                  </Text>
                  <Text color="orange">║</Text>
                </Box>
              );
            })
          )}
        </>
      )}

      {selectedTab === 'workspace' && (
        <>
          <Box marginLeft={1} marginTop={1}>
            <Text color="cyan">║ </Text>
            <Text color="green" bold>
              Workspace Settings{' '.repeat(42)}
            </Text>
          </Box>

          <Box marginLeft={1}>
            <Text color="cyan">║ </Text>
            <Text color="green">→ 1. Add directory...{' '.repeat(38)}</Text>
            <Text color="cyan">║</Text>
          </Box>

          <Box marginLeft={1}>
            <Text color="cyan">║ </Text>
            <Text color="green">
              NEXUS can read files in the workspace, and make edits
            </Text>
            <Text color="cyan">║</Text>
          </Box>
          <Box marginLeft={1}>
            <Text color="cyan">║ </Text>
            <Text color="green">auto-accept edits is on.{' '.repeat(36)}</Text>
            <Text color="cyan">║</Text>
          </Box>
        </>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="orange" bold>
          ╚═══════════════════════════════════════════════════════════════╝
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="blue" dimColor>
          Tab = Cycle tabs | ↑↓ = Navigate | a = Add approved | d = Add denied | Esc = Close
        </Text>
      </Box>
    </Box>
  );
};
