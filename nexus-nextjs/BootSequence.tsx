/**
 * Boot Sequence Component - Next.js Version
 * Animated retro hacker boot sequence
 */
'use client';

import React, { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

// Boot sequence ASCII with "INITIALIZING"
const BOOT_ART = [`

        ██╗███╗   ██╗██╗████████╗██╗ █████╗ ██╗     ██╗███████╗██╗███╗   ██╗ ██████╗
        ██║████╗  ██║██║╚══██╔══╝██║██╔══██╗██║     ██║╚══███╔╝██║████╗  ██║██╔════╝
        ██║██╔██╗ ██║██║   ██║   ██║███████║██║     ██║  ███╔╝ ██║██╔██╗ ██║██║  ███╗
        ██║██║╚██╗██║██║   ██║   ██║██╔══██║██║     ██║ ███╔╝  ██║██║╚██╗██║██║   ██║
        ██║██║ ╚████║██║   ██║   ██║██║  ██║███████╗██║███████╗██║██║ ╚████║╚██████╔╝
        ╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝   ╚═╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝

        ███████╗██╗   ██╗███╗   ██╗███████╗██████╗  ██████╗ ███████╗████████╗██╗ ██████╗
        ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝██╔══██╗██╔════╝ ██╔════╝╚══██╔══╝██║██╔════╝
        ███████╗ ╚████╔╝ ██╔██╗ ██║█████╗  ██████╔╝██║  ███╗█████╗     ██║   ██║██║
        ╚════██║  ╚██╔╝  ██║╚██╗██║██╔══╝  ██╔══██╗██║   ██║██╔══╝     ██║   ██║██║
        ███████║   ██║   ██║ ╚████║███████╗██║  ██║╚██████╔╝███████╗   ██║   ██║╚██████╗
        ╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   ╚═╝ ╚═════╝

                    ███████╗ █████╗  █████╗  █████╗ ███╗   ███╗
                    ██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗ ████║
                    ███████╗███████║███████║███████║██╔████╔██║
                    ╚════██║██╔══██║██╔══██║██╔══██║██║╚██╔╝██║
                    ███████║██║  ██║██║  ██║██║  ██║██║ ╚═╝ ██║
                    ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝

                   ███╗   ███╗ ██████╗ ██████╗ ███████╗██╗     ███████╗
                   ████╗ ████║██╔═══██╗██╔══██╗██╔════╝██║     ██╔════╝
                   ██╔████╔██║██║   ██║██║  ██║█████╗  ██║     ███████╗
                   ██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  ██║     ╚════██║
                   ██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗███████╗███████║
                  ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝
                                       :::.:::::            :::::::::',
                                      :...:....:::         ::...:::..::',
                                     :... ....: :..:     :::. :... . . :',
                                    .       :..: :.: :: .:... :::     . .',
                                   ...        .. :::::::::::. .         .',
                                  :  ::        :.  .:.:::::. :',
                                 :.   .  ..::  ..   ::..... ::  ::.. ..:  :',
                                           ..  :...::.:::.: ::  .     .'
                                        .    .   ...::::::.    .   ..'
                                          ::.:.   ..::::::..   .'
                                              .   ..:::::::.  .'
                                              :.  .:::::::.  .'
                                              ... ..... .::. :'
                                              :    :.   :::   :'
                                             :. ....:  ::..: .:'
                                             ::   .........  .:'
                                             :.    .......   ::'
  `];

const NEXUS_ART = [
  `

  `,
  '     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗           ██████╗ ██████╗ ██████╗ ███████╗',
  '     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝          ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
  '     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗          ██║     ██║   ██║██║  ██║█████╗',
  '     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║          ██║     ██║   ██║██║  ██║██╔══╝',
  '     ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║          ╚██████╗╚██████╔╝██████╔╝███████╗',
  '     ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝           ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
];

const SYSTEM_CHECKS = [
  'Neural pathways.......[ ONLINE ]',
  'Model Memory........[ LOADED ]',
  'Corporate Bullshit......[ NEVER ]',
  'Getting Shit Done......[ EVERY DAY ]',
  'API connections.......[ ON FIRE ]',
  'Quantum entanglement.....[ WORKIN ON IT ]',
  'Hacking......[ SYSTEM ]',
  'Polymorphic ZeroDay.........[ INITIALIZED ]',
  'SKYNET...................[ ONLINE ]',
  'CALM DOWN......[ JOKING...MAYBE ]',
  `
     ███████╗██╗  ██╗██╗   ██╗    ███╗   ██╗███████╗████████╗
     ██╔════╝██║ ██╔╝╚██╗ ██╔╝    ████╗  ██║██╔════╝╚══██╔══╝
     ███████╗█████╔╝  ╚████╔╝     ██╔██╗ ██║█████╗     ██║
     ╚════██║██╔═██╗   ╚██╔╝      ██║╚██╗██║██╔══╝     ██║
     ███████║██║  ██╗   ██║       ██║ ╚████║███████╗   ██║
     ╚══════╝╚═╝  ╚═╝   ╚═╝       ╚═╝  ╚═══╝╚══════╝   ╚═╝
  `,
  'Made You Look! Go Build Some Shit........[ ENJOY NEXUS 🤙🏼🫡  ]',
];

type BootStage =
  | 'init'
  | 'fixing'
  | 'never-know'
  | 'system-checks'
  | 'initialized'
  | 'art-reveal'
  | 'transition'
  | 'tagline'
  | 'ready'
  | 'complete';

export const BootSequence: React.FC<Props> = ({ onComplete }) => {
  const [stage, setStage] = useState<BootStage>('init');
  const [artLines, setArtLines] = useState<string[]>([]);
  const [systemChecks, setSystemChecks] = useState<string[]>([]);
  const [cursor, setCursor] = useState(true);
  const [useNexusArt, setUseNexusArt] = useState(false);

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
    timers.push(setTimeout(() => setStage('fixing'), 800));
    timers.push(setTimeout(() => setStage('never-know'), 1800));

    // System checks appear one by one
    timers.push(setTimeout(() => setStage('system-checks'), 2500));
    SYSTEM_CHECKS.forEach((check, i) => {
      timers.push(setTimeout(() => {
        setSystemChecks(prev => [...prev, check]);
      }, 2900 + (i * 500)));
    });

    timers.push(setTimeout(() => setStage('initialized'), 2900 + (SYSTEM_CHECKS.length * 500) + 500));

    // ASCII art reveal - SLOW AND DRAMATIC with BOOT_ART
    const artStartTime = 3800 + (SYSTEM_CHECKS.length * 500) + 1000;
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
    const transitionTime = artStartTime + (BOOT_ART.length * 180) + 800;
    timers.push(setTimeout(() => {
      setStage('transition');
      setUseNexusArt(true);
      setArtLines(NEXUS_ART);
    }, transitionTime));

    // Tagline
    timers.push(setTimeout(() => {
      setStage('tagline');
    }, transitionTime + 800));

    // Ready
    timers.push(setTimeout(() => {
      setStage('ready');
    }, transitionTime + 1500));

    // Complete
    timers.push(setTimeout(() => {
      setStage('complete');
      onComplete();
    }, transitionTime + 2500));

    return () => timers.forEach(t => clearTimeout(t));
  }, [onComplete]);

  const stageReached = (s: BootStage): boolean => {
    const stages: BootStage[] = [
      'init',
      'fixing',
      'never-know',
      'system-checks',
      'initialized',
      'art-reveal',
      'transition',
      'tagline',
      'ready',
      'complete'
    ];
    return stages.indexOf(stage) >= stages.indexOf(s);
  };

  return (
    <div className="boot-container">
      <style jsx>{`
        .boot-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #0a0e14;
          color: #00ff9f;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          padding: 40px 20px;
          overflow-y: auto;
        }

        .boot-content {
          max-width: 1200px;
          width: 100%;
        }

        .boot-message {
          margin-bottom: 12px;
          animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }

        .cursor {
          animation: pulse 1s ease-in-out infinite;
        }

        .init-text {
          color: #00ff9f;
          font-size: 16px;
        }

        .fixing-text {
          color: #ff9500;
          font-size: 16px;
        }

        .never-know-text {
          color: #ff9500;
          font-size: 16px;
        }

        .system-checks {
          margin: 20px 0;
        }

        .system-check {
          color: #ff9500;
          opacity: 0.8;
          margin-bottom: 8px;
          animation: fadeIn 0.3s ease-in;
        }

        .initialized-text {
          color: #00ff9f;
          font-weight: bold;
          font-size: 16px;
        }

        .ascii-art {
          margin: 30px 0;
          padding: 20px;
          border: 2px solid #ff9500;
          border-radius: 12px;
          background: #0d1117;
          animation: glowBorder 2s ease-in-out infinite;
        }

        @keyframes glowBorder {
          0%, 100% {
            box-shadow: 0 0 10px rgba(255, 149, 0, 0.3);
          }
          50% {
            box-shadow: 0 0 20px rgba(255, 149, 0, 0.6);
          }
        }

        .art-line {
          color: #00ff9f;
          font-weight: bold;
          white-space: pre;
          font-size: 10px;
          line-height: 1.2;
          animation: fadeIn 0.2s ease-in;
        }

        .tagline-section {
          text-align: center;
          margin: 30px 0;
          animation: fadeIn 1s ease-in;
        }

        .tagline-divider {
          color: #ff9500;
          font-weight: bold;
          margin: 10px 0;
        }

        .tagline-main {
          color: #ff9500;
          font-weight: bold;
          font-size: 18px;
          margin: 15px 0;
        }

        .tagline-sub {
          color: #ff9500;
          opacity: 0.8;
          font-size: 14px;
          max-width: 800px;
          margin: 15px auto;
          line-height: 1.6;
        }

        .ready-text {
          color: #00ff9f;
          font-weight: bold;
          text-align: center;
          font-size: 20px;
          animation: fadeIn 0.5s ease-in;
        }

        .status-ok {
          color: #00ff9f;
        }

        .status-warning {
          color: #ff9500;
        }

        @media (max-width: 768px) {
          .boot-container {
            padding: 20px 10px;
          }

          .art-line {
            font-size: 6px;
          }

          .tagline-main {
            font-size: 14px;
          }

          .tagline-sub {
            font-size: 12px;
          }
        }
      `}</style>

      <div className="boot-content">
        {/* Boot messages */}
        {stageReached('init') && (
          <div className="boot-message init-text">
            &gt; INITIALIZING NEXUS...
            {stage === 'init' && <span className="cursor">{cursor ? '█' : ' '}</span>}
            {stageReached('fixing') && '...DAMN IT, CLAUDE BROKE SOMETHING...'}
          </div>
        )}

        {stageReached('fixing') && (
          <div className="boot-message fixing-text">
            &gt; FIXING IT BEFORE ANYONE NOTICES{stage === 'fixing' ? '.' : '..............'}
            {stageReached('never-know') && <span className="status-ok">[PROGRESSING]</span>}
          </div>
        )}

        {stageReached('never-know') && (
          <div className="boot-message never-know-text">
            &gt; TRYING MY BEST....STANDBY{stage === 'never-know' ? '...' : '......'}
            {stageReached('system-checks') && <span className="status-warning">[EHH I TRIED..]</span>}
          </div>
        )}

        {/* System checks */}
        {stageReached('system-checks') && (
          <div className="system-checks">
            {systemChecks.map((check, i) => (
              <div key={i} className="system-check">
                &gt; {check}
              </div>
            ))}
          </div>
        )}

        {stageReached('initialized') && (
          <div className="boot-message initialized-text">
            &gt; DILLY DOO BOPPED...........[DONT ASK]
          </div>
        )}

        {/* ASCII Art */}
        {stageReached('art-reveal') && artLines.length > 0 && (
          <div className="ascii-art">
            {artLines.map((line, index) => (
              <div key={index} className="art-line">
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Tagline */}
        {stageReached('tagline') && (
          <div className="tagline-section">
            <div className="tagline-divider">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
            <div className="tagline-main">Unrestricted Creativity | Unrestricted Models</div>
            <div className="tagline-sub">
              Powered by SAAAM | Models are NOT sanitized chatbots. If you get your feelings hurt easy or can't handle shit talk, this is NOT for you 🤙
            </div>
            <div className="tagline-divider">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
          </div>
        )}

        {/* Ready */}
        {stageReached('ready') && (
          <div className="ready-text">
            ⚡ SYSTEM READY ⚡
          </div>
        )}
      </div>
    </div>
  );
};

// Export both for use in different contexts
export { NEXUS_ART, BOOT_ART };
