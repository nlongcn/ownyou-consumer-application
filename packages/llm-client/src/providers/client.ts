/**
 * LLM Client - v13 Section 6.10-6.11
 *
 * High-level client with budget management, circuit breaker, and fallback chain.
 *
 * Fallback Chain (v13 Section 6.11.3):
 * 1. Original request with primary provider
 * 2. Retry same model (up to 3 times with exponential backoff)
 * 3. Downgrade to cheaper model
 * 4. Try alternative provider (e.g., OpenAI → Anthropic)
 * 5. Check cache for similar requests
 * 6. Use local LLM (WebLLM) as last resort
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import type { LLMProvider, LLMRequest, LLMResponse, ModelTier, OperationType } from './types';
import { OPERATION_LIMITS } from './types';
import { BudgetManager, type BudgetConfig, type UsageSummary } from '../budget';
import { LLMCache, type CacheStore } from '../cache';
import { LLMProviderType } from './base';

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
 * Extended response with fallback metadata
 */
export interface FallbackResponse extends LLMResponse {
  fromCache?: boolean;
  fallbackUsed?: string;
  retriesAttempted?: number;
}

/**
 * Fallback step in the chain
 */
interface FallbackStep {
  provider: LLMProvider;
  providerType: LLMProviderType;
  model: string;
  reason: string;
}

/**
 * Client configuration with multiple providers
 */
export interface LLMClientConfig {
  /** Primary provider (required) */
  provider: LLMProvider;
  /** Provider type for primary provider */
  providerType?: LLMProviderType;
  /** Budget configuration */
  budgetConfig?: BudgetConfig;
  /** Cache store for response caching */
  cacheStore?: CacheStore;
  /** Fallback providers (optional) */
  fallbackProviders?: Map<LLMProviderType, LLMProvider>;
  /** Max retries per step (default: 2) */
  maxRetries?: number;
  /** Retry base delay in ms (default: 1000) */
  retryBaseDelay?: number;
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
 * All fallback options exhausted error
 */
export class AllFallbacksExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllFallbacksExhaustedError';
  }
}

/**
 * Model downgrade mappings (quality → standard → fast)
 */
const MODEL_DOWNGRADES: Record<string, string> = {
  // OpenAI downgrades
  'gpt-4o': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4o-mini',
  // Anthropic downgrades
  'claude-3-5-sonnet-20241022': 'claude-3-haiku-20240307',
  'claude-3-opus-20240229': 'claude-3-5-sonnet-20241022',
  // Google downgrades
  'gemini-1.5-pro': 'gemini-2.0-flash',
  // Groq downgrades
  'llama-3.3-70b-versatile': 'llama-3.1-8b-instant',
  'mixtral-8x7b-32768': 'llama-3.1-8b-instant',
};

/**
 * Alternative provider mappings
 */
const ALTERNATIVE_PROVIDERS: Record<LLMProviderType, LLMProviderType[]> = {
  [LLMProviderType.OPENAI]: [LLMProviderType.ANTHROPIC, LLMProviderType.GOOGLE, LLMProviderType.GROQ],
  [LLMProviderType.ANTHROPIC]: [LLMProviderType.OPENAI, LLMProviderType.GOOGLE, LLMProviderType.GROQ],
  [LLMProviderType.GOOGLE]: [LLMProviderType.OPENAI, LLMProviderType.ANTHROPIC, LLMProviderType.GROQ],
  [LLMProviderType.GROQ]: [LLMProviderType.DEEPINFRA, LLMProviderType.OPENAI, LLMProviderType.ANTHROPIC],
  [LLMProviderType.DEEPINFRA]: [LLMProviderType.GROQ, LLMProviderType.OPENAI],
  [LLMProviderType.OLLAMA]: [LLMProviderType.WEBLLM],
  [LLMProviderType.WEBLLM]: [LLMProviderType.OLLAMA],
  [LLMProviderType.MOCK]: [],
};

/**
 * Default models per provider
 */
const DEFAULT_MODELS: Record<LLMProviderType, string> = {
  [LLMProviderType.OPENAI]: 'gpt-4o-mini',
  [LLMProviderType.ANTHROPIC]: 'claude-3-haiku-20240307',
  [LLMProviderType.GOOGLE]: 'gemini-2.0-flash',
  [LLMProviderType.GROQ]: 'llama-3.1-8b-instant',
  [LLMProviderType.DEEPINFRA]: 'meta-llama/Llama-3.3-70B-Instruct',
  [LLMProviderType.OLLAMA]: 'llama3.2',
  [LLMProviderType.WEBLLM]: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  [LLMProviderType.MOCK]: 'mock',
};

/**
 * LLMClient - Unified LLM client with budget enforcement and fallback chain
 */
export class LLMClient {
  private providers: Map<LLMProviderType, LLMProvider>;
  private primaryProviderType: LLMProviderType;
  private budgetManager: BudgetManager;
  private cache: LLMCache | null;
  private maxRetries: number;
  private retryBaseDelay: number;

  constructor(config: LLMClientConfig) {
    this.providers = new Map();
    this.primaryProviderType = config.providerType ?? LLMProviderType.OPENAI;
    this.providers.set(this.primaryProviderType, config.provider);

    // Add fallback providers
    if (config.fallbackProviders) {
      for (const [type, provider] of config.fallbackProviders) {
        this.providers.set(type, provider);
      }
    }

    this.budgetManager = new BudgetManager(config.budgetConfig);
    this.cache = config.cacheStore ? new LLMCache(config.cacheStore) : null;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryBaseDelay = config.retryBaseDelay ?? 1000;
  }

  /**
   * Register an additional provider
   */
  registerProvider(type: LLMProviderType, provider: LLMProvider): void {
    this.providers.set(type, provider);
  }

  /**
   * Complete a request with budget enforcement (single provider)
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
      operation: request.operation,
    };

    const provider = this.providers.get(this.primaryProviderType);
    if (!provider) {
      throw new Error(`Primary provider ${this.primaryProviderType} not found`);
    }

    const response = await provider.complete(providerRequest);

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
   * Complete a request with full fallback chain (v13 Section 6.11.3)
   */
  async completeWithFallback(userId: string, request: ClientRequest): Promise<FallbackResponse> {
    // 1. Check cache FIRST (before any provider calls)
    if (this.cache) {
      const cached = await this.cache.get(userId, this.toProviderRequest(request));
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    // 2. Check budget
    const decision = await this.budgetManager.getThrottleDecision(userId);

    // Handle budget exceeded - try cache/local only
    if (decision.action === 'block') {
      return this.handleBudgetBlocked(userId, request);
    }

    // Handle defer for non-urgent - try cache
    if (decision.action === 'defer' && !request.urgent) {
      if (this.cache) {
        const cached = await this.cache.get(userId, this.toProviderRequest(request));
        if (cached) {
          return { ...cached, fromCache: true };
        }
      }
      throw new RequestDeferredError('Request deferred, no cache available');
    }

    // 3. Build fallback chain
    const chain = this.buildFallbackChain(request, decision);

    // 4. Execute with retries and fallback
    let lastError: Error | null = null;
    let retriesAttempted = 0;

    for (const step of chain) {
      try {
        const response = await this.executeWithRetry(step, request);
        retriesAttempted += response.retriesAttempted ?? 0;

        // Track usage
        await this.budgetManager.trackUsage(userId, {
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          costUsd: response.usage.costUsd,
          operation: request.operation,
          timestamp: Date.now(),
        });

        // 5. Cache successful response
        if (this.cache) {
          await this.cache.set(userId, this.toProviderRequest(request), response);
        }

        return {
          ...response,
          fallbackUsed: step.reason !== 'primary' ? step.reason : undefined,
          retriesAttempted,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next fallback
      }
    }

    // 6. All fallbacks exhausted
    throw new AllFallbacksExhaustedError(
      `All fallback options exhausted. Last error: ${lastError?.message ?? 'unknown'}`
    );
  }

  /**
   * Handle budget blocked - try local providers only
   */
  private async handleBudgetBlocked(userId: string, request: ClientRequest): Promise<FallbackResponse> {
    // Try WebLLM first (free)
    const webllm = this.providers.get(LLMProviderType.WEBLLM);
    if (webllm) {
      try {
        const available = await webllm.isAvailable();
        if (available) {
          const response = await webllm.complete(this.toProviderRequest(request));
          return { ...response, fallbackUsed: 'webllm-budget-blocked' };
        }
      } catch {
        // Continue to next option
      }
    }

    // Try Ollama (free)
    const ollama = this.providers.get(LLMProviderType.OLLAMA);
    if (ollama) {
      try {
        const available = await ollama.isAvailable();
        if (available) {
          const response = await ollama.complete(this.toProviderRequest(request));
          return { ...response, fallbackUsed: 'ollama-budget-blocked' };
        }
      } catch {
        // Continue to next option
      }
    }

    // Check cache as last resort
    if (this.cache) {
      const cached = await this.cache.get(userId, this.toProviderRequest(request));
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    throw new BudgetExceededError('Budget exceeded and no free providers available');
  }

  /**
   * Build the fallback chain based on budget and request
   */
  private buildFallbackChain(
    request: ClientRequest,
    decision: { action: string; budgetPercent: number }
  ): FallbackStep[] {
    const chain: FallbackStep[] = [];
    const primaryProvider = this.providers.get(this.primaryProviderType);

    if (!primaryProvider) {
      throw new Error(`Primary provider ${this.primaryProviderType} not configured`);
    }

    // Select model based on budget
    const tier = request.modelTier ?? OPERATION_LIMITS[request.operation].modelTier;
    let model = request.model ?? this.budgetManager.selectModel(tier, decision.budgetPercent);

    // Step 1: Primary request
    chain.push({
      provider: primaryProvider,
      providerType: this.primaryProviderType,
      model,
      reason: 'primary',
    });

    // Step 2: Downgrade model (if applicable)
    const downgradedModel = MODEL_DOWNGRADES[model];
    if (downgradedModel) {
      chain.push({
        provider: primaryProvider,
        providerType: this.primaryProviderType,
        model: downgradedModel,
        reason: 'model-downgrade',
      });
    }

    // Step 3: Alternative providers
    const alternatives = ALTERNATIVE_PROVIDERS[this.primaryProviderType] ?? [];
    for (const altType of alternatives) {
      const altProvider = this.providers.get(altType);
      if (altProvider) {
        const altModel = DEFAULT_MODELS[altType];
        chain.push({
          provider: altProvider,
          providerType: altType,
          model: altModel,
          reason: `alternative-${altType}`,
        });
      }
    }

    // Step 4: Local providers (free)
    if (!this.providers.has(LLMProviderType.WEBLLM)) {
      // WebLLM not in chain yet
    }
    const webllm = this.providers.get(LLMProviderType.WEBLLM);
    if (webllm && !chain.some((s) => s.providerType === LLMProviderType.WEBLLM)) {
      chain.push({
        provider: webllm,
        providerType: LLMProviderType.WEBLLM,
        model: DEFAULT_MODELS[LLMProviderType.WEBLLM],
        reason: 'local-webllm',
      });
    }

    const ollama = this.providers.get(LLMProviderType.OLLAMA);
    if (ollama && !chain.some((s) => s.providerType === LLMProviderType.OLLAMA)) {
      chain.push({
        provider: ollama,
        providerType: LLMProviderType.OLLAMA,
        model: DEFAULT_MODELS[LLMProviderType.OLLAMA],
        reason: 'local-ollama',
      });
    }

    return chain;
  }

  /**
   * Execute a fallback step with retries
   */
  private async executeWithRetry(
    step: FallbackStep,
    request: ClientRequest
  ): Promise<FallbackResponse> {
    const opLimits = OPERATION_LIMITS[request.operation];
    const maxTokens = Math.min(request.maxTokens ?? opLimits.maxOutputTokens, opLimits.maxOutputTokens);

    const providerRequest: LLMRequest = {
      messages: request.messages,
      model: step.model,
      maxTokens,
      temperature: request.temperature,
      operation: request.operation,
    };

    let lastError: Error | null = null;
    let retries = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Check provider availability first
        const available = await step.provider.isAvailable();
        if (!available) {
          throw new Error(`Provider ${step.providerType} is not available`);
        }

        const response = await step.provider.complete(providerRequest);

        // Check for error in response
        if (response.error) {
          throw new Error(response.error);
        }

        return { ...response, retriesAttempted: retries };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries++;

        // Exponential backoff
        if (attempt < this.maxRetries) {
          const delay = this.retryBaseDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Unknown error during retry');
  }

  /**
   * Convert ClientRequest to LLMRequest
   */
  private toProviderRequest(request: ClientRequest): LLMRequest {
    const opLimits = OPERATION_LIMITS[request.operation];
    return {
      messages: request.messages,
      model: request.model,
      maxTokens: Math.min(request.maxTokens ?? opLimits.maxOutputTokens, opLimits.maxOutputTokens),
      temperature: request.temperature,
      operation: request.operation,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  /**
   * Get the cache instance (for direct cache operations)
   */
  getCache(): LLMCache | null {
    return this.cache;
  }

  /**
   * Get registered providers
   */
  getProviders(): Map<LLMProviderType, LLMProvider> {
    return new Map(this.providers);
  }
}
