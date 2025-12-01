/**
 * Agent Types Tests - v13 Section 3.6
 *
 * Tests that AgentPermissions, AgentLimits, MissionCard, and related types
 * are correctly defined per the v13 architecture specification.
 */
import { describe, it, expect } from 'vitest';
import type {
  AgentPermissions,
  ExternalApiConfig,
  ToolDefinition,
  AgentLevel,
  AgentLimits,
  MissionCard,
  MissionStatus,
  MissionAction,
} from '../agent';
import { AGENT_LIMITS } from '../agent';

describe('Agent Types (v13 Section 3.6)', () => {
  describe('AgentPermissions interface', () => {
    it('should have all required fields per v13 Section 3.6.2', () => {
      const permissions: AgentPermissions = {
        agentType: 'travel',
        memoryAccess: {
          read: ['semantic_memory', 'episodic_memory'],
          write: ['episodic_memory'],
          search: ['semantic_memory'],
        },
        externalApis: [],
        toolDefinitions: [],
      };

      expect(permissions.agentType).toBe('travel');
      expect(permissions.memoryAccess.read).toContain('semantic_memory');
      expect(permissions.memoryAccess.write).toContain('episodic_memory');
    });

    it('should include external API configs', () => {
      const apiConfig: ExternalApiConfig = {
        name: 'FlightSearch',
        rateLimit: '100/hour',
        requiresUserConsent: true,
      };

      const permissions: AgentPermissions = {
        agentType: 'travel',
        memoryAccess: {
          read: [],
          write: [],
          search: [],
        },
        externalApis: [apiConfig],
        toolDefinitions: [],
      };

      expect(permissions.externalApis[0].requiresUserConsent).toBe(true);
    });

    it('should include tool definitions', () => {
      const tool: ToolDefinition = {
        name: 'search_flights',
        description: 'Search for flights between two cities',
        parameters: {
          origin: { type: 'string' },
          destination: { type: 'string' },
          date: { type: 'string' },
        },
      };

      const permissions: AgentPermissions = {
        agentType: 'travel',
        memoryAccess: {
          read: [],
          write: [],
          search: [],
        },
        externalApis: [],
        toolDefinitions: [tool],
      };

      expect(permissions.toolDefinitions[0].name).toBe('search_flights');
    });
  });

  describe('AgentLevel and AGENT_LIMITS', () => {
    it('should define L1, L2, L3 levels', () => {
      const levels: AgentLevel[] = ['L1', 'L2', 'L3'];
      expect(levels).toHaveLength(3);
    });

    it('should have correct L1 limits per v13 Section 3.6.3', () => {
      const l1: AgentLimits = AGENT_LIMITS.L1;

      expect(l1.maxToolCalls).toBe(3);
      expect(l1.maxLlmCalls).toBe(2);
      expect(l1.timeoutSeconds).toBe(30);
      expect(l1.maxMemoryReads).toBe(10);
      expect(l1.maxMemoryWrites).toBe(3);
    });

    it('should have correct L2 limits per v13 Section 3.6.3', () => {
      const l2: AgentLimits = AGENT_LIMITS.L2;

      expect(l2.maxToolCalls).toBe(10);
      expect(l2.maxLlmCalls).toBe(5);
      expect(l2.timeoutSeconds).toBe(120);
      expect(l2.maxMemoryReads).toBe(25);
      expect(l2.maxMemoryWrites).toBe(10);
    });

    it('should have correct L3 limits per v13 Section 3.6.3', () => {
      const l3: AgentLimits = AGENT_LIMITS.L3;

      expect(l3.maxToolCalls).toBe(25);
      expect(l3.maxLlmCalls).toBe(10);
      expect(l3.timeoutSeconds).toBe(300);
      expect(l3.maxMemoryReads).toBe(50);
      expect(l3.maxMemoryWrites).toBe(20);
    });

    it('should have increasing limits from L1 to L3', () => {
      expect(AGENT_LIMITS.L1.maxToolCalls).toBeLessThan(AGENT_LIMITS.L2.maxToolCalls);
      expect(AGENT_LIMITS.L2.maxToolCalls).toBeLessThan(AGENT_LIMITS.L3.maxToolCalls);
    });
  });

  describe('MissionCard interface', () => {
    it('should have all required fields per v13 Section 3.4', () => {
      const mission: MissionCard = {
        id: 'mission_123',
        type: 'travel',
        title: 'Plan Paris Trip',
        summary: 'Help user plan a trip to Paris based on their preferences',
        urgency: 'medium',
        status: 'CREATED',
        createdAt: Date.now(),
        ikigaiDimensions: ['experiences', 'relationships'],
        ikigaiAlignmentBoost: 0.3,
        primaryAction: {
          label: 'Start Planning',
          type: 'navigate',
          payload: { screen: 'travel_planner' },
        },
        agentThreadId: 'thread_456',
        evidenceRefs: ['mem_789', 'ep_abc'],
      };

      expect(mission.id).toBe('mission_123');
      expect(mission.type).toBe('travel');
      expect(mission.urgency).toBe('medium');
      expect(mission.status).toBe('CREATED');
      expect(mission.ikigaiDimensions).toContain('experiences');
    });

    it('should support all mission statuses', () => {
      const statuses: MissionStatus[] = [
        'CREATED',
        'PRESENTED',
        'ACTIVE',
        'SNOOZED',
        'DISMISSED',
        'COMPLETED',
      ];
      expect(statuses).toHaveLength(6);
    });

    it('should support optional fields', () => {
      const mission: MissionCard = {
        id: 'mission_456',
        type: 'restaurant',
        title: 'Date Night Recommendation',
        summary: 'Suggest a restaurant for anniversary dinner',
        urgency: 'high',
        status: 'COMPLETED',
        createdAt: Date.now() - 86400000,
        expiresAt: Date.now() + 86400000,
        snoozedUntil: undefined,
        ikigaiDimensions: ['relationships'],
        ikigaiAlignmentBoost: 0.5,
        primaryAction: {
          label: 'View Recommendation',
          type: 'navigate',
          payload: {},
        },
        secondaryActions: [
          {
            label: 'Dismiss',
            type: 'confirm',
            payload: { action: 'dismiss' },
          },
        ],
        agentThreadId: 'thread_789',
        evidenceRefs: [],
        userRating: 5,
        completionFeedback: 'Perfect recommendation!',
      };

      expect(mission.expiresAt).toBeDefined();
      expect(mission.secondaryActions).toHaveLength(1);
      expect(mission.userRating).toBe(5);
      expect(mission.completionFeedback).toBeDefined();
    });

    it('should support all action types', () => {
      const actionTypes: MissionAction['type'][] = [
        'navigate',
        'confirm',
        'input',
        'external',
      ];
      expect(actionTypes).toHaveLength(4);
    });
  });
});
