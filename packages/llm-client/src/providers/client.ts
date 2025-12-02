/**
 * LLM Client - v13 Section 6.10-6.11
 *
 * High-level client with budget management and circuit breaker.
 */

import type { LLMProvider, LLMRequest, LLMResponse, ModelTier, OperationType } from './types';
import { OPERATION_LIMITS } from './types';
import { BudgetManager, type BudgetConfig, type UsageSummary } from '../budget';

/**
 * Client request with user context
 */
export interface ClientRequest extends Omit<LLMRequest, 'model'> {
  model?: string;
  modelTier?: ModelTier;
  operation: OperationType;
  urgent?: boolean;
}

/**
 * Client configuration
 */
export interface LLMClientConfig {
  provider: LLMProvider;
  budgetConfig?: BudgetConfig;
}

/**
 * Budget exceeded error
 */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Request deferred error
 */
export class RequestDeferredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestDeferredError';
  }
}

/**
 * LLMClient - Unified LLM client with budget enforcement
 */
export class LLMClient {
  private provider: LLMProvider;
  private budgetManager: BudgetManager;

  constructor(config: LLMClientConfig) {
    this.provider = config.provider;
    this.budgetManager = new BudgetManager(config.budgetConfig);
  }

  /**
   * Complete a request with budget enforcement
   */
  async complete(userId: string, request: ClientRequest): Promise<LLMResponse> {
    // Get current budget status
    const decision = await this.budgetManager.getThrottleDecision(userId);

    // Handle budget exceeded
    if (decision.action === 'block') {
      throw new BudgetExceededError('Budget exceeded');
    }

    // Handle defer for non-urgent
    if (decision.action === 'defer' && !request.urgent) {
      throw new RequestDeferredError('Request deferred');
    }

    // Select model based on budget and request
    let model = request.model;
    let throttled = false;

    if (!model) {
      const tier = request.modelTier ?? OPERATION_LIMITS[request.operation].modelTier;
      model = this.budgetManager.selectModel(tier, decision.budgetPercent);

      // Check if we downgraded
      if (decision.action === 'downgrade' && request.modelTier === 'quality') {
        throttled = true;
      }
    } else if (decision.action === 'downgrade') {
      // Downgrade specified model if needed
      model = this.budgetManager.selectModel('standard', decision.budgetPercent);
      throttled = true;
    }

    // Apply operation limits
    const opLimits = OPERATION_LIMITS[request.operation];
    const maxTokens = Math.min(request.maxTokens ?? opLimits.maxOutputTokens, opLimits.maxOutputTokens);

    // Execute request
    const providerRequest: LLMRequest = {
      messages: request.messages,
      model,
      maxTokens,
      temperature: request.temperature,
    };

    const response = await this.provider.complete(providerRequest);

    // Track usage
    await this.budgetManager.trackUsage(userId, {
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: response.usage.costUsd,
      operation: request.operation,
      timestamp: Date.now(),
    });

    return {
      ...response,
      throttled,
    };
  }

  /**
   * Get usage summary for a user
   */
  async getUsage(userId: string): Promise<UsageSummary> {
    return this.budgetManager.getCurrentUsage(userId);
  }

  /**
   * Set usage for testing
   */
  async setUsageForTesting(userId: string, costUsd: number): Promise<void> {
    await this.budgetManager.setUsageForTesting(userId, costUsd);
  }

  /**
   * Reset monthly usage
   */
  async resetUsage(userId: string): Promise<void> {
    await this.budgetManager.resetMonthlyUsage(userId);
  }
}
