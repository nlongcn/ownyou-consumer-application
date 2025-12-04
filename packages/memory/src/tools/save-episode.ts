/**
 * Save Episode Tool - v13 Section 8.8.1
 *
 * Records a complete interaction for few-shot learning.
 * Episodes are the raw material for procedural rule synthesis.
 */

import type { Episode, AgentType } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import type { SaveEpisodeParams, SaveEpisodeContext, SaveEpisodeResult } from '../types';

/**
 * Save a new episode
 */
export async function saveEpisode(
  params: SaveEpisodeParams,
  context: SaveEpisodeContext
): Promise<SaveEpisodeResult> {
  const { situation, reasoning, action, outcome, userFeedback } = params;
  const { userId, agentType, missionId, store } = context;

  // Extract searchable tags
  const tags = extractTags({
    situation,
    action,
    outcome,
    agentType,
  });

  const episode: Episode = {
    id: crypto.randomUUID(),
    situation,
    reasoning,
    action,
    outcome,
    userFeedback,
    agentType,
    missionId,
    timestamp: Date.now(),
    tags,
  };

  await store.put(NS.episodicMemory(userId), episode.id, episode);

  return { episodeId: episode.id };
}

/**
 * Update episode with feedback - called when user rates mission
 */
export async function updateEpisodeWithFeedback(
  episodeId: string,
  feedback: 'love' | 'like' | 'meh',
  userId: string,
  store: MemoryStore
): Promise<void> {
  const episode = await store.get<Episode>(NS.episodicMemory(userId), episodeId);

  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`);
  }

  const updatedEpisode: Episode = {
    ...episode,
    userFeedback: feedback,
    outcome: feedback === 'meh' ? 'failure' : 'success',
  };

  await store.put(NS.episodicMemory(userId), episodeId, updatedEpisode);
}

/**
 * Get episodes by agent type
 */
export async function getEpisodesByAgent(
  userId: string,
  agentType: AgentType,
  store: MemoryStore,
  limit: number = 50
): Promise<Episode[]> {
  const allEpisodes = await store.list<Episode>(NS.episodicMemory(userId), { limit: limit * 2 });

  return allEpisodes.items
    .filter((e) => e.agentType === agentType)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get recent episodes with negative feedback (for Reflection triggers)
 */
export async function getRecentNegativeEpisodes(
  userId: string,
  store: MemoryStore,
  withinHours: number = 24
): Promise<Episode[]> {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;

  const allEpisodes = await store.list<Episode>(NS.episodicMemory(userId));

  return allEpisodes.items.filter(
    (e) => e.timestamp > cutoff && (e.userFeedback === 'meh' || e.outcome === 'failure')
  );
}

/**
 * Count episodes since last reflection
 */
export async function countEpisodesSinceReflection(
  userId: string,
  store: MemoryStore,
  lastReflectionTime: number
): Promise<number> {
  const allEpisodes = await store.list<Episode>(NS.episodicMemory(userId));

  return allEpisodes.items.filter((e) => e.timestamp > lastReflectionTime).length;
}

/**
 * Extract searchable tags from episode content
 */
function extractTags(params: {
  situation: string;
  action: string;
  outcome: string;
  agentType: AgentType;
}): string[] {
  const { situation, action, outcome, agentType } = params;
  const tags: string[] = [agentType];

  // Add outcome-based tags
  if (outcome === 'success') {
    tags.push('positive_outcome');
  } else if (outcome === 'failure') {
    tags.push('negative_outcome');
  } else if (outcome === 'partial') {
    tags.push('partial_outcome');
  }

  // Extract keywords from situation and action
  const keywords = extractKeywords(`${situation} ${action}`);
  tags.push(...keywords.slice(0, 5)); // Limit to 5 keywords

  return [...new Set(tags)]; // Dedupe
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'dare',
    'ought',
    'used',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'and',
    'but',
    'or',
    'nor',
    'so',
    'yet',
    'both',
    'either',
    'neither',
    'not',
    'only',
    'own',
    'same',
    'than',
    'too',
    'very',
    'just',
    'i',
    'me',
    'my',
    'myself',
    'we',
    'our',
    'ours',
    'ourselves',
    'you',
    'your',
    'yours',
    'yourself',
    'yourselves',
    'he',
    'him',
    'his',
    'himself',
    'she',
    'her',
    'hers',
    'herself',
    'it',
    'its',
    'itself',
    'they',
    'them',
    'their',
    'theirs',
    'themselves',
    'what',
    'which',
    'who',
    'whom',
    'this',
    'that',
    'these',
    'those',
    'user',
    'wants',
    'looking',
    'find',
    'get',
    'want',
  ]);

  // Extract words, filter stop words and short words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  // Sort by frequency and return top keywords
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}
