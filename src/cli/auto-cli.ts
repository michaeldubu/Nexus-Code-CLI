#!/usr/bin/env node
/**
 * Auto-Detecting CLI Launcher
 * Detects TTY support and launches appropriate UI
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Check if we're in a real terminal
 */
function hasTTY(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Check if raw mode is supported
 */
function supportsRawMode(): boolean {
  try {
    if (!process.stdin.isTTY) return false;
    // Try to set raw mode temporarily
    const stdin = process.stdin as any;
    if (typeof stdin.setRawMode !== 'function') return false;
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(chalk.green('🚀 Detecting terminal capabilities...\n'));

  const tty = hasTTY();
  const rawMode = supportsRawMode();

  if (tty && rawMode) {
    console.log(chalk.green('✅ Full TTY detected - Launching Ink TUI'));
    console.log(chalk.gray('   (Interactive UI with arrow keys and dialogs)\n'));

    // Launch Ink TUI
    const tuiPath = join(__dirname, 'simple-ink-cli.js');
    const child = spawn('node', [tuiPath], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  } else {
    console.log(chalk.yellow('⚠️  Limited TTY - Launching readline CLI'));
    console.log(chalk.gray('   (Standard CLI with keyboard shortcuts)\n'));

    // Launch readline CLI
    const cliPath = join(__dirname, 'conversational-cli.js');
    const child = spawn('node', [cliPath], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
}

main().catch((error) => {
  console.error(chalk.red('❌ Launch error:'), error.message);
  process.exit(1);
});
