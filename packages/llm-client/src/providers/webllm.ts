/**
 * WebLLM Provider - v13 Section 6.10-6.11
 *
 * Provider for browser-local LLM inference via WebLLM.
 *
 * Key features:
 * - 100% browser-local inference (no server needed)
 * - Zero data retention (runs in browser)
 * - Uses WebGPU for acceleration
 * - Supports quantized models for memory efficiency
 *
 * NOTE: WebLLM requires WebGPU support in the browser.
 * Check compatibility at: https://webgpu.io
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 * @see https://webllm.mlc.ai/
 */

import { BaseLLMProvider, LLMProviderType } from './base';
import type { ProviderConfig } from './base';
import type { LLMRequest, LLMResponse } from './types';

/**
 * WebLLM provider configuration
 */
export interface WebLLMProviderConfig extends ProviderConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  onProgress?: (progress: number, status: string) => void;
}

/**
 * Supported WebLLM models with context windows
 */
const WEBLLM_MODELS: Record<string, { contextWindow: number; description: string }> = {
  'Llama-3.2-3B-Instruct-q4f16_1-MLC': {
    contextWindow: 4096,
    description: 'Llama 3.2 3B - Good balance of size and quality',
  },
  'Llama-3.2-1B-Instruct-q4f16_1-MLC': {
    contextWindow: 4096,
    description: 'Llama 3.2 1B - Smallest, fastest option',
  },
  'Phi-3.5-mini-instruct-q4f16_1-MLC': {
    contextWindow: 4096,
    description: 'Phi 3.5 Mini - Microsoft small model',
  },
  'Mistral-7B-Instruct-v0.3-q4f16_1-MLC': {
    contextWindow: 4096,
    description: 'Mistral 7B - High quality, larger size',
  },
  'gemma-2-2b-it-q4f16_1-MLC': {
    contextWindow: 4096,
    description: 'Gemma 2 2B - Google small model',
  },
};

/**
 * WebLLM Engine Singleton - manages shared engine state
 *
 * Using singleton pattern to:
 * - Share engine across multiple WebLLMProvider instances
 * - Prevent multiple concurrent model loads
 * - Properly manage memory when switching models
 */
class WebLLMEngineSingleton {
  private static instance: WebLLMEngineSingleton;
  private engine: any = null;
  private currentModel: string | null = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): WebLLMEngineSingleton {
    if (!WebLLMEngineSingleton.instance) {
      WebLLMEngineSingleton.instance = new WebLLMEngineSingleton();
    }
    return WebLLMEngineSingleton.instance;
  }

  getEngine(): any {
    return this.engine;
  }

  getCurrentModel(): string | null {
    return this.currentModel;
  }

  isModelLoaded(): boolean {
    return this.engine !== null && this.currentModel !== null;
  }

  async loadModel(
    model: string,
    onProgress?: (progress: number, status: string) => void,
    logger?: { info: (msg: string) => void; debug: (msg: string, data?: any) => void }
  ): Promise<void> {
    // Already loaded with same model
    if (this.engine && this.currentModel === model) {
      return;
    }

    // If already loading, wait for that to complete
    if (this.isLoading && this.loadPromise) {
      await this.loadPromise;
      // Check if the loaded model is what we need
      if (this.currentModel === model) {
        return;
      }
    }

    // Start loading
    this.isLoading = true;
    this.loadPromise = this._doLoadModel(model, onProgress, logger);

    try {
      await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async _doLoadModel(
    model: string,
    onProgress?: (progress: number, status: string) => void,
    logger?: { info: (msg: string) => void; debug: (msg: string, data?: any) => void }
  ): Promise<void> {
    logger?.info(`Loading WebLLM model: ${model}`);

    // Unload existing model if different
    if (this.engine && this.currentModel !== model) {
      await this.unload(logger);
    }

    // Dynamic import to avoid SSR issues
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

    // Progress callback
    const progressCallback = (progress: any) => {
      const percent = Math.round(progress.progress * 100);
      const status = progress.text ?? 'Loading...';
      logger?.debug(`WebLLM loading: ${percent}% - ${status}`);
      onProgress?.(percent, status);
    };

    this.engine = await CreateMLCEngine(model, {
      initProgressCallback: progressCallback,
    });

    this.currentModel = model;
    logger?.info(`WebLLM model loaded: ${model}`);
  }

  async unload(logger?: { info: (msg: string) => void; debug: (msg: string, data?: any) => void }): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch (error) {
        logger?.debug(`Error unloading WebLLM: ${error}`);
      }
      this.engine = null;
      this.currentModel = null;
      logger?.info('WebLLM model unloaded');
    }
  }
}

/**
 * WebLLM Provider - Browser-local inference
 */
export class WebLLMProvider extends BaseLLMProvider {
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;
  private onProgress?: (progress: number, status: string) => void;
  private engineSingleton: WebLLMEngineSingleton;

  constructor(config: WebLLMProviderConfig) {
    super(config);

    this.defaultModel = config.model ?? 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
    this.defaultMaxTokens = config.maxTokens ?? 2048;
    this.defaultTemperature = config.temperature ?? 0.7;
    this.onProgress = config.onProgress;
    this.engineSingleton = WebLLMEngineSingleton.getInstance();
  }

  getProviderType(): LLMProviderType {
    return LLMProviderType.WEBLLM;
  }

  getSupportedModels(): string[] {
    return Object.keys(WEBLLM_MODELS);
  }

  async isAvailable(): Promise<boolean> {
    // Check WebGPU support
    if (typeof navigator === 'undefined') {
      return false; // Not in browser
    }

    try {
      // @ts-ignore - WebGPU types may not be available
      const gpu = navigator.gpu;
      if (!gpu) {
        this.logger.debug('WebGPU not available in this browser');
        return false;
      }
      const adapter = await gpu.requestAdapter();
      return adapter !== null;
    } catch (error) {
      this.logger.debug(`WebGPU check failed: ${error}`);
      return false;
    }
  }

  /**
   * Load the WebLLM engine and model
   */
  async loadModel(modelId?: string): Promise<void> {
    const model = modelId ?? this.defaultModel;
    await this.engineSingleton.loadModel(model, this.onProgress, this.logger);
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.engineSingleton.isModelLoaded();
  }

  /**
   * Get current loaded model
   */
  getCurrentModel(): string | null {
    return this.engineSingleton.getCurrentModel();
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model ?? this.defaultModel;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;
    const temperature = request.temperature ?? this.defaultTemperature;

    // Validate request
    const errors = this.validateRequest(request);
    if (errors.length > 0) {
      return this.createErrorResponse(errors.join('; '), model);
    }

    // Check WebGPU availability
    const available = await this.isAvailable();
    if (!available) {
      return this.createErrorResponse(
        'WebGPU is not available. WebLLM requires a WebGPU-capable browser.',
        model
      );
    }

    // Load model if needed
    try {
      await this.loadModel(model);
    } catch (error) {
      const errorMsg = `Failed to load WebLLM model: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('WebLLM model loading failed', { model, error: errorMsg });
      return this.createErrorResponse(errorMsg, model);
    }

    // Format messages
    const messages = request.messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    this.logger.info(`Using model: ${model} for WebLLM request`);
    const startTime = Date.now();

    try {
      const engine = this.engineSingleton.getEngine();
      const response = await engine.chat.completions.create({
        messages,
        max_tokens: maxTokens,
        temperature,
      });

      const processingTime = (Date.now() - startTime) / 1000;

      const content = response.choices?.[0]?.message?.content ?? '';
      const usage = response.usage ?? {};
      const inputTokens = usage.prompt_tokens ?? 0;
      const outputTokens = usage.completion_tokens ?? 0;
      const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;

      this.logger.debug('Received response from WebLLM', {
        model,
        content_length: content.length,
        processing_time: processingTime,
        tokens_used: totalTokens,
      });

      return {
        content,
        model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          costUsd: 0, // Browser-local inference is free
        },
        finishReason: response.choices?.[0]?.finish_reason as 'stop' | 'length' | 'content_filter',
      };
    } catch (error) {
      const processingTime = (Date.now() - startTime) / 1000;
      const errorMsg = `WebLLM error: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('WebLLM generation failed', { model, error: errorMsg, processingTime });
      return this.createErrorResponse(errorMsg, model);
    }
  }

  /**
   * Unload the model to free memory
   */
  async unload(): Promise<void> {
    await this.engineSingleton.unload(this.logger);
  }
}
