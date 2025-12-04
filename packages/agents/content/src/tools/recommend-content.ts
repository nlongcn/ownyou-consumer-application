/**
 * Recommend Content Tool - v13 Section 3.6.1
 *
 * Mock content recommendation tool for Sprint 4.
 * In future sprints, this will integrate with real RSS/News APIs.
 */

import type { AgentTool } from '@ownyou/agents-base';
import type { RecommendContentParams, ContentItem } from '../types';

/**
 * Mock content based on interest categories
 */
const MOCK_CONTENT: Record<string, ContentItem[]> = {
  technology: [
    {
      title: 'The Future of AI in Everyday Life',
      url: 'https://example.com/ai-future',
      source: 'TechCrunch',
      type: 'article',
      summary: 'How artificial intelligence is transforming daily routines',
      relevanceScore: 0.9,
    },
    {
      title: 'Understanding Web3 Fundamentals',
      url: 'https://example.com/web3',
      source: 'The Verge',
      type: 'article',
      summary: "A beginner's guide to decentralized technologies",
      relevanceScore: 0.85,
    },
    {
      title: 'Inside Apple Vision Pro Development',
      url: 'https://example.com/apple-vision',
      source: 'Wired',
      type: 'article',
      summary: 'The engineering challenges behind spatial computing',
      relevanceScore: 0.82,
    },
  ],
  travel: [
    {
      title: 'Hidden Gems of Southeast Asia',
      url: 'https://example.com/asia-travel',
      source: 'Lonely Planet',
      type: 'article',
      summary: 'Off-the-beaten-path destinations worth exploring',
      relevanceScore: 0.88,
    },
    {
      title: 'Sustainable Travel in 2025',
      url: 'https://example.com/sustainable-travel',
      source: 'Travel + Leisure',
      type: 'article',
      summary: 'How to minimize your carbon footprint while traveling',
      relevanceScore: 0.84,
    },
  ],
  health: [
    {
      title: 'The Science of Better Sleep',
      url: 'https://example.com/sleep',
      source: 'Huberman Lab',
      type: 'podcast',
      summary: 'Evidence-based strategies for improving sleep quality',
      relevanceScore: 0.92,
    },
    {
      title: 'Zone 2 Training Explained',
      url: 'https://example.com/zone2',
      source: 'Peter Attia',
      type: 'podcast',
      summary: 'The metabolic benefits of low-intensity exercise',
      relevanceScore: 0.87,
    },
  ],
  science: [
    {
      title: 'Quantum Computing Breakthroughs',
      url: 'https://example.com/quantum',
      source: 'Nature',
      type: 'article',
      summary: 'Recent advances in quantum error correction',
      relevanceScore: 0.89,
    },
    {
      title: 'CRISPR Gene Editing Updates',
      url: 'https://example.com/crispr',
      source: 'Science Daily',
      type: 'article',
      summary: 'New applications of gene editing technology',
      relevanceScore: 0.86,
    },
  ],
  business: [
    {
      title: 'The Remote Work Revolution',
      url: 'https://example.com/remote-work',
      source: 'Harvard Business Review',
      type: 'article',
      summary: 'How companies are adapting to distributed teams',
      relevanceScore: 0.85,
    },
    {
      title: 'Startup Funding Trends',
      url: 'https://example.com/funding',
      source: 'TechCrunch',
      type: 'article',
      summary: 'Analysis of VC investment patterns in 2025',
      relevanceScore: 0.83,
    },
  ],
  default: [
    {
      title: 'This Week in Interesting Reads',
      url: 'https://example.com/weekly',
      source: 'Medium',
      type: 'article',
      summary: 'A curated collection of thought-provoking articles',
      relevanceScore: 0.7,
    },
  ],
};

/**
 * Recommend content based on user interests
 *
 * @param params - Recommendation parameters
 * @returns Matching content items
 */
export async function recommendContent(
  params: RecommendContentParams
): Promise<ContentItem[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const { interests, limit = 5 } = params;
  const results: ContentItem[] = [];
  const seen = new Set<string>();

  // Collect content matching interests
  for (const interest of interests) {
    const lowerInterest = interest.toLowerCase();

    for (const [key, items] of Object.entries(MOCK_CONTENT)) {
      if (
        lowerInterest.includes(key) ||
        key.includes(lowerInterest) ||
        key === 'default'
      ) {
        for (const item of items) {
          if (!seen.has(item.url)) {
            seen.add(item.url);
            results.push(item);
          }
        }
      }
    }
  }

  // Add default content if nothing matched
  if (results.length === 0) {
    results.push(...MOCK_CONTENT.default);
  }

  // Sort by relevance and limit
  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/**
 * Create the recommend_content tool
 */
export function createRecommendContentTool(): AgentTool<
  RecommendContentParams,
  ContentItem[]
> {
  return {
    name: 'recommend_content',
    description: 'Find relevant content based on user interests',
    parameters: {
      type: 'object',
      properties: {
        interests: {
          type: 'array',
          items: { type: 'string' },
          description: 'User interests to match',
        },
        limit: {
          type: 'number',
          description: 'Maximum items to return',
        },
      },
      required: ['interests'],
    },
    execute: recommendContent,
  };
}
