/**
 * Content Agent Types - v13 Section 3.6.1
 *
 * Types for content recommendation agent.
 */

import type { AgentPermissions } from '@ownyou/shared-types';
import { NAMESPACES } from '@ownyou/shared-types';

/**
 * Content trigger data
 */
export interface ContentTriggerData {
  /** Trigger type */
  type: 'scheduled' | 'interest_detected';
  /** Detected interests (if interest_detected) */
  interests?: string[];
  /** Schedule time (if scheduled) */
  scheduledAt?: number;
}

/**
 * Content item from recommendation tool
 */
export interface ContentItem {
  /** Content title */
  title: string;
  /** Content URL */
  url: string;
  /** Source name (e.g., TechCrunch, Medium) */
  source: string;
  /** Content type */
  type: 'article' | 'podcast' | 'video';
  /** Brief summary */
  summary?: string;
  /** Relevance score 0-1 */
  relevanceScore: number;
}

/**
 * Parameters for recommend_content tool
 */
export interface RecommendContentParams {
  /** User interests to match */
  interests: string[];
  /** Learned rules to apply */
  rules?: ContentRule[];
  /** Maximum items to return */
  limit?: number;
}

/**
 * Parameters for summarize_article tool
 */
export interface SummarizeArticleParams {
  /** Article URL to summarize */
  url: string;
  /** Maximum summary length */
  maxLength?: number;
}

/**
 * Content rule from procedural synthesis
 */
export interface ContentRule {
  /** Rule ID */
  id: string;
  /** The rule text */
  rule: string;
  /** Confidence score */
  confidence: number;
}

/**
 * Content Agent permissions - v13 Section 3.6.1
 */
export const CONTENT_PERMISSIONS: AgentPermissions = {
  agentType: 'content',
  memoryAccess: {
    read: [
      NAMESPACES.SEMANTIC_MEMORY,
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.IAB_CLASSIFICATIONS,
      NAMESPACES.IKIGAI_PROFILE,
    ],
    write: [
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.MISSION_CARDS,
    ],
    search: [
      NAMESPACES.SEMANTIC_MEMORY,
    ],
  },
  externalApis: [],
  toolDefinitions: [
    {
      name: 'recommend_content',
      description: 'Find relevant content based on user interests',
      parameters: {
        type: 'object',
        properties: {
          interests: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number' },
        },
        required: ['interests'],
      },
    },
    {
      name: 'summarize_article',
      description: 'Summarize article content from a URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          maxLength: { type: 'number' },
        },
        required: ['url'],
      },
    },
  ],
};

/**
 * IAB categories that indicate content interests
 */
export const CONTENT_INTEREST_CATEGORIES = {
  NEWS: 'News and Politics',
  TECHNOLOGY: 'Technology & Computing',
  SCIENCE: 'Science',
  HEALTH: 'Health & Fitness',
  BUSINESS: 'Business and Finance',
  EDUCATION: 'Education',
  ENTERTAINMENT: 'Arts & Entertainment',
  SPORTS: 'Sports',
} as const;

/**
 * Minimum confidence for content recommendations
 */
export const CONTENT_CONFIDENCE_THRESHOLD = 0.6;
