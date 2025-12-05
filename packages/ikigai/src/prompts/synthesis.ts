/**
 * Ikigai Synthesis Prompt - v13 Section 2.4 Prompt 5
 *
 * Synthesizes all 4 dimension analyses into a unified profile.
 * Also incorporates mission feedback for continuous improvement.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.4
 */

import type {
  ExperiencesDimension,
  RelationshipsDimension,
  InterestsDimension,
  GivingDimension,
  IkigaiProfile,
  DimensionWeights,
  MissionFeedbackContext,
  SynthesisResult,
} from '../types';

/**
 * Generate synthesis prompt
 *
 * v13 requires: {mission_feedback_context} to incorporate recent feedback
 */
export function synthesisPrompt(
  experiences: ExperiencesDimension,
  relationships: RelationshipsDimension,
  interests: InterestsDimension,
  giving: GivingDimension,
  previousProfile?: IkigaiProfile,
  missionFeedback?: MissionFeedbackContext
): string {
  const previousContext = previousProfile
    ? `
Previous ikigai profile:
- Dimension weights: Experiences=${previousProfile.dimensionWeights.experiences}, Relationships=${previousProfile.dimensionWeights.relationships}, Interests=${previousProfile.dimensionWeights.interests}, Giving=${previousProfile.dimensionWeights.giving}
- Last updated: ${new Date(previousProfile.updatedAt).toISOString()}
`
    : 'No previous profile exists.';

  // v13 2.4: Include mission feedback in synthesis
  const feedbackContext = missionFeedback
    ? `
Recent mission feedback from this user:
- Loved missions: ${missionFeedback.lovedMissions.join(', ') || 'None'}
- Liked missions: ${missionFeedback.likedMissions.join(', ') || 'None'}
- Dismissed missions: ${missionFeedback.dismissedMissions.join(', ') || 'None'}
- Patterns: ${missionFeedback.patterns || 'Not enough data'}
`
    : 'No recent mission feedback available.';

  return `You are synthesizing a user's ikigai profile from multiple data analyses.

Experiences analysis:
${JSON.stringify(experiences, null, 2)}

Relationships analysis:
${JSON.stringify(relationships, null, 2)}

Interests analysis:
${JSON.stringify(interests, null, 2)}

Giving analysis:
${JSON.stringify(giving, null, 2)}

${previousContext}

${feedbackContext}

Synthesize an updated ikigai profile:
1. What brings this person daily joy? (small, recurring pleasures)
2. Who matters most to them?
3. What are they genuinely passionate about?
4. How do they contribute to others?
5. What has changed since the last profile update?

Also synthesize dimension weights and overall confidence:
- Which dimensions show the strongest signals? (weight higher)
- Which dimensions lack data? (weight lower)
- How does mission feedback align with or contradict data signals?

Return structured JSON:
{
  "dimensionWeights": {
    "experiences": 0.0-1.0,
    "relationships": 0.0-1.0,
    "interests": 0.0-1.0,
    "giving": 0.0-1.0
  },
  "overallConfidence": 0.0-1.0,
  "changesSinceLastUpdate": "...",
  "dailyJoy": "...",
  "keyPeopleInsight": "...",
  "passionInsight": "...",
  "contributionInsight": "..."
}

Weighting guidelines:
- Sum of weights should approximately equal 1.0
- Weight by both signal strength AND user engagement history
- Low-data dimensions should have lower weights
- Mission feedback can boost/reduce dimension weights`;
}

/**
 * Parse synthesis response
 */
export function parseSynthesisResponse(content: string): SynthesisResult {
  try {
    const parsed = JSON.parse(content);

    const weights = parsed.dimensionWeights ?? {};
    const normalizedWeights: DimensionWeights = {
      experiences: Math.min(1, Math.max(0, weights.experiences ?? 0.25)),
      relationships: Math.min(1, Math.max(0, weights.relationships ?? 0.25)),
      interests: Math.min(1, Math.max(0, weights.interests ?? 0.25)),
      giving: Math.min(1, Math.max(0, weights.giving ?? 0.25)),
    };

    // Normalize weights to sum to approximately 1.0
    const sum =
      normalizedWeights.experiences +
      normalizedWeights.relationships +
      normalizedWeights.interests +
      normalizedWeights.giving;

    if (sum > 0) {
      normalizedWeights.experiences /= sum;
      normalizedWeights.relationships /= sum;
      normalizedWeights.interests /= sum;
      normalizedWeights.giving /= sum;
    }

    return {
      dimensionWeights: normalizedWeights,
      overallConfidence: Math.min(1, Math.max(0, parsed.overallConfidence ?? 0.5)),
      changesSinceLastUpdate: String(parsed.changesSinceLastUpdate ?? ''),
      dailyJoy: parsed.dailyJoy ? String(parsed.dailyJoy) : undefined,
      keyPeopleInsight: parsed.keyPeopleInsight
        ? String(parsed.keyPeopleInsight)
        : undefined,
      passionInsight: parsed.passionInsight
        ? String(parsed.passionInsight)
        : undefined,
      contributionInsight: parsed.contributionInsight
        ? String(parsed.contributionInsight)
        : undefined,
    };
  } catch {
    return {
      dimensionWeights: {
        experiences: 0.25,
        relationships: 0.25,
        interests: 0.25,
        giving: 0.25,
      },
      overallConfidence: 0.5,
      changesSinceLastUpdate: '',
    };
  }
}
