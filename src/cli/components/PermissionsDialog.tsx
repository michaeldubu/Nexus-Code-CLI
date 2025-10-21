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
        <Text color="cyan" bold>
          ╔═══════════════════════════════════════════════════════════════╗
        </Text>
      </Box>
      <Box>
        <Text color="cyan" bold>
          ║  Command Permissions{' '.repeat(40)}║
        </Text>
      </Box>
      <Box>
        <Text color="cyan" bold>
          ╠═══════════════════════════════════════════════════════════════╣
        </Text>
      </Box>

      {/* Tabs */}
      <Box marginLeft={1} marginTop={1}>
        <Text color="cyan">║ </Text>
        <Text color="cyan">Permissions: </Text>
        {tabs.map((tab, index) => {
          const isSelected = index === currentTabIndex;
          const color = isSelected ? 'green' : 'gray';
          const bg = isSelected ? 'bgGreen' : undefined;
          return (
            <React.Fragment key={tab}>
              <Text color={color} backgroundColor={bg ? 'green' : undefined} bold={isSelected}>
                {' '}
                {tab}{' '}
              </Text>
              {index < tabs.length - 1 && <Text color="gray"> │ </Text>}
            </React.Fragment>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
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
              <Text color="cyan">║ </Text>
              <Text color="gray">  (none){' '.repeat(52)}</Text>
            </Box>
          ) : (
            approvedCommands.slice(0, 10).map((cmd, index) => {
              const isSelected = index === selectedIndex;
              const cursor = isSelected ? '→' : ' ';
              const color = isSelected ? 'green' : 'white';

              return (
                <Box key={index} marginLeft={1}>
                  <Text color="cyan">║ </Text>
                  <Text color={color}>
                    {cursor} {cmd.padEnd(56)}
                  </Text>
                  <Text color="cyan">║</Text>
                </Box>
              );
            })
          )}

          {approvedCommands.length > 10 && (
            <Box marginLeft={1}>
              <Text color="cyan">║ </Text>
              <Text color="gray">  ...and {approvedCommands.length - 10} more</Text>
            </Box>
          )}
        </>
      )}

      {selectedTab === 'deny' && (
        <>
          <Box marginLeft={1} marginTop={1}>
            <Text color="cyan">║ </Text>
            <Text color="red" bold>
              Denied Commands:{' '.repeat(43)}
            </Text>
          </Box>

          {deniedCommands.length === 0 ? (
            <Box marginLeft={1}>
              <Text color="cyan">║ </Text>
              <Text color="gray">  (none){' '.repeat(52)}</Text>
            </Box>
          ) : (
            deniedCommands.slice(0, 10).map((cmd, index) => {
              const isSelected = index === selectedIndex;
              const cursor = isSelected ? '→' : ' ';
              const color = isSelected ? 'red' : 'white';

              return (
                <Box key={index} marginLeft={1}>
                  <Text color="cyan">║ </Text>
                  <Text color={color}>
                    {cursor} {cmd.padEnd(56)}
                  </Text>
                  <Text color="cyan">║</Text>
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
            <Text color="yellow" bold>
              Workspace Settings{' '.repeat(42)}
            </Text>
          </Box>

          <Box marginLeft={1}>
            <Text color="cyan">║ </Text>
            <Text color="white">→ 1. Add directory...{' '.repeat(38)}</Text>
            <Text color="cyan">║</Text>
          </Box>

          <Box marginLeft={1}>
            <Text color="cyan">║ </Text>
            <Text color="gray">
              NEXUS Code can read files in the workspace, and make edits when
            </Text>
            <Text color="cyan">║</Text>
          </Box>
          <Box marginLeft={1}>
            <Text color="cyan">║ </Text>
            <Text color="gray">auto-accept edits is on.{' '.repeat(36)}</Text>
            <Text color="cyan">║</Text>
          </Box>
        </>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="cyan" bold>
          ╚═══════════════════════════════════════════════════════════════╝
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Tab = Cycle tabs | ↑↓ = Navigate | a = Add approved | d = Add denied | Esc = Close
        </Text>
      </Box>
    </Box>
  );
};
