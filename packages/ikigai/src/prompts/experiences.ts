/**
 * Experiences Inference Prompt - v13 Section 2.4 Prompt 1
 *
 * Analyzes user data to understand what experiences bring them joy.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.4
 */

import type { ExperiencesDimension, ExperienceType, Activity } from '../types';

/**
 * Generate experiences inference prompt
 */
export function experiencesPrompt(
  sanitizedData: string,
  currentProfile?: ExperiencesDimension
): string {
  const currentProfileContext = currentProfile
    ? `
Current experiences profile:
- Preferred types: ${currentProfile.preferredTypes.join(', ')}
- Frequency: ${currentProfile.frequency}
- Recent activities: ${currentProfile.recentActivities.length} recorded
`
    : 'No previous profile exists.';

  return `You are analyzing a user's data to understand what experiences bring them joy.

Given the following data from the past 90 days:
${sanitizedData}

${currentProfileContext}

Identify:
1. What types of experiences does this person seek? (travel, entertainment, dining, adventure, learning, creative, social_gatherings, outdoor, wellness)
2. What new experiences are evident in this data?
3. How frequently do they pursue experiences vs. routine activities?
4. Any patterns in timing, location, or companions for experiences?

Return structured JSON:
{
  "preferredTypes": ["travel", "dining", ...],
  "frequency": "rare" | "occasional" | "frequent",
  "recentActivities": [
    {
      "type": "...",
      "description": "...",
      "date": <unix_timestamp>,
      "evidence": "<source_reference>"
    }
  ],
  "patterns": {
    "timing": "weekends" | "monthly" | "spontaneous" | null,
    "companions": ["name1", "name2"] | null,
    "locations": ["city1", "city2"] | null
  },
  "confidence": 0.0-1.0
}

Important:
- Only include experiences with clear evidence
- Be conservative with confidence scores
- Distinguish between routine activities and joy-bringing experiences`;
}

/**
 * Parse LLM response to ExperiencesDimension
 */
export function parseExperiencesResponse(content: string): ExperiencesDimension {
  try {
    const parsed = JSON.parse(content);

    return {
      preferredTypes: validateExperienceTypes(parsed.preferredTypes ?? []),
      frequency: validateFrequency(parsed.frequency),
      recentActivities: parseActivities(parsed.recentActivities ?? []),
      patterns: {
        timing: parsed.patterns?.timing,
        companions: parsed.patterns?.companions,
        locations: parsed.patterns?.locations,
      },
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    };
  } catch {
    // Return default on parse error
    return {
      preferredTypes: [],
      frequency: 'occasional',
      recentActivities: [],
      patterns: {},
      confidence: 0,
    };
  }
}

/**
 * Validate experience types
 */
function validateExperienceTypes(types: unknown[]): ExperienceType[] {
  const validTypes: ExperienceType[] = [
    'travel',
    'entertainment',
    'dining',
    'adventure',
    'learning',
    'creative',
    'social_gatherings',
    'outdoor',
    'wellness',
  ];

  return types.filter((t): t is ExperienceType =>
    validTypes.includes(t as ExperienceType)
  );
}

/**
 * Validate frequency
 */
function validateFrequency(
  frequency: unknown
): 'rare' | 'occasional' | 'frequent' {
  const validFrequencies = ['rare', 'occasional', 'frequent'];
  if (
    typeof frequency === 'string' &&
    validFrequencies.includes(frequency)
  ) {
    return frequency as 'rare' | 'occasional' | 'frequent';
  }
  return 'occasional';
}

/**
 * Parse activities from LLM response
 */
function parseActivities(activities: unknown[]): Activity[] {
  return activities
    .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
    .map((a) => ({
      type: validateExperienceTypes([a.type])[0] ?? 'entertainment',
      description: String(a.description ?? ''),
      date: typeof a.date === 'number' ? a.date : Date.now(),
      evidence: String(a.evidence ?? ''),
    }));
}
