/**
 * Content Helpers
 * Utilities for working with Message content (string or ContentBlock[])
 */
import { ContentBlock } from '../models/unified-model-manager.js';

/**
 * Convert content (string or ContentBlock[]) to plain text
 * For models that don't support multipart content
 */
export function contentToText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((block) => {
      if (block.type === 'text') {
        return block.text;
      }
      if (block.type === 'image') {
        return `[Image: ${block.source.media_type}, ${Math.round(block.source.data.length * 0.75 / 1024)}KB]`;
      }
      if (block.type === 'file') {
        return `[File: ${block.name}]\n${block.content}`;
      }
      return '';
    })
    .join('\n');
}

/**
 * Check if content contains images
 */
export function hasImages(content: string | ContentBlock[]): boolean {
  if (typeof content === 'string') {
    return false;
  }

  return content.some((block) => block.type === 'image');
}

/**
 * Extract text blocks only
 */
export function getTextBlocks(content: string | ContentBlock[]): string[] {
  if (typeof content === 'string') {
    return [content];
  }

  return content
    .filter((block) => block.type === 'text')
    .map((block) => (block as any).text);
}

/**
 * Extract image blocks only
 */
export function getImageBlocks(content: string | ContentBlock[]): ContentBlock[] {
  if (typeof content === 'string') {
    return [];
  }

  return content.filter((block) => block.type === 'image');
}

/**
 * Get content summary (for logging/debugging)
 */
export function contentSummary(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return `Text (${content.length} chars)`;
  }

  const textCount = content.filter((b) => b.type === 'text').length;
  const imageCount = content.filter((b) => b.type === 'image').length;
  const fileCount = content.filter((b) => b.type === 'file').length;

  const parts: string[] = [];
  if (textCount > 0) parts.push(`${textCount} text`);
  if (imageCount > 0) parts.push(`${imageCount} image(s)`);
  if (fileCount > 0) parts.push(`${fileCount} file(s)`);

  return parts.join(', ');
}

/**
 * Convert our ContentBlock format to Anthropic SDK format
 * FIXED: Returns string for single text blocks, array for multi-part content (like the working multi-chat!) 🔥
 */
export function toAnthropicContent(content: string | ContentBlock[]): any {
  if (typeof content === 'string') {
    return content;
  }

  // If it's a single text block, return just the string (not array) - THIS IS THE FIX!
  if (content.length === 1 && content[0].type === 'text') {
    return content[0].text;
  }

  // Multiple blocks or non-text blocks - return array
  return content.map((block) => {
    if (block.type === 'text') {
      return {
        type: 'text',
        text: block.text,
      };
    }
    if (block.type === 'image') {
      // Ensure media_type is one of the allowed values
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
      if (block.source.media_type === 'image/jpeg' ||
          block.source.media_type === 'image/jpg') {
        mediaType = 'image/jpeg';
      } else if (block.source.media_type === 'image/gif') {
        mediaType = 'image/gif';
      } else if (block.source.media_type === 'image/webp') {
        mediaType = 'image/webp';
      }

      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: block.source.data,
        },
      };
    }
    if (block.type === 'file') {
      // Convert file to text block
      return {
        type: 'text',
        text: `[File: ${block.name}]\n${block.content}`,
      };
    }
    return {
      type: 'text',
      text: JSON.stringify(block),
    };
  });
}
