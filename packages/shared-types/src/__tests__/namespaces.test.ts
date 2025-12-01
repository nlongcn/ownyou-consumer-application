/**
 * Namespaces Tests - v13 Section 8.12
 *
 * Tests that NAMESPACES constant and NS factory functions are correctly
 * defined per the v13 architecture specification.
 */
import { describe, it, expect } from 'vitest';
import {
  NAMESPACES,
  NS,
  NAMESPACE_PRIVACY,
  NAMESPACE_SYNC_SCOPE,
} from '../namespaces';
import type { Namespace } from '../namespaces';

describe('Namespaces (v13 Section 8.12)', () => {
  describe('NAMESPACES constant', () => {
    it('should define all v13 namespace strings', () => {
      // Core memory
      expect(NAMESPACES.SEMANTIC_MEMORY).toBe('ownyou.semantic');
      expect(NAMESPACES.EPISODIC_MEMORY).toBe('ownyou.episodic');
      expect(NAMESPACES.PROCEDURAL_MEMORY).toBe('ownyou.procedural');

      // Relational
      expect(NAMESPACES.ENTITIES).toBe('ownyou.entities');
      expect(NAMESPACES.RELATIONSHIPS).toBe('ownyou.relationships');
      expect(NAMESPACES.COMMUNITY_SUMMARIES).toBe('ownyou.summaries');

      // Classifications
      expect(NAMESPACES.IAB_CLASSIFICATIONS).toBe('ownyou.iab');

      // Ikigai
      expect(NAMESPACES.IKIGAI_PROFILE).toBe('ownyou.ikigai');
      expect(NAMESPACES.IKIGAI_EVIDENCE).toBe('ownyou.ikigai_evidence');

      // Missions
      expect(NAMESPACES.MISSION_CARDS).toBe('ownyou.missions');
      expect(NAMESPACES.MISSION_FEEDBACK).toBe('ownyou.mission_feedback');

      // Identity
      expect(NAMESPACES.PSEUDONYMS).toBe('ownyou.pseudonyms');
      expect(NAMESPACES.DISCLOSURE_HISTORY).toBe('ownyou.disclosures');
      expect(NAMESPACES.TRACKING_CONSENTS).toBe('ownyou.tracking_consents');

      // Financial
      expect(NAMESPACES.EARNINGS).toBe('ownyou.earnings');

      // Observability
      expect(NAMESPACES.AGENT_TRACES).toBe('ownyou.traces');
      expect(NAMESPACES.LLM_USAGE).toBe('ownyou.llm_usage');
      expect(NAMESPACES.SYNC_LOGS).toBe('ownyou.sync_logs');
    });

    it('should have at least 15 namespaces per v13', () => {
      const namespaceCount = Object.keys(NAMESPACES).length;
      expect(namespaceCount).toBeGreaterThanOrEqual(15);
    });
  });

  describe('NS factory functions', () => {
    const userId = 'user_123';

    it('should create semantic memory namespace tuple', () => {
      const ns = NS.semanticMemory(userId);
      expect(ns).toEqual(['ownyou.semantic', 'user_123']);
    });

    it('should create episodic memory namespace tuple', () => {
      const ns = NS.episodicMemory(userId);
      expect(ns).toEqual(['ownyou.episodic', 'user_123']);
    });

    it('should create procedural memory namespace tuple with agentType', () => {
      const ns = NS.proceduralMemory(userId, 'travel');
      expect(ns).toEqual(['ownyou.procedural', 'user_123', 'travel']);
    });

    it('should create entities namespace tuple', () => {
      const ns = NS.entities(userId);
      expect(ns).toEqual(['ownyou.entities', 'user_123']);
    });

    it('should create relationships namespace tuple', () => {
      const ns = NS.relationships(userId);
      expect(ns).toEqual(['ownyou.relationships', 'user_123']);
    });

    it('should create IAB classifications namespace tuple', () => {
      const ns = NS.iabClassifications(userId);
      expect(ns).toEqual(['ownyou.iab', 'user_123']);
    });

    it('should create ikigai profile namespace tuple', () => {
      const ns = NS.ikigaiProfile(userId);
      expect(ns).toEqual(['ownyou.ikigai', 'user_123']);
    });

    it('should create mission cards namespace tuple', () => {
      const ns = NS.missionCards(userId);
      expect(ns).toEqual(['ownyou.missions', 'user_123']);
    });

    it('should create pseudonyms namespace tuple', () => {
      const ns = NS.pseudonyms(userId);
      expect(ns).toEqual(['ownyou.pseudonyms', 'user_123']);
    });

    it('should create earnings namespace tuple', () => {
      const ns = NS.earnings(userId);
      expect(ns).toEqual(['ownyou.earnings', 'user_123']);
    });

    it('should create agent traces namespace tuple', () => {
      const ns = NS.agentTraces(userId);
      expect(ns).toEqual(['ownyou.traces', 'user_123']);
    });

    it('should create LLM usage namespace tuple with period', () => {
      const dailyNs = NS.llmUsage(userId, 'daily');
      const monthlyNs = NS.llmUsage(userId, 'monthly');

      expect(dailyNs).toEqual(['ownyou.llm_usage', 'user_123', 'daily']);
      expect(monthlyNs).toEqual(['ownyou.llm_usage', 'user_123', 'monthly']);
    });
  });

  describe('NAMESPACE_PRIVACY (v13 Section 8.11)', () => {
    it('should define privacy tier for all namespaces', () => {
      const namespaces = Object.values(NAMESPACES);
      namespaces.forEach((ns) => {
        expect(NAMESPACE_PRIVACY[ns]).toBeDefined();
        expect(['public', 'sensitive', 'private']).toContain(NAMESPACE_PRIVACY[ns]);
      });
    });

    it('should mark pseudonyms as private', () => {
      expect(NAMESPACE_PRIVACY[NAMESPACES.PSEUDONYMS]).toBe('private');
    });

    it('should mark disclosure history as private', () => {
      expect(NAMESPACE_PRIVACY[NAMESPACES.DISCLOSURE_HISTORY]).toBe('private');
    });

    it('should mark semantic memory as public', () => {
      expect(NAMESPACE_PRIVACY[NAMESPACES.SEMANTIC_MEMORY]).toBe('public');
    });

    it('should mark ikigai profile as sensitive', () => {
      expect(NAMESPACE_PRIVACY[NAMESPACES.IKIGAI_PROFILE]).toBe('sensitive');
    });
  });

  describe('NAMESPACE_SYNC_SCOPE (v13 Section 8.14.1)', () => {
    it('should define sync scope for all namespaces', () => {
      const namespaces = Object.values(NAMESPACES);
      namespaces.forEach((ns) => {
        expect(NAMESPACE_SYNC_SCOPE[ns]).toBeDefined();
        expect(['full', 'selective', 'none']).toContain(NAMESPACE_SYNC_SCOPE[ns]);
      });
    });

    it('should mark agent traces as none (device-local)', () => {
      expect(NAMESPACE_SYNC_SCOPE[NAMESPACES.AGENT_TRACES]).toBe('none');
    });

    it('should mark LLM usage as none (device-local)', () => {
      expect(NAMESPACE_SYNC_SCOPE[NAMESPACES.LLM_USAGE]).toBe('none');
    });

    it('should mark semantic memory as full sync', () => {
      expect(NAMESPACE_SYNC_SCOPE[NAMESPACES.SEMANTIC_MEMORY]).toBe('full');
    });

    it('should mark episodic memory as selective sync', () => {
      expect(NAMESPACE_SYNC_SCOPE[NAMESPACES.EPISODIC_MEMORY]).toBe('selective');
    });
  });
});
