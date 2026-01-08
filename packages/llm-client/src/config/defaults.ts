/**
 * Bundled Default Configuration - v13 Section 6.10
 *
 * ⚠️ WARNING: This file contains bundled fallback data for OFFLINE USE ONLY.
 *
 * DO NOT import this file directly in application code.
 * Always use ConfigService to access configuration.
 *
 * This data is used when:
 * 1. Network is unavailable
 * 2. All remote sources fail
 * 3. App is running offline
 *
 * Last Updated: 2026-01-08
 */

import type { LLMProviderConfig, ModelMetadata, FallbackModel, TierConfig } from './types';

/**
 * Bundled model metadata
 * Minimal set for offline operation
 */
const BUNDLED_MODELS: Record<string, ModelMetadata> = {
  // OpenAI
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    pricing: { inputPer1M: 0.15, outputPer1M: 0.60 },
    capabilities: ['json_mode', 'function_calling'],
    zeroDataRetention: false,
    isReasoningModel: false,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    pricing: { inputPer1M: 2.50, outputPer1M: 10.00 },
    capabilities: ['json_mode', 'vision', 'function_calling'],
    zeroDataRetention: false,
    isReasoningModel: false,
  },
  'o3-mini': {
    id: 'o3-mini',
    provider: 'openai',
    displayName: 'o3-mini',
    contextWindow: 200000,
    maxCompletionTokens: 65536,
    pricing: { inputPer1M: 1.10, outputPer1M: 4.40 },
    capabilities: ['reasoning'],
    zeroDataRetention: false,
    isReasoningModel: true,
  },

  // Anthropic
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
    capabilities: ['json_mode', 'vision'],
    zeroDataRetention: false,
    isReasoningModel: false,
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    pricing: { inputPer1M: 0.80, outputPer1M: 4.00 },
    capabilities: ['json_mode'],
    zeroDataRetention: false,
    isReasoningModel: false,
  },

  // Google
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1000000,
    maxCompletionTokens: 8192,
    pricing: { inputPer1M: 0.15, outputPer1M: 0.60 },
    capabilities: ['json_mode', 'vision'],
    zeroDataRetention: false,
    isReasoningModel: false,
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    provider: 'google',
    displayName: 'Gemini 1.5 Flash',
    contextWindow: 1000000,
    maxCompletionTokens: 8192,
    pricing: { inputPer1M: 0.075, outputPer1M: 0.30 },
    capabilities: ['json_mode', 'vision'],
    zeroDataRetention: false,
    isReasoningModel: false,
  },

  // Groq (Zero Data Retention)
  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    displayName: 'Llama 3.3 70B (Groq)',
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    pricing: { inputPer1M: 0.59, outputPer1M: 0.79 },
    capabilities: ['json_mode'],
    zeroDataRetention: true,
    isReasoningModel: false,
  },

  // DeepInfra (Zero Data Retention)
  'meta-llama/Llama-3.3-70B-Instruct': {
    id: 'meta-llama/Llama-3.3-70B-Instruct',
    provider: 'deepinfra',
    displayName: 'Llama 3.3 70B (DeepInfra)',
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    pricing: { inputPer1M: 0.35, outputPer1M: 0.40 },
    capabilities: ['json_mode'],
    zeroDataRetention: true,
    isReasoningModel: false,
  },

  // Ollama (Local)
  'llama3.2': {
    id: 'llama3.2',
    provider: 'ollama',
    displayName: 'Llama 3.2 (Local)',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    pricing: { inputPer1M: 0, outputPer1M: 0 },
    capabilities: [],
    zeroDataRetention: true,
    isReasoningModel: false,
  },
};

/**
 * Bundled tier configuration
 */
const BUNDLED_TIERS: Record<string, TierConfig> = {
  fast: {
    primaryModel: 'gpt-4o-mini',
    fallbackModels: ['gemini-2.0-flash', 'claude-3-5-haiku-20241022'],
    avgCostPer1k: 0.00035,
    description: 'IAB classification, simple queries',
  },
  standard: {
    primaryModel: 'gpt-4o',
    fallbackModels: ['claude-3-5-sonnet-20241022', 'gemini-1.5-flash'],
    avgCostPer1k: 0.001,
    description: 'Missions, Ikigai, Reflection',
  },
  quality: {
    primaryModel: 'claude-3-5-sonnet-20241022',
    fallbackModels: ['gpt-4o', 'o3-mini'],
    avgCostPer1k: 0.008,
    description: 'Complex reasoning, high-stakes',
  },
  local: {
    primaryModel: 'llama3.2',
    fallbackModels: [],
    avgCostPer1k: 0,
    description: 'Offline, privacy-critical',
  },
};

/**
 * Bundled fallback models for UI
 */
const BUNDLED_FALLBACK_MODELS: FallbackModel[] = [
  { provider: 'openai', model: 'gpt-4o-mini', displayName: 'GPT-4o Mini' },
  { provider: 'openai', model: 'gpt-4o', displayName: 'GPT-4o' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku' },
  { provider: 'google', model: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
  { provider: 'google', model: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B (Groq)' },
  { provider: 'deepinfra', model: 'meta-llama/Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B (DeepInfra)' },
];

/**
 * Complete bundled configuration
 *
 * ⚠️ DO NOT IMPORT DIRECTLY - Use ConfigService
 */
export const BUNDLED_DEFAULTS: LLMProviderConfig = {
  timestamp: Date.now(),
  source: 'bundled',
  models: BUNDLED_MODELS,
  tiers: BUNDLED_TIERS,
  fallbackModels: BUNDLED_FALLBACK_MODELS,
};

/**
 * Default cache TTL (24 hours)
 */
export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Primary data source URL
 */
export const LLM_PRICES_URL = 'https://www.llm-prices.com/current-v1.json';

/**
 * Fallback data source URL
 */
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models';
