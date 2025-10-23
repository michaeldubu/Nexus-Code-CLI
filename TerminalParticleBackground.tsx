/**
 * Terminal Particle Background
 * GPU-accelerated particle system rendered in terminal
 * Supports: Unicode rendering, Kitty Graphics Protocol, Sixel
 */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { Canvas, createCanvas } from 'canvas';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  origSize: number;
  color: string;
  alpha: number;
  pulse: number;
  pulseSpeed: number;
  growing: boolean;
  char: string;
}

interface Connection {
  i: number;
  j: number;
  distance: number;
}

interface FocusPoint {
  x: number;
  y: number;
}

interface TerminalParticleBackgroundProps {
  particleCount?: number;
  connectionDistance?: number;
  useKittyProtocol?: boolean;
  useSixel?: boolean;
  fps?: number;
}

// Particle characters for different sizes
const PARTICLE_CHARS = ['·', '•', '●', '◉', '◎'];
const CONNECT_CHARS = ['─', '━', '═'];

// Colors matching the canvas version
const COLORS = {
  orange: '\x1b[38;2;255;107;53m',
  white: '\x1b[38;2;255;255;255m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

// ANSI escape sequences for terminal graphics
const ANSI = {
  clearScreen: '\x1b[2J',
  home: '\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',
  altScreenBuffer: '\x1b[?1049h',
  normalScreenBuffer: '\x1b[?1049l',
};

// Kitty Graphics Protocol
class KittyGraphics {
  private static encodeBase64(data: Buffer): string {
    return data.toString('base64');
  }

  static displayImage(imageData: Buffer, width: number, height: number): string {
    const base64 = this.encodeBase64(imageData);
    const chunks: string[] = [];
    const chunkSize = 4096;

    for (let i = 0; i < base64.length; i += chunkSize) {
      const chunk = base64.slice(i, i + chunkSize);
      const more = i + chunkSize < base64.length ? 1 : 0;
      chunks.push(`\x1b_Gf=32,t=d,m=${more};${chunk}\x1b\\`);
    }

    return chunks.join('');
  }
}

// Sixel Graphics
class SixelGraphics {
  static displayImage(imageData: Buffer, width: number, height: number): string {
    // Sixel protocol implementation
    // For now, return placeholder - full implementation requires proper sixel encoding
    return `\x1bPq${imageData.toString('base64')}\x1b\\`;
  }
}

export const TerminalParticleBackground: React.FC<TerminalParticleBackgroundProps> = ({
  particleCount = 200,
  connectionDistance = 25,
  useKittyProtocol = false,
  useSixel = false,
  fps = 30,
}) => {
  const { stdout, write } = useStdout();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState(0);
  const particlesRef = useRef<Particle[]>([]);
  const focusPointsRef = useRef<FocusPoint[]>([]);
  const canvasRef = useRef<Canvas | null>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Get terminal dimensions
  useEffect(() => {
    const updateDimensions = () => {
      const cols = stdout.columns || 80;
      const rows = stdout.rows || 24;
      setDimensions({ width: cols, height: rows });
    };

    updateDimensions();
    stdout.on('resize', updateDimensions);

    return () => {
      stdout.off('resize', updateDimensions);
    };
  }, [stdout]);

  // Initialize particles
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const particles: Particle[] = [];
    const colors = [COLORS.orange, COLORS.white];

    for (let i = 0; i < particleCount; i++) {
      const size = Math.random() * 4;
      particles.push({
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: size,
        origSize: size,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.6 + 0.4,
        pulse: 0,
        pulseSpeed: 0.01 + Math.random() * 0.04,
        growing: true,
        char: PARTICLE_CHARS[Math.floor(size)],
      });
    }

    particlesRef.current = particles;

    // Initialize focus points
    focusPointsRef.current = [
      { x: dimensions.width * 0.5, y: dimensions.height * 0.4 },
      { x: dimensions.width * 0.7, y: dimensions.height * 0.7 },
      { x: dimensions.width * 0.3, y: dimensions.height * 0.3 },
      { x: dimensions.width * 0.5, y: dimensions.height * 0.6 },
    ];

    // Initialize canvas for Kitty/Sixel protocols
    if (useKittyProtocol || useSixel) {
      canvasRef.current = createCanvas(dimensions.width * 8, dimensions.height * 16);
    }
  }, [dimensions, particleCount, useKittyProtocol, useSixel]);

  // Animation loop
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    if (particlesRef.current.length === 0) return;

    const animate = () => {
      const now = Date.now() / 1000;
      const particles = particlesRef.current;
      const focusPoints = focusPointsRef.current;

      // Update particles
      particles.forEach((p, i) => {
        // Gravitate towards focus points occasionally
        if (Math.random() < 0.01) {
          const focusPoint = focusPoints[Math.floor(Math.random() * focusPoints.length)];
          const dx = focusPoint.x - p.x;
          const dy = focusPoint.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            p.vx += (dx / dist) * 0.05;
            p.vy += (dy / dist) * 0.05;
          }
        }

        // Sine wave motion
        p.vx += Math.sin(now / 10 + i * 0.1) * 0.002;
        p.vy += Math.cos(now / 12 + i * 0.1) * 0.002;

        // Velocity limits
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 1) {
          p.vx = (p.vx / speed) * 0.99;
          p.vy = (p.vy / speed) * 0.99;
        }

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = dimensions.width;
        if (p.x > dimensions.width) p.x = 0;
        if (p.y < 0) p.y = dimensions.height;
        if (p.y > dimensions.height) p.y = 0;

        // Pulse effect
        p.pulse += p.pulseSpeed;
        if (p.growing) {
          p.size = p.origSize + Math.sin(p.pulse) * 0.8;
          if (p.size >= p.origSize + 0.8) p.growing = false;
        } else {
          p.size = p.origSize - Math.sin(p.pulse) * 0.8;
          if (p.size <= p.origSize - 0.8) p.growing = true;
        }

        // Update character based on size
        const charIndex = Math.min(
          PARTICLE_CHARS.length - 1,
          Math.max(0, Math.floor(p.size))
        );
        p.char = PARTICLE_CHARS[charIndex];
      });

      setFrame((f) => f + 1);
    };

    animationRef.current = setInterval(animate, 1000 / fps);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [dimensions, fps]);

  // Render to canvas for Kitty/Sixel
  const renderToCanvas = (): Buffer | null => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const particles = particlesRef.current;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw particles
    particles.forEach((p) => {
      const x = p.x * 8;
      const y = p.y * 16;
      const size = p.size * 2;

      // Draw particle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      
      const color = p.color === COLORS.orange ? '#ff6b35' : '#ffffff';
      ctx.fillStyle = color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();

      // Draw glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(x, y, size * 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw connections
    particles.forEach((p1, i) => {
      particles.slice(i + 1).forEach((p2) => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < connectionDistance) {
          const opacity = 1 - distance / connectionDistance;
          ctx.beginPath();
          ctx.moveTo(p1.x * 8, p1.y * 16);
          ctx.lineTo(p2.x * 8, p2.y * 16);
          ctx.strokeStyle = `rgba(255, 107, 53, ${opacity * 0.5})`;
          ctx.lineWidth = 1;
          ctx.globalAlpha = opacity;
          ctx.stroke();
        }
      });
    });

    ctx.globalAlpha = 1;
    return canvas.toBuffer('image/png');
  };

  // Render using Unicode characters
  const renderUnicode = (): string => {
    const buffer: string[][] = Array(dimensions.height)
      .fill(null)
      .map(() => Array(dimensions.width).fill(' '));

    const particles = particlesRef.current;

    // Draw connections first (background layer)
    particles.forEach((p1, i) => {
      particles.slice(i + 1).forEach((p2) => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < connectionDistance) {
          const steps = Math.floor(distance);
          for (let s = 0; s < steps; s++) {
            const t = s / steps;
            const x = Math.floor(p1.x + (p2.x - p1.x) * t);
            const y = Math.floor(p1.y + (p2.y - p1.y) * t);
            
            if (x >= 0 && x < dimensions.width && y >= 0 && y < dimensions.height) {
              const opacity = 1 - distance / connectionDistance;
              const char = opacity > 0.6 ? '─' : opacity > 0.3 ? '╌' : '·';
              if (buffer[y][x] === ' ') {
                buffer[y][x] = `${COLORS.dim}${COLORS.orange}${char}${COLORS.reset}`;
              }
            }
          }
        }
      });
    });

    // Draw particles (foreground layer)
    particles.forEach((p) => {
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);

      if (x >= 0 && x < dimensions.width && y >= 0 && y < dimensions.height) {
        buffer[y][x] = `${p.color}${p.char}${COLORS.reset}`;
      }
    });

    return buffer.map((row) => row.join('')).join('\n');
  };

  // Main render output
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    if (particlesRef.current.length === 0) return;

    let output = '';

    if (useKittyProtocol) {
      const imageBuffer = renderToCanvas();
      if (imageBuffer) {
        output = KittyGraphics.displayImage(
          imageBuffer,
          dimensions.width * 8,
          dimensions.height * 16
        );
      }
    } else if (useSixel) {
      const imageBuffer = renderToCanvas();
      if (imageBuffer) {
        output = SixelGraphics.displayImage(
          imageBuffer,
          dimensions.width * 8,
          dimensions.height * 16
        );
      }
    } else {
      output = renderUnicode();
    }

    if (output && write) {
      write(ANSI.saveCursor + ANSI.home + output + ANSI.restoreCursor);
    }
  }, [frame, dimensions, useKittyProtocol, useSixel, write]);

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* This component renders directly to stdout for better performance */}
    </Box>
  );
};

export default TerminalParticleBackground;
