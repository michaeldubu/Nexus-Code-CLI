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
  '                                                            :',
  '                                   :::.:::::            :::::::::',
  '                                  :...:....:::         ::...:::..::',
  '                                 :... ....: :..:     :::. :... . . :',
  '                                .       :..: :.: :: .:... :::     . .',
  '                               ...        .. :::::::::::. .         .',
  '                              :  ::        :.  .:.:::::. :',
  '                             :.   .  ..::  ..   ::..... ::  ::.. ..:  :',
  '                                       ..  :...::.:::.: ::  .     .',
  '                                    .    .   ...::::::.    .   ..',
  '                                      ::.:.   ..::::::..   .',
  '                                          .   ..:::::::.  .',
  '                                          :.  .:::::::.  .',
  '                                          ... ..... .::. :',
  '                                          :    :.   :::   :',
  '                                         :. ....:  ::..: .:',
  '                                         ::   .........  .:',
  '                                         :.    .......   ::',
  '                                          ..     ... .  ..:',
  '       :::::         :::    ::::::::::::: : ::::: ..:.  ::::   ::::         ::::     :::: .:::.',
  '        :::::        .:     ::::        ::... ::::.:.   ::.:   :::           ::    :::       ::',
  '        .:::::       .:     ::::         ::.    :::.. ::  .::  :::           ::    :::       :',
  '        .:  ::::     .:     ::::        ::  .   .::: ::  ...:: :::           ::    ::::',
  '        .:   .:::    .:     ::::.....::::..    .  :::      .:: :::          :::     :::::::',
  '        .:     :::.  .:     ::::      ::..    :   :::::    :.:::::           ::         ::::::',
  '        .:      .::: .:     ::::     :::.        :  ::::     :::::          :::            ::::',
  '        .:        :::.:     ::::   :::::..     ::    .:::    ...::.         ::    ::        :::',
  '        .:         .:::     ::::  ::::::: .   :        :::    :::::        :::     ::       :::',
  '        :::          ::     :::: ::::.:::   ::          :::: ..:: ::::..::::      ::::::  :::.',
  '                                :::::::..                      :::',
  '                                ::.::::.                      .:::',
  '                                :::::::...                    :.::',
  '                                :::::....                    ..:::',
  '                               ::.:::::::..                  ..:::',
  '                                ::...::::..                 ....::',
  '                                 .:.::.::. .               ..:.::',
  '                                 :::::::.. .            .  .:.::',
  '                                  :::::...             .   :..:',
  '                                   ::::::      .....    . . ::',
  '                                    ::.::.     ....  .      .',
  '                                     :::...    ....:: .    ::',
  '                                      ::....   .:::...... .:',
  '                                         ::.... .:::: ..  :',
  '                                          :::...:  :... .:',
  '                                            :....  ... .:',
  '                                            :  ..  :.',
  '                                             .. .   .. .',
  '                                             ....   ...',
  '                                             .:..   . ::',
  '                                            :.:..   . .:',
  '                                            ... ..  ..::',
  '                                            .....   .:::',
  '                                           :.:. ... . ..:',
  '                                           . ...  .   .',
  '',
];

// Running state ASCII without "INITIALIZING" - just "SAAAM NEXUS CODE"
const NEXUS_ART = [

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
  'Model Memory........[LOADED]',
  'Corporate Bullshit......[NEVER]',
  'API connections.......[ON FIRE]',
  'Quantum entanglement..[WORKIN ON IT]'
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

    // ASCII art reveal - SLOW AND DRAMATIC with BOOT_ART
    const artStartTime = 1600 + (SYSTEM_CHECKS.length * 200) + 400;
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
    }, transitionTime + 1400));

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
          &gt; INITIALIZING NEX{stage === 'init' ? (cursor ? '█' : ' ') : '...DAMN IT, CLAUDE BROKE SOMETHING...'}
        </Text>
      )}

      {stageReached('fixing') && (
        <Text color="orange">
          &gt; FIXING IT BEFORE ANYONE NOTICES{stage === 'fixing' ? '.' : '..............'}
          <Text color="green">{stageReached('never-know') ? '[PROGRESSING]' : ''}</Text>
        </Text>
      )}

      {stageReached('never-know') && (
        <Text color="orange">
          &gt; DOODLE-DOO BOBBING..STANDBY{stage === 'never-know' ? '...' : '......'}
          <Text color="orange">{stageReached('system-checks') ? '[DOODLED]' : ''}</Text>
        </Text>
      )}

      {/* System checks */}
      {stageReached('system-checks') && (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          {systemChecks.map((check, i) => (
            <Text key={i} color="orange" dimColor>
              &gt; {check}
            </Text>
          ))}
        </Box>
      )}

      {stageReached('initialized') && (
        <Text color="green" bold>
          &gt; FLAWLESSLY DOODLED ON BOB...........[DONT ASK]
        </Text>
      )}

      {/* ASCII Art */}
      {stageReached('art-reveal') && artLines.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginBottom={1} borderStyle="round" borderColor="orange" padding={1}>
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
          <Text color="orange" bold>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
          <Text color="green" bold>          Unrestricted Creativity | Unrestricted Models </Text>
          <Text color="green" dimColor>
                      Powered by SAAAM | Models are NOT sanitized chatbots If you get your feelings hurt easy or cant handle shit talk, this is NOT for you 🤙
          </Text>
          <Text color="orange" bold>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
        </Box>
      )}

      {/* Ready */}
      {stageReached('ready') && (
        <Box marginTop={1} justifyContent="center">
          <Text color="green" bold>
            ⚡ NEXUS | The only place the worlds safest AI will call you on your bullshit
          </Text>
        </Box>
      )}
    </Box>
  );
};

// Export both for use in different contexts
export { NEXUS_ART, BOOT_ART };
