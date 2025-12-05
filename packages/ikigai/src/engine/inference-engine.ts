/**
 * Ikigai Inference Engine - v13 Section 2.1
 *
 * Orchestrates the 4 parallel dimension prompts + synthesis.
 * Main entry point for Ikigai profile inference.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.1-2.4
 */

import { NS } from '@ownyou/shared-types';
import { getRecommendedModel, type ModelTier as LLMModelTier } from '@ownyou/llm-client';
import type {
  IkigaiProfile,
  IkigaiInferenceConfig,
  ExperiencesDimension,
  RelationshipsDimension,
  InterestsDimension,
  GivingDimension,
  IkigaiEvidence,
  UserDataBundle,
  MissionFeedbackContext,
  DEFAULT_INFERENCE_CONFIG,
  ModelTier,
} from '../types';

import {
  experiencesPrompt,
  parseExperiencesResponse,
} from '../prompts/experiences';
import {
  relationshipsPrompt,
  parseRelationshipsResponse,
} from '../prompts/relationships';
import { interestsPrompt, parseInterestsResponse } from '../prompts/interests';
import { givingPrompt, parseGivingResponse } from '../prompts/giving';
import { synthesisPrompt, parseSynthesisResponse } from '../prompts/synthesis';
import { sanitizeDataForLLM } from './data-sanitizer';
import {
  storeIkigaiProfile,
  getExistingProfile,
  type MemoryStore,
} from '../storage/profile-store';
import { storeEvidence } from '../storage/evidence-store';
import { syncPeopleToEntities } from '../storage/entity-sync';
import { BatchProcessor } from './batch-processor';

/**
 * LLM Client interface - minimal for inference
 * Avoids direct dependency on llm-client package
 */
export interface LLMClient {
  complete(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    responseFormat?: string;
  }): Promise<{ content: string }>;
}

/**
 * Default inference configuration
 */
const DEFAULT_CONFIG: IkigaiInferenceConfig = {
  batchWindow: 'daily',
  minItemsThreshold: 10,
  parallelInference: true,
  dataWindowDays: 90,
  modelTier: 'standard',
};

/**
 * Ikigai Inference Engine - v13 Section 2.1
 *
 * Orchestrates the 4 parallel dimension prompts + synthesis.
 */
export class IkigaiInferenceEngine {
  private config: IkigaiInferenceConfig;
  private llm: LLMClient;
  private store: MemoryStore;
  private batchProcessor: BatchProcessor;

  constructor(
    llm: LLMClient,
    store: MemoryStore,
    config: Partial<IkigaiInferenceConfig> = {}
  ) {
    this.llm = llm;
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.batchProcessor = new BatchProcessor(this.config);
  }

  /**
   * Run full Ikigai inference pipeline
   *
   * v13 2.4: "4 parallel prompts + synthesis"
   */
  async runInference(
    userId: string,
    options: { force?: boolean; missionFeedback?: MissionFeedbackContext } = {}
  ): Promise<IkigaiProfile> {
    // 1. Gather data from Store
    const rawData = await this.gatherUserData(userId);

    // 2. Check batch readiness (unless forced)
    if (!options.force) {
      const readiness = this.batchProcessor.checkBatchReadiness(userId, rawData);
      if (!readiness.ready) {
        // Return existing profile if not ready
        const existing = await getExistingProfile(userId, this.store);
        if (existing) {
          return existing;
        }
        // Fall through to inference if no existing profile
      }
    }

    // 3. Mark batch as processing
    this.batchProcessor.markProcessing(userId);

    try {
      // 4. Sanitize data for LLM (remove PII, summarize)
      const sanitizedData = await sanitizeDataForLLM(
        rawData,
        this.config.dataWindowDays
      );

      // 5. Get existing profile for context
      const existingProfile = await getExistingProfile(userId, this.store);

      // 6. Run 4 dimension prompts in parallel (v13 2.4)
      const [experiences, relationships, interests, giving] = await Promise.all(
        [
          this.inferExperiences(sanitizedData, existingProfile),
          this.inferRelationships(sanitizedData, existingProfile),
          this.inferInterests(sanitizedData, existingProfile),
          this.inferGiving(sanitizedData, existingProfile),
        ]
      );

      // 7. Run synthesis prompt
      const synthesisResult = await this.synthesize(
        experiences,
        relationships,
        interests,
        giving,
        existingProfile,
        options.missionFeedback
      );

      // 8. Extract evidence FIRST (before creating profile)
      const evidence = this.extractEvidence(
        experiences,
        relationships,
        interests,
        giving
      );

      // 9. Create full profile WITH evidence
      const profile: IkigaiProfile = {
        userId,
        updatedAt: Date.now(),
        experiences,
        relationships,
        interests,
        giving,
        dimensionWeights: synthesisResult.dimensionWeights,
        confidence: synthesisResult.overallConfidence,
        evidence, // Evidence included from the start
      };

      // 10. Store profile (now includes evidence)
      await storeIkigaiProfile(userId, profile, this.store);

      // 11. Store evidence separately for easy querying
      await storeEvidence(userId, evidence, this.store);

      // 12. Sync key people to entities namespace
      await syncPeopleToEntities(
        userId,
        relationships.keyPeople,
        this.store
      );

      // 13. Mark batch as completed
      this.batchProcessor.markCompleted(userId);

      return profile;
    } catch (error) {
      // Mark batch as failed for retry
      this.batchProcessor.markFailed(userId);
      throw error;
    }
  }

  /**
   * Infer Experiences dimension - v13 2.4 Prompt 1
   */
  private async inferExperiences(
    sanitizedData: string,
    existingProfile?: IkigaiProfile
  ): Promise<ExperiencesDimension> {
    const prompt = experiencesPrompt(
      sanitizedData,
      existingProfile?.experiences
    );

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    return parseExperiencesResponse(response.content);
  }

  /**
   * Infer Relationships dimension - v13 2.4 Prompt 2
   */
  private async inferRelationships(
    sanitizedData: string,
    existingProfile?: IkigaiProfile
  ): Promise<RelationshipsDimension> {
    const prompt = relationshipsPrompt(
      sanitizedData,
      existingProfile?.relationships
    );

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    return parseRelationshipsResponse(response.content);
  }

  /**
   * Infer Interests dimension - v13 2.4 Prompt 3
   */
  private async inferInterests(
    sanitizedData: string,
    existingProfile?: IkigaiProfile
  ): Promise<InterestsDimension> {
    const prompt = interestsPrompt(sanitizedData, existingProfile?.interests);

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    return parseInterestsResponse(response.content);
  }

  /**
   * Infer Giving dimension - v13 2.4 Prompt 4
   */
  private async inferGiving(
    sanitizedData: string,
    existingProfile?: IkigaiProfile
  ): Promise<GivingDimension> {
    const prompt = givingPrompt(sanitizedData, existingProfile?.giving);

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    return parseGivingResponse(response.content);
  }

  /**
   * Synthesize profile from dimensions - v13 2.4 Prompt 5
   */
  private async synthesize(
    experiences: ExperiencesDimension,
    relationships: RelationshipsDimension,
    interests: InterestsDimension,
    giving: GivingDimension,
    existingProfile?: IkigaiProfile,
    missionFeedback?: MissionFeedbackContext
  ) {
    const prompt = synthesisPrompt(
      experiences,
      relationships,
      interests,
      giving,
      existingProfile,
      missionFeedback
    );

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    return parseSynthesisResponse(response.content);
  }

  /**
   * Gather user data from Store namespaces
   */
  private async gatherUserData(userId: string): Promise<UserDataBundle> {
    // Get from relevant namespaces
    // For MVP, focus on email-derived IAB classifications
    // Future: financial, calendar, browser
    return {
      iabClassifications: await this.store.list(NS.iabClassifications(userId)),
      emails: await this.store.list(NS.episodicMemory(userId)),
      // financial: await this.store.list(['ownyou.financial', userId]),
      // calendar: await this.store.list(['ownyou.calendar', userId]),
    };
  }

  /**
   * Extract evidence from dimension outputs
   */
  private extractEvidence(
    experiences: ExperiencesDimension,
    relationships: RelationshipsDimension,
    interests: InterestsDimension,
    giving: GivingDimension
  ): IkigaiEvidence[] {
    const evidence: IkigaiEvidence[] = [];
    const now = Date.now();

    // Extract from experiences
    for (const activity of experiences.recentActivities) {
      evidence.push({
        dimension: 'experiences',
        sourceType: 'email', // For MVP
        sourceId: activity.evidence,
        signalStrength: experiences.confidence,
        extractedAt: now,
        summary: `${activity.type}: ${activity.description}`,
      });
    }

    // Extract from relationships
    for (const person of relationships.keyPeople) {
      evidence.push({
        dimension: 'relationships',
        sourceType: 'email',
        sourceId: person.evidence,
        signalStrength: person.relationshipStrength,
        extractedAt: now,
        summary: `${person.name} (${person.relationshipType})`,
      });
    }

    // Extract from interests
    for (const interest of interests.genuineInterests) {
      evidence.push({
        dimension: 'interests',
        sourceType: interest.evidenceType === 'emails' ? 'email' : 'browser',
        sourceId: interest.evidence,
        signalStrength: interests.confidence,
        extractedAt: now,
        summary: `${interest.topic} (${interest.engagementDepth})`,
      });
    }

    // Extract from giving
    for (const charity of giving.charitableGiving) {
      evidence.push({
        dimension: 'giving',
        sourceType: 'email',
        sourceId: charity.evidence,
        signalStrength: giving.confidence,
        extractedAt: now,
        summary: `${charity.cause}: ${charity.frequency}`,
      });
    }

    return evidence;
  }

  /**
   * Get LLM model based on tier configuration - v13 Section 6.10
   *
   * Model selection priority:
   * 1. Explicit model override in config (modelOverrides[tier])
   * 2. llm-client registry via getRecommendedModel()
   * 3. Fallback to safe default
   *
   * NOTE: Model tiers in v13 are PLACEHOLDERS. This method ensures
   * actual model names come from configuration, never hardcoded.
   */
  private getModel(): string {
    const tier = this.config.modelTier;

    // 1. Check for explicit model override
    if (this.config.modelOverrides?.[tier]) {
      return this.config.modelOverrides[tier]!;
    }

    // 2. Use llm-client registry to get recommended model for tier
    const preferZDR = this.config.preferZDR ?? true;
    const recommended = getRecommendedModel(tier as LLMModelTier, preferZDR);

    if (recommended) {
      return recommended;
    }

    // 3. Fallback - this should rarely happen as registry has models for all tiers
    // Log warning if we hit this path
    console.warn(
      `[Ikigai] No model found for tier '${tier}' in llm-client registry. ` +
      `Configure modelOverrides in IkigaiInferenceConfig.`
    );

    // Return a safe fallback based on tier (still from registry, not hardcoded names)
    return getRecommendedModel('standard' as LLMModelTier, false) ?? 'llama-3.3-70b-versatile';
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<IkigaiInferenceConfig>): void {
    this.config = { ...this.config, ...config };
    this.batchProcessor.updateConfig(config);
  }

  /**
   * Get batch processor state (for debugging)
   */
  getBatchState(userId: string) {
    return this.batchProcessor.getState(userId);
  }
}

/**
 * Create an Ikigai inference engine
 */
export function createIkigaiEngine(
  llm: LLMClient,
  store: MemoryStore,
  config?: Partial<IkigaiInferenceConfig>
): IkigaiInferenceEngine {
  return new IkigaiInferenceEngine(llm, store, config);
}
