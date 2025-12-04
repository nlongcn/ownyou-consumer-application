/**
 * Summarize Article Tool - v13 Section 3.6.1
 *
 * Mock article summarization tool for Sprint 4.
 * In future sprints, this will use LLM to summarize real content.
 */

import type { AgentTool } from '@ownyou/agents-base';
import type { SummarizeArticleParams } from '../types';

/**
 * Article summary result
 */
export interface ArticleSummary {
  /** Original URL */
  url: string;
  /** Article title */
  title: string;
  /** Summary text */
  summary: string;
  /** Key points extracted */
  keyPoints: string[];
  /** Estimated read time in minutes */
  readTimeMinutes: number;
}

/**
 * Mock summaries for known URLs
 */
const MOCK_SUMMARIES: Record<string, ArticleSummary> = {
  'https://example.com/ai-future': {
    url: 'https://example.com/ai-future',
    title: 'The Future of AI in Everyday Life',
    summary:
      'This article explores how AI is becoming embedded in daily activities, from smart home devices to personalized health recommendations. The author argues that within the next decade, AI assistants will be as common as smartphones are today.',
    keyPoints: [
      'AI assistants are moving beyond voice commands',
      'Healthcare applications show most promise',
      'Privacy remains the biggest challenge',
    ],
    readTimeMinutes: 8,
  },
  'https://example.com/sleep': {
    url: 'https://example.com/sleep',
    title: 'The Science of Better Sleep',
    summary:
      'Dr. Huberman breaks down the neuroscience of sleep, explaining how light exposure, temperature, and timing affect sleep quality. Practical protocols are provided for optimizing each factor.',
    keyPoints: [
      'Morning sunlight exposure is crucial',
      'Room temperature should be 65-68F',
      'Avoid caffeine after 2pm',
    ],
    readTimeMinutes: 45,
  },
};

/**
 * Summarize an article from its URL
 *
 * @param params - Summarization parameters
 * @returns Article summary
 */
export async function summarizeArticle(
  params: SummarizeArticleParams
): Promise<ArticleSummary> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 150));

  const { url, maxLength = 200 } = params;

  // Check for mock summary
  if (MOCK_SUMMARIES[url]) {
    const summary = MOCK_SUMMARIES[url];

    // Truncate summary if needed
    if (summary.summary.length > maxLength) {
      return {
        ...summary,
        summary: summary.summary.slice(0, maxLength - 3) + '...',
      };
    }

    return summary;
  }

  // Default summary for unknown URLs
  return {
    url,
    title: 'Article',
    summary:
      'This content could not be summarized. The article may be behind a paywall or unavailable.',
    keyPoints: [],
    readTimeMinutes: 5,
  };
}

/**
 * Create the summarize_article tool
 */
export function createSummarizeArticleTool(): AgentTool<
  SummarizeArticleParams,
  ArticleSummary
> {
  return {
    name: 'summarize_article',
    description: 'Summarize article content from a URL',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Article URL to summarize',
        },
        maxLength: {
          type: 'number',
          description: 'Maximum summary length',
        },
      },
      required: ['url'],
    },
    execute: summarizeArticle,
  };
}
