/**
 * Interests Inference Prompt - v13 Section 2.4 Prompt 3
 *
 * Analyzes user data to understand their genuine interests and passions.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.4
 */

import type { InterestsDimension, Interest } from '../types';

/**
 * Generate interests inference prompt
 */
export function interestsPrompt(
  sanitizedData: string,
  currentProfile?: InterestsDimension
): string {
  const currentProfileContext = currentProfile
    ? `
Current interests profile:
- Genuine interests: ${currentProfile.genuineInterests.map((i) => i.topic).join(', ')}
- Hobbies: ${currentProfile.hobbies.join(', ')}
`
    : 'No previous profile exists.';

  return `You are analyzing a user's data to understand their genuine interests and passions.

Given the following data from the past 90 days:
${sanitizedData}

${currentProfileContext}

Identify:
1. What topics does this person engage with repeatedly? (not one-off purchases)
2. What hobbies or activities do they invest time and money in?
3. What content do they consume? (newsletters, browsing patterns)
4. Distinguish between genuine interests vs. obligations/necessities

Return structured JSON:
{
  "genuineInterests": [
    {
      "topic": "...",
      "evidenceType": "purchases" | "content" | "activities" | "emails",
      "engagementDepth": "casual" | "moderate" | "deep",
      "evidence": "<source_reference>"
    }
  ],
  "hobbies": ["..."],
  "learningInterests": ["..."],
  "confidence": 0.0-1.0
}

Important:
- Exclude work obligations and necessities
- Look for recurring patterns, not one-time occurrences
- Be conservative - only include interests with clear evidence`;
}

/**
 * Parse LLM response to InterestsDimension
 */
export function parseInterestsResponse(content: string): InterestsDimension {
  try {
    const parsed = JSON.parse(content);

    return {
      genuineInterests: parseInterests(parsed.genuineInterests ?? []),
      hobbies: parseStringArray(parsed.hobbies),
      learningInterests: parseStringArray(parsed.learningInterests),
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    };
  } catch {
    return {
      genuineInterests: [],
      hobbies: [],
      learningInterests: [],
      confidence: 0,
    };
  }
}

/**
 * Parse interests from LLM response
 */
function parseInterests(interests: unknown[]): Interest[] {
  return interests
    .filter(
      (i): i is Record<string, unknown> => typeof i === 'object' && i !== null
    )
    .map((i) => ({
      topic: String(i.topic ?? ''),
      evidenceType: validateEvidenceType(i.evidenceType),
      engagementDepth: validateEngagementDepth(i.engagementDepth),
      evidence: String(i.evidence ?? ''),
    }));
}

/**
 * Validate evidence type
 */
function validateEvidenceType(
  type: unknown
): 'purchases' | 'content' | 'activities' | 'emails' {
  const validTypes = ['purchases', 'content', 'activities', 'emails'];
  if (typeof type === 'string' && validTypes.includes(type)) {
    return type as 'purchases' | 'content' | 'activities' | 'emails';
  }
  return 'emails';
}

/**
 * Validate engagement depth
 */
function validateEngagementDepth(
  depth: unknown
): 'casual' | 'moderate' | 'deep' {
  const validDepths = ['casual', 'moderate', 'deep'];
  if (typeof depth === 'string' && validDepths.includes(depth)) {
    return depth as 'casual' | 'moderate' | 'deep';
  }
  return 'casual';
}

/**
 * Parse string array from LLM response
 */
function parseStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr.filter((item): item is string => typeof item === 'string');
}
