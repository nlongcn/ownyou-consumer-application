/**
 * LLM Wrapper for Analyzer Nodes
 *
 * Provides unified interface for calling LLM clients in IAB classification workflow.
 * Handles retries, error handling, and response parsing.
 *
 * Sprint 2: Simplified to use @ownyou/llm-client providers
 *
 * @see docs/sprints/ownyou-sprint2-spec.md
 */

import {
  LLMProviderType,
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider,
  GroqProvider,
  DeepInfraProvider,
  OllamaProvider,
  type LLMProvider,
  type LLMRequest as ProviderRequest,
  type LLMResponse as ProviderResponse,
  calculateModelCost,
} from '@ownyou/llm-client/providers';

// Cost tracker interface (stub for now - will be implemented with full cost tracking)
export interface CostTracker {
  track_call(params: {
    provider: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
  }): number;
}

// Workflow tracker interface (stub for dashboard analytics)
export interface WorkflowTracker {
  record_cost(params: {
    provider: string;
    cost: number;
    model_name: string;
    input_tokens: number;
    output_tokens: number;
  }): void;
}

// LLM Request interface for iab-classifier (extends base with json_mode)
export interface LLMRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model: string;
  max_tokens?: number;
  temperature?: number;
  json_mode?: boolean;
}

// LLM Response interface for iab-classifier
export interface LLMResponse {
  success: boolean;
  content: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Map provider name to LLMProviderType
 */
const PROVIDER_MAP: Record<string, LLMProviderType> = {
  openai: LLMProviderType.OPENAI,
  claude: LLMProviderType.ANTHROPIC,
  anthropic: LLMProviderType.ANTHROPIC,
  google: LLMProviderType.GOOGLE,
  gemini: LLMProviderType.GOOGLE,
  groq: LLMProviderType.GROQ,
  deepinfra: LLMProviderType.DEEPINFRA,
  ollama: LLMProviderType.OLLAMA,
};

/**
 * Default models per provider
 */
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  claude: 'claude-3-haiku-20240307',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-2.0-flash',
  gemini: 'gemini-2.0-flash',
  groq: 'llama-3.1-8b-instant',
  deepinfra: 'meta-llama/Llama-3.3-70B-Instruct',
  ollama: 'llama3.2',
};

/**
 * Unified LLM client for analyzer nodes with retry logic.
 *
 * Sprint 2: Now uses @ownyou/llm-client providers internally.
 */
export class AnalyzerLLMClient {
  provider: string;
  max_retries: number;
  cost_tracker: CostTracker | null;
  workflow_tracker: WorkflowTracker | null;
  model: string;
  llm_config: any;

  private _provider: LLMProvider;

  /**
   * Initialize LLM client for analyzer use.
   *
   * @param provider - "openai", "claude", "ollama", "groq", "deepinfra", or "google"
   * @param model - Specific model name (optional, uses default from client)
   * @param max_retries - Number of retry attempts on failure (default: 3)
   * @param cost_tracker - Optional CostTracker instance to track API costs
   * @param workflow_tracker - Optional WorkflowTracker instance for dashboard analytics
   * @param llm_config - Optional LLM configuration (API keys, etc.)
   */
  constructor(
    params: {
      provider?: string | null;
      model?: string | null;
      max_retries?: number;
      cost_tracker?: CostTracker | null;
      workflow_tracker?: WorkflowTracker | null;
      llm_config?: any;
    } = {}
  ) {
    // Parse model spec if it contains provider (format: "provider:model")
    let provider = params.provider;
    let model = params.model;

    if (model && model.includes(':')) {
      const [provider_from_model, model_name] = model.split(':', 2);
      if (provider === null || provider === undefined) {
        provider = provider_from_model;
      }
      model = model_name;
      console.debug(`Parsed model spec: provider=${provider}, model=${model}`);
    }

    // Default to LLM_PROVIDER from environment, or "openai" as fallback
    if (provider === null || provider === undefined) {
      provider = (globalThis as any).process?.env?.LLM_PROVIDER || 'openai';
    }

    this.provider = provider!.toLowerCase();
    this.max_retries = params.max_retries ?? 3;
    this.cost_tracker = params.cost_tracker ?? null;
    this.workflow_tracker = params.workflow_tracker ?? null;
    this.llm_config = params.llm_config ?? null;

    // Use provided model or fallback to default for provider
    this.model = model || DEFAULT_MODELS[this.provider] || 'gpt-4o-mini';

    // Initialize provider from @ownyou/llm-client
    this._provider = this._createProvider();

    console.info(`Initialized ${this.provider} LLM client for analyzers (model: ${this.model})`);
  }

  /**
   * Get environment variable from Vite or Node.
   * In browser (Vite), uses import.meta.env.VITE_*
   * In Node, uses process.env.*
   */
  private _getEnvVar(key: string): string {
    // Check llm_config first (passed explicitly)
    if (this.llm_config?.api_key) {
      return this.llm_config.api_key;
    }

    // Try Vite environment (import.meta.env)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
      const value = (import.meta as any).env[viteKey];
      if (value) return value;
    }

    // Try Node environment (process.env) via globalThis
    const proc = (globalThis as any).process;
    if (proc && proc.env) {
      const value = proc.env[key];
      if (value) return value;
    }

    return '';
  }

  /**
   * Create the appropriate LLM provider instance.
   */
  private _createProvider(): LLMProvider {
    const providerType = PROVIDER_MAP[this.provider];

    if (!providerType) {
      throw new Error(
        `Unknown provider: ${this.provider}. Must be 'claude', 'openai', 'ollama', 'groq', 'deepinfra', or 'google'`
      );
    }

    // Log API key status for debugging
    const hasApiKey = !!(this.llm_config?.api_key);
    console.debug(`[AnalyzerLLMClient] Creating ${this.provider} provider, hasApiKey=${hasApiKey}`);

    switch (providerType) {
      case LLMProviderType.OPENAI:
        return new OpenAIProvider({
          apiKey: this.llm_config?.api_key || this._getEnvVar('OPENAI_API_KEY'),
          model: this.model,
        });

      case LLMProviderType.ANTHROPIC:
        return new AnthropicProvider({
          apiKey: this.llm_config?.api_key || this._getEnvVar('ANTHROPIC_API_KEY'),
          model: this.model,
        });

      case LLMProviderType.GOOGLE:
        return new GoogleProvider({
          apiKey: this.llm_config?.api_key || this._getEnvVar('GOOGLE_API_KEY'),
          model: this.model,
        });

      case LLMProviderType.GROQ:
        return new GroqProvider({
          apiKey: this.llm_config?.api_key || this._getEnvVar('GROQ_API_KEY'),
          model: this.model,
        });

      case LLMProviderType.DEEPINFRA:
        return new DeepInfraProvider({
          apiKey: this.llm_config?.api_key || this._getEnvVar('DEEPINFRA_API_KEY'),
          model: this.model,
        });

      case LLMProviderType.OLLAMA:
        return new OllamaProvider({
          baseUrl: this.llm_config?.base_url || this._getEnvVar('OLLAMA_HOST') || 'http://localhost:11434',
          model: this.model,
        });

      default:
        throw new Error(`Provider ${this.provider} not implemented`);
    }
  }

  /**
   * Analyze email using LLM with retry logic.
   *
   * @param prompt - Complete prompt with email content and instructions
   * @param max_tokens - Maximum response tokens (default: 1000)
   * @param temperature - Sampling temperature, lower = more deterministic (default: 0.1)
   * @returns Parsed JSON response with classifications array
   */
  async analyze_email(params: {
    prompt: string;
    max_tokens?: number | null;
    temperature?: number;
  }): Promise<Record<string, any>> {
    const { prompt, max_tokens = null, temperature = 0.1 } = params;

    console.info(`analyze_email: max_tokens=${max_tokens} (will be auto-adjusted by client)`);
    console.debug('[DEBUG] Prompt length:', prompt.length, 'characters');

    const request: ProviderRequest = {
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
      maxTokens: max_tokens ?? undefined,
      temperature,
    };

    for (let attempt = 1; attempt <= this.max_retries; attempt++) {
      try {
        console.debug(`LLM call attempt ${attempt}/${this.max_retries}`);

        // Call LLM via @ownyou/llm-client provider
        const response = await this._provider.complete(request);

        if (response.error) {
          throw new Error(`LLM call failed: ${response.error}`);
        }

        // Parse JSON response
        console.debug('[DEBUG] Raw LLM response content:', response.content.substring(0, 500));
        const result = this._parseJsonResponse(response.content);
        console.debug('[DEBUG] Parsed result:', JSON.stringify(result).substring(0, 500));

        // Validate structure
        if (typeof result !== 'object' || result === null || Array.isArray(result)) {
          throw new Error('Response is not a JSON object');
        }

        if (!('classifications' in result)) {
          console.warn('Response missing "classifications" key, adding empty array');
          result.classifications = [];
        }

        // Track costs if tracker provided
        if (this.cost_tracker && response.usage) {
          const prompt_tokens = response.usage.inputTokens || 0;
          const completion_tokens = response.usage.outputTokens || 0;

          if (prompt_tokens > 0 || completion_tokens > 0) {
            const cost = this.cost_tracker.track_call({
              provider: this.provider,
              model: this.model,
              prompt_tokens,
              completion_tokens,
            });
            console.debug(`Tracked LLM cost: $${cost.toFixed(6)} USD`);

            if (this.workflow_tracker) {
              this.workflow_tracker.record_cost({
                provider: this.provider,
                cost,
                model_name: this.model,
                input_tokens: prompt_tokens,
                output_tokens: completion_tokens,
              });
            }
          }
        }

        console.info('LLM call successful', {
          provider: this.provider,
          attempt,
          tokens: response.usage.totalTokens || 0,
          classifications: (result.classifications || []).length,
        });

        return result;
      } catch (error) {
        if (error instanceof SyntaxError || (error as any).name === 'SyntaxError') {
          console.warn(`JSON parse error (attempt ${attempt}/${this.max_retries}): ${error}`);

          if (attempt < this.max_retries) {
            await this._sleep(2 ** (attempt - 1) * 1000);
            continue;
          } else {
            console.error('All retry attempts failed due to JSON parsing errors');
            return { classifications: [] };
          }
        }

        console.error(`LLM call error (attempt ${attempt}/${this.max_retries}): ${error}`, error);

        if (attempt < this.max_retries) {
          await this._sleep(2 ** (attempt - 1) * 1000);
          continue;
        } else {
          console.error('All retry attempts exhausted');
          throw error;
        }
      }
    }

    return { classifications: [] };
  }

  /**
   * Call LLM and parse JSON response without enforcing specific structure.
   *
   * This is useful for LLM-as-Judge and other tasks that don't return
   * classifications.
   *
   * @param prompt - Complete prompt
   * @param max_tokens - Maximum response tokens
   * @param temperature - Sampling temperature (default: 0.1)
   * @returns Parsed JSON response as-is
   */
  async call_json(params: {
    prompt: string;
    max_tokens?: number | null;
    temperature?: number;
  }): Promise<Record<string, any>> {
    const { prompt, temperature = 0.1 } = params;
    let { max_tokens = null } = params;

    if (max_tokens === null || max_tokens === undefined) {
      max_tokens = 100000;
      console.info(
        `call_json: max_tokens=null, using ceiling of ${max_tokens} (will be auto-adjusted by client)`
      );
    }

    const request: ProviderRequest = {
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
      maxTokens: max_tokens,
      temperature,
    };

    for (let attempt = 1; attempt <= this.max_retries; attempt++) {
      try {
        console.debug(`LLM call_json attempt ${attempt}/${this.max_retries}`);

        const response = await this._provider.complete(request);

        if (response.error) {
          throw new Error(`LLM call failed: ${response.error}`);
        }

        const result = this._parseJsonResponse(response.content);

        if (typeof result !== 'object' || result === null || Array.isArray(result)) {
          throw new Error('Response is not a JSON object');
        }

        // Track costs
        if (this.cost_tracker && response.usage) {
          const prompt_tokens = response.usage.inputTokens || 0;
          const completion_tokens = response.usage.outputTokens || 0;

          if (prompt_tokens > 0 || completion_tokens > 0) {
            const cost = this.cost_tracker.track_call({
              provider: this.provider,
              model: this.model,
              prompt_tokens,
              completion_tokens,
            });
            console.debug(`Tracked LLM cost: $${cost.toFixed(6)} USD`);

            if (this.workflow_tracker) {
              this.workflow_tracker.record_cost({
                provider: this.provider,
                cost,
                model_name: this.model,
                input_tokens: prompt_tokens,
                output_tokens: completion_tokens,
              });
            }
          }
        }

        console.debug(`call_json successful (keys: ${Object.keys(result).join(', ')})`);
        return result;
      } catch (error) {
        if (error instanceof SyntaxError || (error as any).name === 'SyntaxError') {
          console.warn(`JSON parse error (attempt ${attempt}/${this.max_retries}): ${error}`);

          if (attempt < this.max_retries) {
            await this._sleep(2 ** (attempt - 1) * 1000);
            continue;
          } else {
            console.error('All retry attempts failed due to JSON parsing errors');
            throw error;
          }
        }

        console.error(`call_json error (attempt ${attempt}/${this.max_retries}): ${error}`, error);

        if (attempt < this.max_retries) {
          await this._sleep(2 ** (attempt - 1) * 1000);
          continue;
        } else {
          console.error('All retry attempts exhausted');
          throw error;
        }
      }
    }

    throw new Error('call_json: max retries exceeded');
  }

  /**
   * Parse JSON from LLM response, handling common formatting issues.
   */
  private _parseJsonResponse(content: string): Record<string, any> {
    content = content.trim();

    // Remove markdown code blocks if present
    if (content.startsWith('```json')) {
      content = content.slice(7);
    }
    if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }

    content = content.trim();

    try {
      return JSON.parse(content);
    } catch (error) {
      // Try to extract JSON from text
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');

      if (start !== -1 && end !== -1) {
        content = content.slice(start, end + 1);
        return JSON.parse(content);
      } else {
        throw error;
      }
    }
  }

  /**
   * Estimate cost of LLM call using @ownyou/llm-client pricing.
   */
  estimate_cost(params: { prompt_tokens: number; response_tokens: number }): number | null {
    const { prompt_tokens, response_tokens } = params;

    try {
      return calculateModelCost(this.model, prompt_tokens, response_tokens);
    } catch {
      // Fallback pricing for unknown models
      const fallbackPricing: Record<string, { prompt: number; response: number }> = {
        claude: { prompt: 3.0 / 1_000_000, response: 15.0 / 1_000_000 },
        openai: { prompt: 0.15 / 1_000_000, response: 0.6 / 1_000_000 },
        ollama: { prompt: 0.0, response: 0.0 },
        groq: { prompt: 0.59 / 1_000_000, response: 0.79 / 1_000_000 },
        deepinfra: { prompt: 0.35 / 1_000_000, response: 0.4 / 1_000_000 },
        google: { prompt: 0.075 / 1_000_000, response: 0.3 / 1_000_000 },
      };

      if (!(this.provider in fallbackPricing)) {
        return null;
      }

      const rates = fallbackPricing[this.provider];
      return prompt_tokens * rates.prompt + response_tokens * rates.response;
    }
  }

  /**
   * Sleep for specified milliseconds (utility for exponential backoff).
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default AnalyzerLLMClient;
