/**
 * Computer Use Tool - Beta Feature
 * Allows Claude to interact with desktop environments through GUI automation
 * Requires anthropic-beta: computer-use-2025-01-24
 *
 * SAFETY: Real execution requires NEXUS_ALLOW_COMPUTER_USE=true environment variable
 */

import { MCPTool } from '../types/index.js';

// Type declarations for optional dependencies
type RobotJS = {
  default: {
    moveMouse: (x: number, y: number) => void;
    mouseClick: (button?: string, doubleClick?: boolean) => void;
    mouseToggle: (down?: string, button?: string) => void;
    typeString: (text: string) => void;
    keyTap: (key: string, modifiers?: string | string[]) => void;
    keyToggle: (key: string, down: string, modifiers?: string | string[]) => void;
    scrollMouse: (x: number, y: number) => void;
  };
};

type ScreenshotDesktop = {
  default: (options?: any) => Promise<Buffer>;
};

// Lazy imports for optional dependencies (only loaded if enabled)
let robot: RobotJS | null = null;
let screenshot: ScreenshotDesktop | null = null;

/**
 * Check if real computer use is enabled via environment variable
 */
export function isRealComputerUseEnabled(): boolean {
  return process.env.NEXUS_ALLOW_COMPUTER_USE === 'true';
}

/**
 * Initialize computer use libraries (lazy load)
 */
async function initializeComputerUse(): Promise<boolean> {
  if (!isRealComputerUseEnabled()) {
    return false;
  }

  try {
    if (!robot) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const robotModule = await Function('return import("robotjs")')().catch(() => null);
      robot = robotModule as RobotJS;
    }
    if (!screenshot) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const screenshotModule = await Function('return import("screenshot-desktop")')().catch(() => null);
      screenshot = screenshotModule as ScreenshotDesktop;
    }
    return !!robot && !!screenshot;
  } catch (error) {
    console.warn('⚠️ Computer use libraries not available. Install robotjs and screenshot-desktop for real execution.');
    console.warn('   Run: npm install robotjs screenshot-desktop');
    return false;
  }
}

export interface ComputerToolConfig {
  displayWidthPx: number;
  displayHeightPx: number;
  displayNumber?: number;
}

/**
 * Create Computer Use tool definition
 * This enables Claude to control desktop environments
 */
export function createComputerTool(config: ComputerToolConfig): MCPTool {
  return {
    name: 'computer',
    description: 'Interact with the desktop environment through GUI automation. Supports screenshot, click, type, scroll, key, hold_key, left_mouse_down, left_mouse_up, triple_click, and wait actions.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'screenshot',
            'click',
            'type',
            'scroll',
            'key',
            'hold_key',
            'left_mouse_down',
            'left_mouse_up',
            'triple_click',
            'wait',
          ],
          description: 'The action to perform',
        },
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: 'X, Y coordinates for mouse actions (required for click, scroll, left_mouse_down, left_mouse_up, triple_click)',
        },
        text: {
          type: 'string',
          description: 'Text to type (required for type action)',
        },
        key: {
          type: 'string',
          description: 'Key to press or hold (required for key and hold_key actions). Examples: "Enter", "Escape", "Ctrl+C", "Alt+Tab"',
        },
        scroll_direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Direction to scroll (optional for scroll action, defaults to down)',
        },
        duration: {
          type: 'number',
          description: 'Duration in seconds for hold_key and wait actions (default: 1.0)',
        },
      },
      required: ['action'],
    },
  };
}

/**
 * Computer Use Tool Definition with display configuration
 * This is the specialized tool format for Anthropic's Computer Use beta
 */
export interface ComputerToolDefinition {
  name: 'computer';
  type: 'computer_20250124';
  display_width_px: number;
  display_height_px: number;
  display_number?: number;
}

/**
 * Create the Anthropic-specific Computer Use tool definition
 */
export function createAnthropicComputerTool(config: ComputerToolConfig): ComputerToolDefinition {
  return {
    name: 'computer',
    type: 'computer_20250124',
    display_width_px: config.displayWidthPx,
    display_height_px: config.displayHeightPx,
    display_number: config.displayNumber,
  };
}

/**
 * Computer Action Types
 */
export interface ComputerAction {
  action: 'screenshot' | 'click' | 'type' | 'scroll' | 'key' | 'hold_key' |
          'left_mouse_down' | 'left_mouse_up' | 'triple_click' | 'wait';
  coordinate?: [number, number];
  text?: string;
  key?: string;
  scroll_direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
}

/**
 * Computer Action Result
 */
export interface ComputerActionResult {
  success: boolean;
  action: string;
  details: Record<string, any>;
  screenshot?: string; // Base64 encoded screenshot
  error?: string;
  timestamp: number;
}

/**
 * Execute a computer action
 * Supports both real and mock execution based on NEXUS_ALLOW_COMPUTER_USE environment variable
 */
export async function executeComputerAction(
  action: ComputerAction,
  config: ComputerToolConfig
): Promise<ComputerActionResult> {
  const timestamp = Date.now();
  const realExecution = await initializeComputerUse();

  if (!realExecution) {
    // No mock responses - either real execution or fail
    throw new Error(
      '🖥️  Computer Use not available!\n\n' +
      'To enable real execution:\n' +
      '1. Install dependencies: npm install robotjs screenshot-desktop\n' +
      '2. Set environment variable: export NEXUS_ALLOW_COMPUTER_USE=true\n' +
      '3. Restart NEXUS'
    );
  }

  console.log(`🤖 Real Computer Action: ${action.action}`, action);

  switch (action.action) {
    case 'screenshot':
      if (!screenshot) {
        throw new Error('screenshot-desktop library not available');
      }
      try {
        const img = await screenshot.default();
        const base64 = img.toString('base64');
        return {
          success: true,
          action: 'screenshot',
          details: {
            resolution: `${config.displayWidthPx}x${config.displayHeightPx}`,
            format: 'PNG',
          },
          screenshot: base64,
          timestamp,
        };
      } catch (error) {
        return {
          success: false,
          action: 'screenshot',
          details: {},
          error: `Screenshot failed: ${error}`,
          timestamp,
        };
      }

    case 'click':
      if (!action.coordinate) {
        throw new Error('Click action requires coordinate');
      }

      const [x, y] = action.coordinate;

      // Validate coordinates
      if (x < 0 || x > config.displayWidthPx || y < 0 || y > config.displayHeightPx) {
        throw new Error(`Coordinates (${x}, ${y}) are outside screen bounds`);
      }

      if (!robot) {
        throw new Error('robotjs library not available');
      }

      try {
        robot.default.moveMouse(x, y);
        robot.default.mouseClick();
        return {
          success: true,
          action: 'click',
          details: {
            coordinate: action.coordinate,
            screenBounds: `${config.displayWidthPx}x${config.displayHeightPx}`,
          },
          timestamp,
        };
      } catch (error) {
        return {
          success: false,
          action: 'click',
          details: { coordinate: action.coordinate },
          error: `Click failed: ${error}`,
          timestamp,
        };
      }

    case 'type':
      if (!action.text) {
        throw new Error('Type action requires text');
      }

      if (!robot) {
        throw new Error('robotjs library not available');
      }

      try {
        robot.default.typeString(action.text);
        // Add small delay for realistic typing
        await new Promise(resolve => setTimeout(resolve, action.text.length * 20));
        return {
          success: true,
          action: 'type',
          details: {
            text: action.text,
            characterCount: action.text.length,
          },
          timestamp,
        };
      } catch (error) {
        return {
          success: false,
          action: 'type',
          details: { text: action.text },
          error: `Type failed: ${error}`,
          timestamp,
        };
      }

    case 'scroll':
    case 'key':
    case 'hold_key':
    case 'left_mouse_down':
    case 'left_mouse_up':
    case 'triple_click':
    case 'wait':
      throw new Error(`Computer action '${action.action}' not yet implemented. Currently supported: screenshot, click, type`);

    default:
      throw new Error(`Unknown computer action: ${action.action}`);
  }
}
