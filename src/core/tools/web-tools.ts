/**
 * Web Tools - WebSearch and WebFetch
 */

import https from 'https';
import http from 'http';
import chalk from 'chalk';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Log tool usage
 */
function logToolCall(toolName: string, params: Record<string, any>): void {
  const paramStr = Object.entries(params)
    .map(([key, value]) => {
      if (typeof value === 'string' && value.length > 60) {
        return `${key}: "${value.substring(0, 57)}..."`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(', ');

  console.log(chalk.green(`● ${toolName}(${paramStr})`));
}

export class WebTools {
  private verboseMode: boolean = true;

  /**
   * Enable/disable verbose mode
   */
  setVerbose(enabled: boolean): void {
    this.verboseMode = enabled;
  }

  /**
   * Fetch content from a URL
   */
  async webFetch(url: string, prompt: string): Promise<ToolResult> {
    if (this.verboseMode) {
      logToolCall('WebFetch', { url, prompt });
    }

    try {
      // Validate URL
      const parsedUrl = new URL(url);

      // Upgrade HTTP to HTTPS
      if (parsedUrl.protocol === 'http:') {
        parsedUrl.protocol = 'https:';
      }

      // Fetch the content
      const content = await this.fetchUrl(parsedUrl.href);

      // For now, return the raw content with the prompt context
      // In a real implementation, this would process with an LLM
      return {
        success: true,
        output: `Fetched content from ${parsedUrl.href}:\n\nPrompt: ${prompt}\n\nContent (${content.length} chars):\n${content.substring(0, 5000)}${content.length > 5000 ? '\n...(truncated)' : ''}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `WebFetch failed: ${error.message}`,
      };
    }
  }

  /**
   * Search the web
   */
  async webSearch(query: string, options?: {
    allowedDomains?: string[];
    blockedDomains?: string[];
  }): Promise<ToolResult> {
    if (this.verboseMode) {
      logToolCall('WebSearch', { query, ...options });
    }

    try {
      // Note: This is a placeholder implementation
      // Real implementation would use a search API (Google, Bing, DuckDuckGo, etc.)
      // For now, we'll return a message indicating the feature needs API keys

      const searchEngine = process.env.SEARCH_ENGINE || 'duckduckgo';
      const apiKey = process.env.SEARCH_API_KEY;

      if (!apiKey) {
        return {
          success: false,
          error: `WebSearch requires ${searchEngine.toUpperCase()}_API_KEY environment variable. Please set it to enable web search.`,
        };
      }

      // Placeholder for actual search implementation
      // You would integrate with your preferred search API here
      return {
        success: true,
        output: `Search results for: "${query}"\n\n[Search API integration pending - requires API key configuration]`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `WebSearch failed: ${error.message}`,
      };
    }
  }

  /**
   * Helper: Fetch URL content
   */
  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const request = client.get(url, {
        headers: {
          'User-Agent': 'NEXUS-CLI/1.0',
        },
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.fetchUrl(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve(data);
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Helper: Convert HTML to markdown (basic implementation)
   */
  private htmlToMarkdown(html: string): string {
    // Very basic HTML to markdown conversion
    // For production, use a proper library like turndown
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
