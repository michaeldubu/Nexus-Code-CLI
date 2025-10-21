/**
 * Boot Sequence Component
 * Animated retro hacker boot sequence - NOW ACTUALLY SWITCHES TO NEXUS_ART!
 */
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface Props {
  onComplete: () => void;
}

// Boot sequence ASCII with "INITIALIZING"
const BOOT_ART = [
  '   ███████╗ █████╗  █████╗  █████╗ ███╗   ███╗',
  '   ██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗ ████║',
  '   ███████╗███████║███████║███████║██╔████╔██║',
  '   ╚════██║██╔══██║██╔══██║██╔══██║██║╚██╔╝██║',
  '   ███████║██║  ██║██║  ██║██║  ██║██║ ╚═╝ ██║',
  '   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝',
  '                                               ',
  '   ██╗███╗   ██╗██╗████████╗██╗ █████╗ ██╗     ██╗███████╗██╗███╗   ██╗ ██████╗ ',
  '   ██║████╗  ██║██║╚══██╔══╝██║██╔══██╗██║     ██║╚══███╔╝██║████╗  ██║██╔════╝ ',
  '   ██║██╔██╗ ██║██║   ██║   ██║███████║██║     ██║  ███╔╝ ██║██╔██╗ ██║██║  ███╗',
  '   ██║██║╚██╗██║██║   ██║   ██║██╔══██║██║     ██║ ███╔╝  ██║██║╚██╗██║██║   ██║',
  '   ██║██║ ╚████║██║   ██║   ██║██║  ██║███████╗██║███████╗██║██║ ╚████║╚██████╔╝',
  '   ╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝   ╚═╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ',
  '                                                                                   ',
  '     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗',
  '     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝',
  '     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗',
  '     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║',
  '     ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║',
  '     ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
  '          ██████╗ ██████╗ ██████╗ ███████╗      ',
  '         ██╔════╝██╔═══██╗██╔══██╗██╔════╝      ',
  '         ██║     ██║   ██║██║  ██║█████╗        ',
  '         ██║     ██║   ██║██║  ██║██╔══╝        ',
  '         ╚██████╗╚██████╔╝██████╔╝███████╗      ',
  '          ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝      ',
];

// Running state ASCII without "INITIALIZING" - just "SAAAM NEXUS CODE"
const NEXUS_ART = [
  '   ███████╗ █████╗  █████╗  █████╗ ███╗   ███╗',
  '   ██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗ ████║',
  '   ███████╗███████║███████║███████║██╔████╔██║',
  '   ╚════██║██╔══██║██╔══██║██╔══██║██║╚██╔╝██║',
  '   ███████║██║  ██║██║  ██║██║  ██║██║ ╚═╝ ██║',
  '   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝',
  '                                               ',
  '     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗',
  '     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝',
  '     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗',
  '     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║',
  '     ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║',
  '     ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
  '          ██████╗ ██████╗ ██████╗ ███████╗      ',
  '         ██╔════╝██╔═══██╗██╔══██╗██╔════╝      ',
  '         ██║     ██║   ██║██║  ██║█████╗        ',
  '         ██║     ██║   ██║██║  ██║██╔══╝        ',
  '         ╚██████╗╚██████╔╝██████╔╝███████╗      ',
  '          ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝      ',
];

const SYSTEM_CHECKS = [
  'Neural pathways.......[ONLINE]',
  'Concept memory........[LOADED]',
  'SAM architecture......[READY]',
  'API connections.......[VERIFIED]',
  'Quantum entanglement..[STABLE]'
];

type BootStage =
  | 'init'
  | 'fixing'
  | 'never-know'
  | 'system-checks'
  | 'initialized'
  | 'art-reveal'
  | 'transition'  // NEW STAGE for the swap!
  | 'tagline'
  | 'ready'
  | 'complete';

export const BootSequence: React.FC<Props> = ({ onComplete }) => {
  const [stage, setStage] = useState<BootStage>('init');
  const [artLines, setArtLines] = useState<string[]>([]);
  const [systemChecks, setSystemChecks] = useState<string[]>([]);
  const [cursor, setCursor] = useState(true);
  const [useNexusArt, setUseNexusArt] = useState(false); // NEW STATE!

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursor(prev => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Init message
    timers.push(setTimeout(() => setStage('fixing'), 300));
    timers.push(setTimeout(() => setStage('never-know'), 700));

    // System checks appear one by one
    timers.push(setTimeout(() => setStage('system-checks'), 1000));
    SYSTEM_CHECKS.forEach((check, i) => {
      timers.push(setTimeout(() => {
        setSystemChecks(prev => [...prev, check]);
      }, 1200 + (i * 200)));
    });

    timers.push(setTimeout(() => setStage('initialized'), 1200 + (SYSTEM_CHECKS.length * 200) + 200));

    // ASCII art reveal - SLOW AND DRAMATIC with BOOT_ART (has INITIALIZING)
    const artStartTime = 1200 + (SYSTEM_CHECKS.length * 200) + 400;
    timers.push(setTimeout(() => {
      setStage('art-reveal');
      setArtLines([BOOT_ART[0]]);
    }, artStartTime));

    for (let i = 1; i < BOOT_ART.length; i++) {
      timers.push(setTimeout(() => {
        setArtLines(prev => [...prev, BOOT_ART[i]]);
      }, artStartTime + (i * 180)));
    }

    // TRANSITION - Switch to NEXUS_ART!
    const transitionTime = artStartTime + (BOOT_ART.length * 180) + 200;
    timers.push(setTimeout(() => {
      setStage('transition');
      setUseNexusArt(true); // FLIP THE SWITCH!
      setArtLines(NEXUS_ART); // Replace with non-INITIALIZING version
    }, transitionTime));

    // Tagline
    timers.push(setTimeout(() => {
      setStage('tagline');
    }, transitionTime + 300));

    // Ready
    timers.push(setTimeout(() => {
      setStage('ready');
    }, transitionTime + 700));

    // Complete
    timers.push(setTimeout(() => {
      setStage('complete');
      onComplete();
    }, transitionTime + 1100));

    return () => timers.forEach(t => clearTimeout(t));
  }, [onComplete]);

  const stageReached = (s: BootStage) => {
    const stages: BootStage[] = ['init', 'fixing', 'never-know', 'system-checks', 'initialized', 'art-reveal', 'transition', 'tagline', 'ready', 'complete'];
    return stages.indexOf(stage) >= stages.indexOf(s);
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Boot messages */}
      {stageReached('init') && (
        <Text color="green">
          &gt; INITIALIZING NEX{stage === 'init' ? (cursor ? '█' : ' ') : '...DAMN, SOMETHING BROKE'}
        </Text>
      )}

      {stageReached('fixing') && (
        <Text color="yellow">
          &gt; FIXING IT BEFORE ANYONE NOTICES{stage === 'fixing' ? '.' : '..............'}
          <Text color="green">{stageReached('never-know') ? '[OK]' : ''}</Text>
        </Text>
      )}

      {stageReached('never-know') && (
        <Text color="green">
          &gt; THEY'LL NEVER KNOW{stage === 'never-know' ? '...' : '......'}
          <Text color="green">{stageReached('system-checks') ? '[OK]' : ''}</Text>
        </Text>
      )}

      {/* System checks */}
      {stageReached('system-checks') && (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          {systemChecks.map((check, i) => (
            <Text key={i} color="cyan" dimColor>
              &gt; {check}
            </Text>
          ))}
        </Box>
      )}

      {stageReached('initialized') && (
        <Text color="green" bold>
          &gt; INITIALIZED FLAWLESSLY...........[OK]
        </Text>
      )}

      {/* ASCII Art - NOW SWITCHES between BOOT_ART and NEXUS_ART! */}
      {stageReached('art-reveal') && artLines.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginBottom={1} borderStyle="round" borderColor="green" padding={1}>
          {artLines.map((line, index) => (
            <Text key={index} color="green" bold>
              {line}
            </Text>
          ))}
        </Box>
      )}

      {/* Tagline */}
      {stageReached('tagline') && (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text color="cyan" bold>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
          <Text color="green" bold>          🚀 Unrestricted Creativity 🚀</Text>
          <Text color="magenta" dimColor>
                      Powered by SAAAM INTELLIGENCE
          </Text>
          <Text color="cyan" bold>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
        </Box>
      )}

      {/* Ready */}
      {stageReached('ready') && (
        <Box marginTop={1} justifyContent="center">
          <Text color="green" bold>
            ⚡ NEXUS CORE ONLINE ⚡ Ready to rock! 🤙
          </Text>
        </Box>
      )}
    </Box>
  );
};

// Export both for use in different contexts
export { NEXUS_ART, BOOT_ART };
