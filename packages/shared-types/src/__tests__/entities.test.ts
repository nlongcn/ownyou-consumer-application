/**
 * Entity Types Tests - v13 Section 8.4.4-8.4.5
 *
 * Tests that Entity and Relationship types are correctly defined
 * per the v13 architecture specification.
 */
import { describe, it, expect } from 'vitest';
import type {
  Entity,
  EntityType,
  Relationship,
  RelationshipType,
} from '../entities';

describe('Entity Types (v13 Section 8.4.4)', () => {
  describe('Entity interface', () => {
    it('should have all required fields per v13', () => {
      const entity: Entity = {
        id: 'ent_123',
        name: 'Sarah',
        type: 'person',
        properties: { relationship: 'partner', dietary: 'vegetarian' },
        validAt: Date.now(),
        createdAt: Date.now(),
        sourceMemories: ['mem_456', 'mem_789'],
      };

      expect(entity.id).toBe('ent_123');
      expect(entity.name).toBe('Sarah');
      expect(entity.type).toBe('person');
      expect(entity.properties).toHaveProperty('relationship');
      expect(entity.sourceMemories).toHaveLength(2);
    });

    it('should support all entity types', () => {
      const types: EntityType[] = [
        'person',
        'place',
        'product',
        'company',
        'event',
        'concept',
      ];

      types.forEach((type) => {
        const entity: Entity = {
          id: `ent_${type}`,
          name: `Test ${type}`,
          type,
          properties: {},
          validAt: Date.now(),
          createdAt: Date.now(),
          sourceMemories: [],
        };
        expect(entity.type).toBe(type);
      });
    });

    it('should support optional invalidAt for temporal validity', () => {
      const entity: Entity = {
        id: 'ent_old_job',
        name: 'Acme Corp',
        type: 'company',
        properties: { role: 'developer' },
        validAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
        invalidAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        createdAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
        sourceMemories: ['mem_work_123'],
      };

      expect(entity.invalidAt).toBeDefined();
    });

    it('should support optional embedding', () => {
      const entity: Entity = {
        id: 'ent_embedded',
        name: 'Paris',
        type: 'place',
        properties: { country: 'France' },
        validAt: Date.now(),
        createdAt: Date.now(),
        sourceMemories: [],
        embedding: new Array(768).fill(0.1),
      };

      expect(entity.embedding).toHaveLength(768);
    });
  });

  describe('EntityType type', () => {
    it('should include all v13 entity types', () => {
      const entityTypes: EntityType[] = [
        'person',
        'place',
        'product',
        'company',
        'event',
        'concept',
      ];
      expect(entityTypes).toHaveLength(6);
    });
  });

  describe('Relationship interface', () => {
    it('should have all required fields per v13', () => {
      const relationship: Relationship = {
        id: 'rel_123',
        fromEntityId: 'ent_user',
        toEntityId: 'ent_sarah',
        type: 'KNOWS',
        validAt: Date.now(),
        createdAt: Date.now(),
        properties: { strength: 0.9, context: 'family' },
        sourceMemories: ['mem_family_123'],
      };

      expect(relationship.fromEntityId).toBe('ent_user');
      expect(relationship.toEntityId).toBe('ent_sarah');
      expect(relationship.type).toBe('KNOWS');
      expect(relationship.properties).toHaveProperty('strength');
    });

    it('should support all relationship types', () => {
      const types: RelationshipType[] = [
        'KNOWS',
        'WORKS_AT',
        'LIVES_IN',
        'PURCHASED_FROM',
        'VISITED',
        'INTERESTED_IN',
      ];

      types.forEach((type) => {
        const rel: Relationship = {
          id: `rel_${type.toLowerCase()}`,
          fromEntityId: 'ent_user',
          toEntityId: 'ent_target',
          type,
          validAt: Date.now(),
          createdAt: Date.now(),
          properties: {},
          sourceMemories: [],
        };
        expect(rel.type).toBe(type);
      });
    });

    it('should support optional invalidAt for temporal relationships', () => {
      const relationship: Relationship = {
        id: 'rel_old_work',
        fromEntityId: 'ent_user',
        toEntityId: 'ent_acme',
        type: 'WORKS_AT',
        validAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
        invalidAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        createdAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
        properties: { role: 'developer' },
        sourceMemories: [],
      };

      expect(relationship.invalidAt).toBeDefined();
    });
  });

  describe('RelationshipType type', () => {
    it('should include all v13 relationship types', () => {
      const relTypes: RelationshipType[] = [
        'KNOWS',
        'WORKS_AT',
        'LIVES_IN',
        'PURCHASED_FROM',
        'VISITED',
        'INTERESTED_IN',
      ];
      expect(relTypes).toHaveLength(6);
    });
  });
});
