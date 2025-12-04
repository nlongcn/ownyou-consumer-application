/**
 * @ownyou/agents-content - Content recommendation agent
 *
 * L1 agent that recommends articles, podcasts, and videos based on user interests.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 3.6.1
 */

export { ContentAgent } from './agent';
export {
  CONTENT_PERMISSIONS,
  CONTENT_INTEREST_CATEGORIES,
  CONTENT_CONFIDENCE_THRESHOLD,
  type ContentTriggerData,
  type ContentItem,
  type ContentRule,
  type RecommendContentParams,
  type SummarizeArticleParams,
} from './types';
export {
  recommendContent,
  createRecommendContentTool,
  summarizeArticle,
  createSummarizeArticleTool,
  type ArticleSummary,
} from './tools';
