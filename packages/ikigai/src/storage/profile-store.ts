/**
 * Ikigai Profile Store - v13 Section 2.9
 *
 * Stores IkigaiProfile in semanticMemory namespace for cross-agent access.
 * Also stores IAB-derived categories for ad relevance.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.9
 */

import { NS } from '@ownyou/shared-types';
import type { IkigaiProfile } from '../types';

/**
 * MemoryStore interface - minimal interface for store operations
 * This avoids direct dependency on memory-store package for type compatibility
 */
export interface MemoryStore {
  put(
    namespace: readonly string[],
    key: string,
    value: Record<string, unknown>
  ): Promise<void>;
  get(
    namespace: readonly string[],
    key: string
  ): Promise<{ key: string; value: Record<string, unknown> } | null>;
  list(
    namespace: readonly string[],
    options?: { prefix?: string }
  ): Promise<Array<{ key: string; value: Record<string, unknown> }>>;
}

const IKIGAI_PROFILE_KEY = 'ikigai_profile';

/**
 * Store Ikigai profile - v13 Section 2.9
 *
 * Stored in semanticMemory namespace for cross-agent access.
 */
export async function storeIkigaiProfile(
  userId: string,
  profile: IkigaiProfile,
  store: MemoryStore
): Promise<void> {
  // Store main profile in semantic memory (v13 Section 8.12)
  await store.put(
    NS.semanticMemory(userId),
    IKIGAI_PROFILE_KEY,
    {
      ...profile,
      type: 'ikigai',
      lastUpdated: new Date().toISOString(),
    }
  );

  // Also store IAB-derived categories for ad relevance (v13 2.9)
  // Always write to maintain BBS+ pseudonym relevance - even when empty
  await store.put(
    NS.iabClassifications(userId),
    'ikigai_derived',
    {
      derivedFrom: 'ikigai_inference',
      categories: profile.interests.genuineInterests.map((i) => i.topic),
      confidence: profile.interests.genuineInterests.length > 0
        ? profile.interests.confidence
        : 0,
      updatedAt: Date.now(),
    }
  );
}

/**
 * Get existing Ikigai profile
 */
export async function getExistingProfile(
  userId: string,
  store: MemoryStore
): Promise<IkigaiProfile | undefined> {
  try {
    const result = await store.get(
      NS.semanticMemory(userId),
      IKIGAI_PROFILE_KEY
    );
    if (!result) return undefined;
    return result.value as unknown as IkigaiProfile;
  } catch {
    return undefined;
  }
}

/**
 * Get Ikigai context for mission agents - v13 2.9
 *
 * Provides a summarized context string for agents to use in prompts.
 */
export async function getIkigaiContextForAgent(
  userId: string,
  store: MemoryStore
): Promise<string> {
  const profile = await getExistingProfile(userId, store);

  if (!profile) {
    return 'No Ikigai profile available yet.';
  }

  const parts: string[] = [];

  // Experiences summary
  if (profile.experiences.preferredTypes.length > 0) {
    parts.push(
      `Preferred experiences: ${profile.experiences.preferredTypes.join(', ')}`
    );
    parts.push(`Experience frequency: ${profile.experiences.frequency}`);
  }

  // Key people summary
  if (profile.relationships.keyPeople.length > 0) {
    const people = profile.relationships.keyPeople
      .slice(0, 5)
      .map((p) => `${p.name} (${p.relationshipType})`)
      .join(', ');
    parts.push(`Key people: ${people}`);
    parts.push(`Social style: ${profile.relationships.socialFrequency}`);
  }

  // Interests summary
  if (profile.interests.genuineInterests.length > 0) {
    const interests = profile.interests.genuineInterests
      .slice(0, 5)
      .map((i) => i.topic)
      .join(', ');
    parts.push(`Interests: ${interests}`);
  }

  // Giving summary
  if (profile.giving.charitableGiving.length > 0) {
    const causes = profile.giving.charitableGiving
      .map((c) => c.cause)
      .join(', ');
    parts.push(`Charitable causes: ${causes}`);
  }

  return parts.join('\n');
}

/**
 * Delete Ikigai profile (for testing/reset)
 */
export async function deleteIkigaiProfile(
  userId: string,
  store: MemoryStore & { delete?: (namespace: readonly string[], key: string) => Promise<void> }
): Promise<void> {
  if (store.delete) {
    await store.delete(NS.semanticMemory(userId), IKIGAI_PROFILE_KEY);
  }
}
