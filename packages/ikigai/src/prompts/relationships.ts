/**
 * Relationships Inference Prompt - v13 Section 2.4 Prompt 2
 *
 * Analyzes user data to understand their important relationships.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.4
 */

import type { RelationshipsDimension, Person } from '../types';

/**
 * Generate relationships inference prompt
 */
export function relationshipsPrompt(
  sanitizedData: string,
  currentProfile?: RelationshipsDimension
): string {
  const currentProfileContext = currentProfile
    ? `
Current relationships profile:
- Key people: ${currentProfile.keyPeople.map((p) => p.name).join(', ')}
- Social style: ${currentProfile.socialFrequency}
`
    : 'No previous profile exists.';

  return `You are analyzing a user's data to understand their important relationships.

Given the following data from the past 90 days:
${sanitizedData}

${currentProfileContext}

Identify:
1. Who are the key people in this person's life? (Look for recurring names in emails, calendar, shared activities, gifts)
2. What is the nature of each relationship? (family, friend, colleague, partner)
3. How does this person invest in relationships? (time together, gifts, shared experiences)
4. Any relationships that seem particularly meaningful based on interaction patterns?

Return structured JSON:
{
  "keyPeople": [
    {
      "name": "...",
      "relationshipType": "family" | "friend" | "colleague" | "partner" | "other",
      "interactionFrequency": "daily" | "weekly" | "monthly" | "occasional",
      "sharedInterests": ["..."],
      "sharedActivities": ["..."],
      "relationshipStrength": 0.0-1.0,
      "evidence": "<source_reference>"
    }
  ],
  "socialFrequency": "solo" | "couple" | "social" | "very_social",
  "relationshipInvestmentPatterns": "...",
  "confidence": 0.0-1.0
}

Important:
- Only include people with multiple data points
- Infer relationship type from context clues
- Be conservative about relationship strength scores`;
}

/**
 * Parse LLM response to RelationshipsDimension
 */
export function parseRelationshipsResponse(
  content: string
): RelationshipsDimension {
  try {
    const parsed = JSON.parse(content);

    return {
      keyPeople: parsePeople(parsed.keyPeople ?? []),
      socialFrequency: validateSocialFrequency(parsed.socialFrequency),
      relationshipInvestmentPatterns:
        String(parsed.relationshipInvestmentPatterns ?? ''),
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    };
  } catch {
    return {
      keyPeople: [],
      socialFrequency: 'social',
      relationshipInvestmentPatterns: '',
      confidence: 0,
    };
  }
}

/**
 * Parse people from LLM response
 */
function parsePeople(people: unknown[]): Person[] {
  return people
    .filter(
      (p): p is Record<string, unknown> => typeof p === 'object' && p !== null
    )
    .map((p) => ({
      name: String(p.name ?? 'Unknown'),
      relationshipType: validateRelationshipType(p.relationshipType),
      interactionFrequency: validateInteractionFrequency(p.interactionFrequency),
      sharedInterests: parseStringArray(p.sharedInterests),
      sharedActivities: parseStringArray(p.sharedActivities),
      relationshipStrength: Math.min(
        1,
        Math.max(0, Number(p.relationshipStrength) || 0.5)
      ),
      lastInteraction:
        typeof p.lastInteraction === 'number' ? p.lastInteraction : undefined,
      evidence: String(p.evidence ?? ''),
    }));
}

/**
 * Validate relationship type
 */
function validateRelationshipType(
  type: unknown
): 'family' | 'friend' | 'colleague' | 'partner' | 'other' {
  const validTypes = ['family', 'friend', 'colleague', 'partner', 'other'];
  if (typeof type === 'string' && validTypes.includes(type)) {
    return type as 'family' | 'friend' | 'colleague' | 'partner' | 'other';
  }
  return 'other';
}

/**
 * Validate interaction frequency
 */
function validateInteractionFrequency(
  frequency: unknown
): 'daily' | 'weekly' | 'monthly' | 'occasional' {
  const validFrequencies = ['daily', 'weekly', 'monthly', 'occasional'];
  if (typeof frequency === 'string' && validFrequencies.includes(frequency)) {
    return frequency as 'daily' | 'weekly' | 'monthly' | 'occasional';
  }
  return 'occasional';
}

/**
 * Validate social frequency
 */
function validateSocialFrequency(
  frequency: unknown
): 'solo' | 'couple' | 'social' | 'very_social' {
  const validFrequencies = ['solo', 'couple', 'social', 'very_social'];
  if (typeof frequency === 'string' && validFrequencies.includes(frequency)) {
    return frequency as 'solo' | 'couple' | 'social' | 'very_social';
  }
  return 'social';
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
