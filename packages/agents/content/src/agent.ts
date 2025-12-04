/**
 * Content Agent - v13 Section 3.6.1
 *
 * L1 agent that recommends articles, podcasts, and videos based on user interests.
 */

import { BaseAgent, type AgentContext, type AgentResult } from '@ownyou/agents-base';
import type { MissionCard } from '@ownyou/shared-types';
import { NAMESPACES, NS } from '@ownyou/shared-types';
import { getProceduralRules } from '@ownyou/reflection';
import {
  CONTENT_PERMISSIONS,
  type ContentTriggerData,
  type ContentItem,
} from './types';
import { createRecommendContentTool } from './tools';

/**
 * ContentAgent - L1 agent for content recommendations
 *
 * @example
 * ```typescript
 * const agent = new ContentAgent();
 * const result = await agent.run({
 *   userId: 'user_123',
 *   store: memoryStore,
 *   tools: [],
 *   triggerData: {
 *     type: 'scheduled',
 *   },
 * });
 * ```
 */
export class ContentAgent extends BaseAgent {
  readonly agentType = 'content' as const;
  readonly level = 'L1' as const;

  constructor() {
    super(CONTENT_PERMISSIONS);
  }

  /**
   * Execute the content agent logic
   */
  protected async execute(context: AgentContext): Promise<AgentResult> {
    const { userId, store, triggerData, llm } = context;

    // Validate trigger data
    if (!triggerData || !this.isContentTrigger(triggerData)) {
      return {
        success: false,
        error: 'Missing or invalid trigger data - expected ContentTriggerData',
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    }

    const contentTrigger = triggerData as ContentTriggerData;

    // 1. Get user interests from semantic memory and IAB classifications
    const interests = await this.getUserInterests(context, contentTrigger);

    if (interests.length === 0) {
      return {
        success: true,
        response: 'No interests detected - cannot generate recommendations',
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    }

    // 2. Get procedural rules (learned preferences)
    let rules: Array<{ id: string; rule: string; confidence: number }> = [];
    try {
      rules = await getProceduralRules(userId, 'content', store as any);
    } catch {
      // Rules not available yet - continue without them
    }

    // 3. Find content recommendations
    const content = await this.findContent(interests, rules);

    if (content.length === 0) {
      return {
        success: true,
        response: 'No content found matching interests',
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    }

    // 4. Generate mission card
    const missionCard = await this.generateMissionCard(
      userId,
      interests,
      content,
      llm
    );

    // 5. Store mission card
    await this.storeMissionCard(store, userId, missionCard);

    return {
      success: true,
      missionCard,
      response: `Found ${content.length} content recommendations for interests: ${interests.join(', ')}`,
      usage: this.limitsEnforcer.getUsage(),
      toolCalls: [],
      llmCalls: [],
      memoryOps: [],
    };
  }

  /**
   * Type guard for ContentTriggerData
   */
  private isContentTrigger(data: unknown): data is ContentTriggerData {
    if (typeof data !== 'object' || data === null) return false;
    const trigger = data as Record<string, unknown>;
    return (
      trigger.type === 'scheduled' || trigger.type === 'interest_detected'
    );
  }

  /**
   * Get user interests from memory and IAB classifications
   */
  private async getUserInterests(
    context: AgentContext,
    trigger: ContentTriggerData
  ): Promise<string[]> {
    const { userId, store } = context;
    const interests = new Set<string>();

    // Add interests from trigger if available
    if (trigger.interests) {
      trigger.interests.forEach((i) => interests.add(i));
    }

    // Track memory read
    this.recordMemoryOp('read', NAMESPACES.IAB_CLASSIFICATIONS);

    // Search IAB classifications for interest categories
    try {
      const iabList = await store.list(NS.iabClassifications(userId), {
        limit: 50,
      });

      // Count category occurrences
      const categoryCount = new Map<string, number>();

      for (const item of iabList) {
        const data = item.value as Record<string, unknown>;
        const cat = (data.tier1_category || data.tier1Category) as string;
        if (cat) {
          categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
        }
      }

      // Add top 3 categories as interests
      const topCategories = Array.from(categoryCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);

      topCategories.forEach((c) => interests.add(c.toLowerCase()));
    } catch {
      // IAB classifications not available
    }

    // Search semantic memory for interest-related facts
    this.recordMemoryOp('search', NAMESPACES.SEMANTIC_MEMORY);

    try {
      const results = await store.search(NS.semanticMemory(userId), 'interests hobbies reading preferences topics', { limit: 10 });

      // Extract interest keywords from memory content
      for (const result of results) {
        const data = result.value as Record<string, unknown>;
        const content = (data.content || '') as string;
        const lowerContent = content.toLowerCase();

        // Simple pattern matching for interests
        const patterns = [
          /interested in (\w+)/gi,
          /enjoys? (\w+)/gi,
          /likes? (\w+)/gi,
          /passionate about (\w+)/gi,
        ];

        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(lowerContent)) !== null) {
            if (match[1].length > 2) {
              interests.add(match[1]);
            }
          }
        }
      }
    } catch {
      // Memory search not available
    }

    // Map to content-relevant categories
    const mappedInterests = Array.from(interests).slice(0, 5);

    return mappedInterests;
  }

  /**
   * Find content using the recommend_content tool
   */
  private async findContent(
    interests: string[],
    _rules: Array<{ id: string; rule: string; confidence: number }>
  ): Promise<ContentItem[]> {
    const tool = createRecommendContentTool();

    const startTime = Date.now();
    const result = await tool.execute({ interests, limit: 5 });
    const durationMs = Date.now() - startTime;

    this.recordToolCall('recommend_content', { interests }, result, durationMs);

    return result;
  }

  /**
   * Generate a mission card from content recommendations
   */
  private async generateMissionCard(
    userId: string,
    interests: string[],
    content: ContentItem[],
    llm?: AgentContext['llm']
  ): Promise<MissionCard> {
    const now = Date.now();
    const missionId = `mission_content_${now}_${Math.random().toString(36).slice(2, 8)}`;

    let title = `Reading List: ${interests[0] || 'Curated Content'}`;
    let summary = `Found ${content.length} items matching your interests`;

    // Use LLM to generate better title/summary if available
    if (llm && content.length > 0) {
      try {
        const startTime = Date.now();
        const response = await llm.complete(userId, {
          operation: 'mission_agent',
          messages: [
            {
              role: 'system',
              content: `Generate a mission card for content recommendations.
Be engaging and specific. Highlight why this content matches user interests.
Output JSON: { "title": string (max 60 chars), "summary": string (max 200 chars) }`,
            },
            {
              role: 'user',
              content: `User interests: ${interests.join(', ')}

Top recommendations:
${content.slice(0, 3).map((c) => `- ${c.title} (${c.type}): ${c.summary || 'No summary'}`).join('\n')}`,
            },
          ],
          maxTokens: 200,
          temperature: 0.3,
        });

        const durationMs = Date.now() - startTime;
        const inputTokens = response.usage?.inputTokens || 300;
        const outputTokens = response.usage?.outputTokens || 100;
        // Estimate cost: ~$0.002 per 1k tokens for GPT-4 mini
        const estimatedCost = ((inputTokens + outputTokens) / 1000) * 0.002;
        this.recordLlmCall(
          'content_mission_generation',
          { interests, content: content.slice(0, 3) },
          response.content,
          { input: inputTokens, output: outputTokens },
          estimatedCost,
          durationMs
        );

        try {
          const parsed = JSON.parse(response.content);
          title = parsed.title || title;
          summary = parsed.summary || summary;
        } catch {
          // Use LLM output as summary if not JSON
          if (response.content.length < 200) {
            summary = response.content;
          }
        }
      } catch {
        // LLM not available - use defaults
      }
    }

    return {
      id: missionId,
      type: 'content',
      title,
      summary,
      urgency: 'low',
      status: 'CREATED',
      createdAt: now,
      ikigaiDimensions: ['interests'],
      ikigaiAlignmentBoost: 0.2,
      primaryAction: {
        label: 'View Recommendations',
        type: 'navigate',
        payload: {
          route: '/content',
          items: content,
        },
      },
      secondaryActions: [
        {
          label: 'Not Interested',
          type: 'confirm',
          payload: { action: 'dismiss' },
        },
        {
          label: 'Save for Later',
          type: 'confirm',
          payload: { action: 'save' },
        },
      ],
      agentThreadId: `thread_${missionId}`,
      evidenceRefs: interests,
    };
  }

  /**
   * Store mission card in memory
   */
  private async storeMissionCard(
    store: AgentContext['store'],
    userId: string,
    missionCard: MissionCard
  ): Promise<void> {
    const namespace = NS.missionCards(userId);

    this.recordMemoryOp('write', NAMESPACES.MISSION_CARDS, missionCard.id);

    await store.put(namespace, missionCard.id, missionCard);
  }

  /**
   * Override extractTags for content-specific tags
   */
  protected extractTags(_trigger: unknown, mission: MissionCard): string[] {
    return ['content', 'reading', 'recommendations', mission.urgency];
  }
}
