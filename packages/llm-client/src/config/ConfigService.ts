/**
 * LLM Configuration Service - v13 Section 6.10
 *
 * Dynamic configuration service for LLM models and pricing.
 * Fetches from remote sources and caches locally.
 *
 * @example
 * ```typescript
 * import { configService } from '@ownyou/llm-client';
 *
 * // Get pricing for cost calculation
 * const pricing = await configService.getPricing('gpt-4o-mini');
 *
 * // Get models for a provider
 * const models = await configService.getModelsByProvider('openai');
 * ```
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import type {
  LLMProviderConfig,
  ModelMetadata,
  ModelPricing,
  FallbackModel,
  CacheStatus,
  Provider,
  Tier,
} from './types';
import { BUNDLED_DEFAULTS, DEFAULT_CACHE_TTL_MS } from './defaults';
import { fetchFromLLMPrices } from './sources/llmPrices';
import { fetchFromOpenRouter } from './sources/openRouter';

/**
 * Storage interface for caching
 * Abstracted to support both browser (IndexedDB) and Node (memory/file)
 */
interface ConfigStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Simple in-memory storage for environments without IndexedDB
 */
class InMemoryStorage implements ConfigStorage {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * IndexedDB storage for browser environments
 */
class IndexedDBStorage implements ConfigStorage {
  private dbName = 'ownyou-config';
  private storeName = 'llm-config';
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result ?? null);
      });
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.put(value, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch {
      // Silently fail storage - memory cache will still work
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch {
      // Silently fail
    }
  }
}

/**
 * Create appropriate storage for the environment
 */
const createStorage = (): ConfigStorage => {
  if (typeof indexedDB !== 'undefined') {
    return new IndexedDBStorage();
  }
  return new InMemoryStorage();
};

const STORAGE_KEY = 'llm-provider-config';

/**
 * ConfigService - Singleton for LLM configuration management
 */
class ConfigServiceImpl {
  private memoryCache: LLMProviderConfig | null = null;
  private memoryCacheExpiry: number = 0;
  private storage: ConfigStorage;
  private fetchPromise: Promise<LLMProviderConfig> | null = null;

  constructor() {
    this.storage = createStorage();
  }

  /**
   * Get the full configuration (cached)
   */
  async getConfig(): Promise<LLMProviderConfig> {
    // 1. Check memory cache
    if (this.memoryCache && Date.now() < this.memoryCacheExpiry) {
      return this.memoryCache;
    }

    // 2. Check storage cache
    try {
      const stored = await this.storage.get(STORAGE_KEY);
      if (stored) {
        const { config, expiry } = JSON.parse(stored);
        if (Date.now() < expiry) {
          this.memoryCache = config;
          this.memoryCacheExpiry = expiry;
          return config;
        }
      }
    } catch {
      // Storage error - continue to fetch
    }

    // 3. Fetch from remote (with deduplication)
    if (!this.fetchPromise) {
      this.fetchPromise = this.fetchAndCache();
    }

    try {
      return await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Fetch from remote sources and cache
   */
  private async fetchAndCache(): Promise<LLMProviderConfig> {
    let config: LLMProviderConfig;

    try {
      // Try llm-prices.com first
      config = await fetchFromLLMPrices();
    } catch (primaryError) {
      console.warn('llm-prices.com failed, trying OpenRouter:', primaryError);

      try {
        // Fallback to OpenRouter
        config = await fetchFromOpenRouter();
      } catch (fallbackError) {
        console.warn('OpenRouter failed, using bundled defaults:', fallbackError);
        // Use bundled defaults
        config = { ...BUNDLED_DEFAULTS, timestamp: Date.now() };
      }
    }

    // Cache the result
    await this.cacheConfig(config);
    return config;
  }

  /**
   * Cache configuration in memory and storage
   */
  private async cacheConfig(config: LLMProviderConfig): Promise<void> {
    const expiry = Date.now() + DEFAULT_CACHE_TTL_MS;

    // Memory cache
    this.memoryCache = config;
    this.memoryCacheExpiry = expiry;

    // Storage cache
    try {
      await this.storage.set(
        STORAGE_KEY,
        JSON.stringify({ config, expiry })
      );
    } catch {
      // Storage error - memory cache still works
    }
  }

  /**
   * Force refresh from remote sources
   */
  async forceRefresh(): Promise<LLMProviderConfig> {
    // Clear caches
    this.memoryCache = null;
    this.memoryCacheExpiry = 0;
    await this.storage.remove(STORAGE_KEY);

    // Fetch fresh
    return this.getConfig();
  }

  /**
   * Get cache status
   */
  getCacheStatus(): CacheStatus {
    return {
      cached: this.memoryCache !== null && Date.now() < this.memoryCacheExpiry,
      expiry: this.memoryCacheExpiry > 0 ? new Date(this.memoryCacheExpiry) : null,
      source: this.memoryCache?.source ?? 'none',
    };
  }

  /**
   * Get pricing for a model
   */
  async getPricing(modelId: string): Promise<ModelPricing> {
    const config = await this.getConfig();
    const model = config.models[modelId];

    if (model) {
      return model.pricing;
    }

    // Try to find by partial match (e.g., "gpt-4o" matches "gpt-4o-mini")
    for (const [id, metadata] of Object.entries(config.models)) {
      if (id.startsWith(modelId) || modelId.startsWith(id)) {
        return metadata.pricing;
      }
    }

    // Return zero pricing for unknown models
    return { inputPer1M: 0, outputPer1M: 0 };
  }

  /**
   * Get metadata for a model
   */
  async getModelMetadata(modelId: string): Promise<ModelMetadata | null> {
    const config = await this.getConfig();
    return config.models[modelId] ?? null;
  }

  /**
   * Get models for a provider
   */
  async getModelsByProvider(provider: Provider): Promise<string[]> {
    const config = await this.getConfig();
    return Object.entries(config.models)
      .filter(([_, metadata]) => metadata.provider === provider)
      .map(([id]) => id);
  }

  /**
   * Get models for a tier
   */
  async getModelsByTier(tier: Tier): Promise<string[]> {
    const config = await this.getConfig();
    const tierConfig = config.tiers[tier];
    if (!tierConfig) return [];

    return [tierConfig.primaryModel, ...tierConfig.fallbackModels];
  }

  /**
   * Get fallback models for UI
   */
  async getFallbackModels(): Promise<FallbackModel[]> {
    const config = await this.getConfig();
    return config.fallbackModels;
  }

  /**
   * Check if a model exists in config
   */
  async hasModel(modelId: string): Promise<boolean> {
    const config = await this.getConfig();
    return modelId in config.models;
  }

  /**
   * Get all model IDs
   */
  async getAllModelIds(): Promise<string[]> {
    const config = await this.getConfig();
    return Object.keys(config.models);
  }

  /**
   * Get zero data retention models
   */
  async getZDRModels(): Promise<string[]> {
    const config = await this.getConfig();
    return Object.entries(config.models)
      .filter(([_, metadata]) => metadata.zeroDataRetention)
      .map(([id]) => id);
  }

  /**
   * Get reasoning models
   */
  async getReasoningModels(): Promise<string[]> {
    const config = await this.getConfig();
    return Object.entries(config.models)
      .filter(([_, metadata]) => metadata.isReasoningModel)
      .map(([id]) => id);
  }
}

/**
 * Singleton instance
 */
export const configService = new ConfigServiceImpl();

/**
 * Export class for testing
 */
export { ConfigServiceImpl };
