/**
 * Entity Sync - v13 Section 2.9
 *
 * Syncs key people from Ikigai analysis to entities namespace,
 * allowing mission agents to reference known people.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.9
 */

import type { Person } from '../types';
import type { MemoryStore } from './profile-store';

/**
 * Sync key people to entities namespace - v13 Section 2.9
 *
 * Allows mission agents to reference known people.
 */
export async function syncPeopleToEntities(
  userId: string,
  people: Person[],
  store: MemoryStore
): Promise<void> {
  for (const person of people) {
    const entityKey = `person:${normalizeEntityKey(person.name)}`;

    await store.put(
      ['ownyou.entities', userId],
      entityKey,
      {
        entityType: 'person',
        name: person.name,
        relationship: person.relationshipType,
        interactionFrequency: person.interactionFrequency,
        sharedInterests: person.sharedInterests,
        sharedActivities: person.sharedActivities,
        relationshipStrength: person.relationshipStrength,
        lastSeen: new Date().toISOString(),
        sourceContext: 'ikigai_inference',
      }
    );
  }
}

/**
 * Get known people for an agent
 */
export async function getKnownPeople(
  userId: string,
  store: MemoryStore
): Promise<Person[]> {
  try {
    const entities = await store.list(
      ['ownyou.entities', userId],
      { prefix: 'person:' }
    );

    return entities.map((e) => {
      const val = e.value as Record<string, unknown>;
      return {
        name: String(val.name || ''),
        relationshipType: (val.relationship as Person['relationshipType']) || 'other',
        interactionFrequency:
          (val.interactionFrequency as Person['interactionFrequency']) || 'occasional',
        sharedInterests: (val.sharedInterests as string[]) ?? [],
        sharedActivities: (val.sharedActivities as string[]) ?? [],
        relationshipStrength: Number(val.relationshipStrength) || 0.5,
        evidence: e.key,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get a specific person by name
 */
export async function getPersonByName(
  userId: string,
  name: string,
  store: MemoryStore
): Promise<Person | undefined> {
  try {
    const entityKey = `person:${normalizeEntityKey(name)}`;
    const result = await store.get(['ownyou.entities', userId], entityKey);

    if (!result) return undefined;

    const val = result.value as Record<string, unknown>;
    return {
      name: String(val.name || ''),
      relationshipType: (val.relationship as Person['relationshipType']) || 'other',
      interactionFrequency:
        (val.interactionFrequency as Person['interactionFrequency']) || 'occasional',
      sharedInterests: (val.sharedInterests as string[]) ?? [],
      sharedActivities: (val.sharedActivities as string[]) ?? [],
      relationshipStrength: Number(val.relationshipStrength) || 0.5,
      evidence: result.key,
    };
  } catch {
    return undefined;
  }
}

/**
 * Find people matching a relationship type
 */
export async function getPeopleByRelationship(
  userId: string,
  relationshipType: Person['relationshipType'],
  store: MemoryStore
): Promise<Person[]> {
  const allPeople = await getKnownPeople(userId, store);
  return allPeople.filter((p) => p.relationshipType === relationshipType);
}

/**
 * Find people with high relationship strength
 */
export async function getClosestPeople(
  userId: string,
  store: MemoryStore,
  limit: number = 5
): Promise<Person[]> {
  const allPeople = await getKnownPeople(userId, store);
  return allPeople
    .sort((a, b) => b.relationshipStrength - a.relationshipStrength)
    .slice(0, limit);
}

/**
 * Normalize entity key for consistent lookups
 */
function normalizeEntityKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Spaces to underscores
    .substring(0, 50); // Limit length
}
