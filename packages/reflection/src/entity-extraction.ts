/**
 * Entity Extraction - v13 Section 8.4.5
 *
 * Extracts entities from memories during Reflection, not during hot-path writes.
 * This keeps write latency low while still building the entity graph.
 */

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import { NS } from '@ownyou/shared-types';

/**
 * Entity types that can be extracted
 */
export type EntityType = 'person' | 'organization' | 'place' | 'product' | 'event';

/**
 * Extracted entity structure
 */
export interface ExtractedEntity {
  id: string;
  name: string;
  type: EntityType;
  properties: Record<string, unknown>;
  firstSeen: number;
  lastMentioned: number;
  mentionCount: number;
  sourceMemories: string[];
}

/**
 * Relationship between entities
 */
export interface EntityRelationship {
  id: string;
  fromEntity: string; // 'USER' or entity id
  toEntity: string;
  type: string; // e.g., 'WORKS_AT', 'KNOWS', 'VISITED'
  validAt: number;
  createdAt: number;
  properties: Record<string, unknown>;
  sourceMemories: string[];
}

/**
 * Extract entities from new memories
 *
 * Finds memories that haven't had entities extracted yet
 * and uses LLM to identify entities and relationships.
 */
export async function extractEntitiesFromNewMemories(
  userId: string,
  store: MemoryStore,
  llm: LLMClient
): Promise<number> {
  // Find memories that haven't had entities extracted yet
  const allMemories = await store.list<Memory & { entitiesExtracted?: boolean }>(
    NS.semanticMemory(userId)
  );
  const unprocessedMemories = allMemories.items.filter((m) => !m.entitiesExtracted);

  // Limit batch size to avoid excessive LLM calls
  const batch = unprocessedMemories.slice(0, 50);

  let entitiesCreated = 0;

  for (const memory of batch) {
    const extracted = await extractEntitiesFromMemory(memory, userId, store, llm);
    entitiesCreated += extracted;

    // Mark memory as processed
    await store.put(NS.semanticMemory(userId), memory.id, {
      ...memory,
      entitiesExtracted: true,
    });
  }

  return entitiesCreated;
}

/**
 * Extract entities from a single memory
 */
async function extractEntitiesFromMemory(
  memory: Memory,
  userId: string,
  store: MemoryStore,
  llm: LLMClient
): Promise<number> {
  // Use LLM to extract entities
  const extraction = await llm.complete(userId, {
    operation: 'reflection_node',
    messages: [
      {
        role: 'system',
        content: `Extract entities from this observation about the user.
Return JSON array:
[{
  "name": "entity name",
  "type": "person|organization|place|product|event",
  "relationshipToUser": "how user relates to this entity",
  "properties": { any relevant properties }
}]
Only extract clearly mentioned entities. Return [] if none found.`,
      },
      {
        role: 'user',
        content: memory.content,
      },
    ],
    maxTokens: 500,
    temperature: 0.1,
  });

  let entities: Array<{
    name: string;
    type: EntityType;
    relationshipToUser?: string;
    properties?: Record<string, unknown>;
  }> = [];

  try {
    entities = JSON.parse(extraction.content);
  } catch {
    return 0;
  }

  let entitiesCreated = 0;

  for (const extracted of entities) {
    // Check if entity already exists - use list with filter instead of search
    // since entities don't extend Memory type
    const allEntities = await store.list<ExtractedEntity>(NS.entities(userId));
    const matchingEntities = allEntities.items.filter(
      (e) => e.name.toLowerCase() === extracted.name.toLowerCase()
    );

    if (matchingEntities.length > 0) {
      // Update existing entity
      const existing = matchingEntities[0];
      await store.put(NS.entities(userId), existing.id, {
        ...existing,
        lastMentioned: Date.now(),
        mentionCount: (existing.mentionCount || 0) + 1,
        sourceMemories: [...(existing.sourceMemories || []), memory.id],
        properties: { ...existing.properties, ...(extracted.properties || {}) },
      });
    } else {
      // Create new entity
      const entityId = crypto.randomUUID();
      const entity: ExtractedEntity = {
        id: entityId,
        name: extracted.name,
        type: extracted.type,
        properties: extracted.properties || {},
        firstSeen: Date.now(),
        lastMentioned: Date.now(),
        mentionCount: 1,
        sourceMemories: [memory.id],
      };

      await store.put(NS.entities(userId), entityId, entity);

      // Create relationship to user if specified
      if (extracted.relationshipToUser) {
        const relationship: EntityRelationship = {
          id: crypto.randomUUID(),
          fromEntity: 'USER',
          toEntity: entityId,
          type: extracted.relationshipToUser.toUpperCase().replace(/ /g, '_'),
          validAt: memory.validAt,
          createdAt: Date.now(),
          properties: {},
          sourceMemories: [memory.id],
        };

        await store.put(NS.relationships(userId), relationship.id, relationship);
      }

      entitiesCreated++;
    }
  }

  return entitiesCreated;
}

/**
 * Get all entities for a user
 */
export async function getEntities(
  userId: string,
  store: MemoryStore,
  options?: {
    type?: EntityType;
    limit?: number;
  }
): Promise<ExtractedEntity[]> {
  const allEntities = await store.list<ExtractedEntity>(NS.entities(userId));

  let entities = allEntities.items;

  if (options?.type) {
    entities = entities.filter((e) => e.type === options.type);
  }

  // Sort by mention count descending
  entities.sort((a, b) => b.mentionCount - a.mentionCount);

  if (options?.limit) {
    entities = entities.slice(0, options.limit);
  }

  return entities;
}

/**
 * Get relationships for a user
 */
export async function getRelationships(
  userId: string,
  store: MemoryStore,
  options?: {
    entityId?: string;
    type?: string;
  }
): Promise<EntityRelationship[]> {
  const allRelationships = await store.list<EntityRelationship>(NS.relationships(userId));

  let relationships = allRelationships.items;

  if (options?.entityId) {
    relationships = relationships.filter(
      (r) => r.fromEntity === options.entityId || r.toEntity === options.entityId
    );
  }

  if (options?.type) {
    relationships = relationships.filter((r) => r.type === options.type);
  }

  return relationships;
}

/**
 * Find entities by name (fuzzy match)
 */
export async function findEntitiesByName(
  userId: string,
  name: string,
  store: MemoryStore
): Promise<ExtractedEntity[]> {
  // Use list with filter instead of search since entities don't extend Memory type
  const allEntities = await store.list<ExtractedEntity>(NS.entities(userId));
  const lowerName = name.toLowerCase();

  // Filter by name (fuzzy match - includes the name as substring)
  const matches = allEntities.items.filter(
    (e) => e.name.toLowerCase().includes(lowerName) || lowerName.includes(e.name.toLowerCase())
  );

  // Sort by mention count and return top 10
  return matches.sort((a, b) => b.mentionCount - a.mentionCount).slice(0, 10);
}
