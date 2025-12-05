/**
 * Giving Inference Prompt - v13 Section 2.4 Prompt 4
 *
 * Analyzes user data to understand how they contribute to others.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.4
 */

import type {
  GivingDimension,
  CharitableActivity,
  GiftGivingPattern,
} from '../types';

/**
 * Generate giving inference prompt
 */
export function givingPrompt(
  sanitizedData: string,
  currentProfile?: GivingDimension
): string {
  const currentProfileContext = currentProfile
    ? `
Current giving profile:
- Charitable causes: ${currentProfile.charitableGiving.map((c) => c.cause).join(', ')}
- Gift giving frequency: ${currentProfile.giftGiving.frequency}
`
    : 'No previous profile exists.';

  return `You are analyzing a user's data to understand how they contribute to others.

Given the following data from the past 90 days:
${sanitizedData}

${currentProfileContext}

Identify:
1. Does this person give to charitable causes? Which ones?
2. Do they buy gifts for others? For whom and how often?
3. Any evidence of volunteering or community involvement?
4. How do they show care for others through their actions?

Return structured JSON:
{
  "charitableGiving": [
    {
      "cause": "...",
      "frequency": "one-time" | "monthly" | "annual",
      "evidence": "<source_reference>"
    }
  ],
  "giftGiving": {
    "frequency": "rare" | "occasional" | "frequent",
    "recipients": ["..."]
  },
  "volunteering": ["..."],
  "carePatterns": "...",
  "confidence": 0.0-1.0
}

Important:
- Be specific about charitable causes
- Distinguish gifts from regular purchases
- Look for patterns of care and generosity`;
}

/**
 * Parse LLM response to GivingDimension
 */
export function parseGivingResponse(content: string): GivingDimension {
  try {
    const parsed = JSON.parse(content);

    return {
      charitableGiving: parseCharitableActivities(parsed.charitableGiving ?? []),
      giftGiving: parseGiftGiving(parsed.giftGiving),
      volunteering: parseStringArray(parsed.volunteering),
      carePatterns: String(parsed.carePatterns ?? ''),
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    };
  } catch {
    return {
      charitableGiving: [],
      giftGiving: { frequency: 'occasional', recipients: [] },
      volunteering: [],
      carePatterns: '',
      confidence: 0,
    };
  }
}

/**
 * Parse charitable activities from LLM response
 */
function parseCharitableActivities(activities: unknown[]): CharitableActivity[] {
  return activities
    .filter(
      (a): a is Record<string, unknown> => typeof a === 'object' && a !== null
    )
    .map((a) => ({
      cause: String(a.cause ?? ''),
      frequency: validateCharitableFrequency(a.frequency),
      evidence: String(a.evidence ?? ''),
    }));
}

/**
 * Parse gift giving pattern from LLM response
 */
function parseGiftGiving(giftGiving: unknown): GiftGivingPattern {
  if (typeof giftGiving !== 'object' || giftGiving === null) {
    return { frequency: 'occasional', recipients: [] };
  }

  const gg = giftGiving as Record<string, unknown>;

  return {
    frequency: validateGiftFrequency(gg.frequency),
    recipients: parseStringArray(gg.recipients),
  };
}

/**
 * Validate charitable frequency
 */
function validateCharitableFrequency(
  frequency: unknown
): string {
  // Note: The spec shows 'one-time' | 'monthly' | 'annual' but type says string
  // Keeping it flexible as the type allows any string
  if (typeof frequency === 'string') {
    return frequency;
  }
  return 'one-time';
}

/**
 * Validate gift giving frequency
 */
function validateGiftFrequency(
  frequency: unknown
): 'rare' | 'occasional' | 'frequent' {
  const validFrequencies = ['rare', 'occasional', 'frequent'];
  if (typeof frequency === 'string' && validFrequencies.includes(frequency)) {
    return frequency as 'rare' | 'occasional' | 'frequent';
  }
  return 'occasional';
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
