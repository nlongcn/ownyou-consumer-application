/// <reference lib="webworker" />

/**
 * Classification Worker - 3W-Compliant A/B Testing
 *
 * Runs multi-model IAB classification in a Web Worker context.
 * All LLM calls go through @ownyou/llm-client - NO server API calls.
 *
 * Features:
 * - Parallel multi-model classification
 * - Progress reporting
 * - Email summarization
 * - Full 3W compliance
 */

import {
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider,
  GroqProvider,
  DeepInfraProvider,
  WebLLMProvider,
  type LLMProvider,
  type ChatMessage,
} from '@ownyou/llm-client';

import type {
  Email,
  PreprocessedEmail,
  ModelConfig,
  Classification,
  ModelResults,
  IABSection,
  LLMProvider as ABTestingLLMProvider,
} from '@ownyou/ab-testing';

// --- Message Types ---

export interface ClassifyRequest {
  type: 'classify';
  requestId: string;
  emails: PreprocessedEmail[];
  models: ModelConfig[];
}

export interface SummarizeRequest {
  type: 'summarize';
  requestId: string;
  emails: Email[];
  model: ModelConfig;
}

export interface ProgressMessage {
  type: 'progress';
  requestId: string;
  modelKey: string;
  completed: number;
  total: number;
  status: string;
}

export interface ResultMessage {
  type: 'result';
  requestId: string;
  results: Record<string, ModelResults>;
}

export interface SummarizeResultMessage {
  type: 'summarize_result';
  requestId: string;
  emails: PreprocessedEmail[];
}

export interface ErrorMessage {
  type: 'error';
  requestId: string;
  error: string;
}

export type WorkerRequest = ClassifyRequest | SummarizeRequest;
export type WorkerResponse =
  | ProgressMessage
  | ResultMessage
  | SummarizeResultMessage
  | ErrorMessage;

// --- Provider Factory ---

interface APIKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  groq?: string;
  deepinfra?: string;
}

/**
 * Create an LLM provider for the given model config
 */
function createProvider(
  model: ModelConfig,
  apiKeys: APIKeys
): LLMProvider | null {
  const provider = model.provider as ABTestingLLMProvider;

  switch (provider) {
    case 'openai':
      if (!apiKeys.openai) {
        console.warn('[ClassificationWorker] No OpenAI API key');
        return null;
      }
      return new OpenAIProvider({
        apiKey: apiKeys.openai,
        model: model.model,
      });

    case 'claude':
      if (!apiKeys.anthropic) {
        console.warn('[ClassificationWorker] No Anthropic API key');
        return null;
      }
      return new AnthropicProvider({
        apiKey: apiKeys.anthropic,
        model: model.model,
      });

    case 'gemini':
      if (!apiKeys.google) {
        console.warn('[ClassificationWorker] No Google API key');
        return null;
      }
      return new GoogleProvider({
        apiKey: apiKeys.google,
        model: model.model,
      });

    case 'groq':
      if (!apiKeys.groq) {
        console.warn('[ClassificationWorker] No Groq API key');
        return null;
      }
      return new GroqProvider({
        apiKey: apiKeys.groq,
        model: model.model,
      });

    case 'deepinfra':
      if (!apiKeys.deepinfra) {
        console.warn('[ClassificationWorker] No DeepInfra API key');
        return null;
      }
      return new DeepInfraProvider({
        apiKey: apiKeys.deepinfra,
        model: model.model,
      });

    case 'webllm':
      return new WebLLMProvider({
        model: model.model,
      });

    default:
      console.warn(`[ClassificationWorker] Unknown provider: ${provider}`);
      return null;
  }
}

// --- Classification Logic ---

const IAB_CLASSIFICATION_PROMPT = `You are an IAB (Interactive Advertising Bureau) content classifier.
Analyze the email and classify it into the most appropriate IAB Content Taxonomy category.

Email Summary: {summary}
Subject: {subject}
From: {from}

Respond with ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "category": "IAB category name",
  "taxonomyId": "IAB-XXX",
  "confidence": 0.85,
  "reasoning": "Brief explanation",
  "section": "interests"
}

The section must be one of: "interests", "demographics", "household", "purchase_intent"
Confidence should be between 0 and 1.`;

async function classifyEmail(
  provider: LLMProvider,
  email: PreprocessedEmail,
  model: ModelConfig
): Promise<Classification | null> {
  const prompt = IAB_CLASSIFICATION_PROMPT.replace('{summary}', email.summary)
    .replace('{subject}', email.subject)
    .replace('{from}', email.from);

  try {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    const response = await provider.complete({
      messages,
      model: model.model,
      temperature: 0.3,
      maxTokens: 256,
    });

    if (!response.content) {
      console.warn(`[ClassificationWorker] Empty response for email ${email.id}`);
      return null;
    }

    // Parse JSON from response
    const content = response.content.trim();
    // Try to extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(
        `[ClassificationWorker] No JSON found in response for email ${email.id}`
      );
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.category || !parsed.taxonomyId) {
      console.warn(
        `[ClassificationWorker] Invalid classification for email ${email.id}`
      );
      return null;
    }

    return {
      emailId: email.id,
      category: String(parsed.category),
      taxonomyId: String(parsed.taxonomyId),
      confidence: Number(parsed.confidence) || 0.5,
      reasoning: String(parsed.reasoning || ''),
      section: (parsed.section as IABSection) || 'interests',
    };
  } catch (error) {
    console.error(
      `[ClassificationWorker] Classification failed for email ${email.id}:`,
      error
    );
    return null;
  }
}

// --- Summarization Logic ---

const SUMMARIZE_PROMPT = `Summarize this email in 2-3 sentences for IAB classification purposes.
Focus on: topics, interests, purchases, events, or activities mentioned.

Subject: {subject}
From: {from}
Body:
{body}

Respond with ONLY the summary text, no labels or formatting.`;

async function summarizeEmail(
  provider: LLMProvider,
  email: Email,
  model: ModelConfig
): Promise<PreprocessedEmail | null> {
  const prompt = SUMMARIZE_PROMPT.replace('{subject}', email.subject)
    .replace('{from}', email.from)
    .replace('{body}', email.body.slice(0, 3000)); // Limit body length

  try {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    const response = await provider.complete({
      messages,
      model: model.model,
      temperature: 0.3,
      maxTokens: 150,
    });

    const summary = response.content?.trim() || email.subject;

    return {
      ...email,
      summary,
      summaryTokenCount: summary.split(/\s+/).length,
    };
  } catch (error) {
    console.error(
      `[ClassificationWorker] Summarization failed for email ${email.id}:`,
      error
    );
    // Fallback to subject as summary
    return {
      ...email,
      summary: email.subject,
      summaryTokenCount: email.subject.split(/\s+/).length,
    };
  }
}

// --- Main Classification Runner ---

async function runClassification(
  requestId: string,
  emails: PreprocessedEmail[],
  models: ModelConfig[],
  apiKeys: APIKeys
): Promise<void> {
  const results: Record<string, ModelResults> = {};

  // Run all models in parallel
  await Promise.all(
    models.map(async (model) => {
      const modelKey = `${model.provider}:${model.model}`;
      const startTime = new Date().toISOString();
      const classifications: Classification[] = [];

      // Create provider
      const provider = createProvider(model, apiKeys);
      if (!provider) {
        console.error(
          `[ClassificationWorker] Failed to create provider for ${modelKey}`
        );
        self.postMessage({
          type: 'progress',
          requestId,
          modelKey,
          completed: 0,
          total: emails.length,
          status: 'error: no API key',
        } as ProgressMessage);
        return;
      }

      // Classify each email
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];

        // Report progress
        self.postMessage({
          type: 'progress',
          requestId,
          modelKey,
          completed: i,
          total: emails.length,
          status: 'classifying',
        } as ProgressMessage);

        const classification = await classifyEmail(provider, email, model);
        if (classification) {
          classifications.push(classification);
        }
      }

      const endTime = new Date().toISOString();

      // Compute stats
      const confidences = classifications.map((c) => c.confidence);
      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0;

      results[modelKey] = {
        modelKey,
        classifications,
        stats: {
          avgConfidence,
          minConfidence: confidences.length > 0 ? Math.min(...confidences) : 0,
          maxConfidence: confidences.length > 0 ? Math.max(...confidences) : 0,
          totalClassifications: classifications.length,
          uniqueCategories: [
            ...new Set(classifications.map((c) => c.category)),
          ],
        },
        timing: {
          startTime,
          endTime,
          durationMs:
            new Date(endTime).getTime() - new Date(startTime).getTime(),
        },
      };

      // Report completion
      self.postMessage({
        type: 'progress',
        requestId,
        modelKey,
        completed: emails.length,
        total: emails.length,
        status: 'completed',
      } as ProgressMessage);
    })
  );

  // Send results
  self.postMessage({
    type: 'result',
    requestId,
    results,
  } as ResultMessage);
}

// --- Main Summarization Runner ---

async function runSummarization(
  requestId: string,
  emails: Email[],
  model: ModelConfig,
  apiKeys: APIKeys
): Promise<void> {
  const modelKey = `${model.provider}:${model.model}`;

  // Create provider
  const provider = createProvider(model, apiKeys);
  if (!provider) {
    self.postMessage({
      type: 'error',
      requestId,
      error: `Failed to create provider for ${modelKey}: no API key`,
    } as ErrorMessage);
    return;
  }

  const preprocessed: PreprocessedEmail[] = [];

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    // Report progress
    self.postMessage({
      type: 'progress',
      requestId,
      modelKey,
      completed: i,
      total: emails.length,
      status: 'summarizing',
    } as ProgressMessage);

    const result = await summarizeEmail(provider, email, model);
    if (result) {
      preprocessed.push(result);
    }
  }

  // Send results
  self.postMessage({
    type: 'summarize_result',
    requestId,
    emails: preprocessed,
  } as SummarizeResultMessage);
}

// --- Worker Entry Point ---

/**
 * Get API keys from import.meta.env (Vite environment variables)
 *
 * CRITICAL: API keys are NEVER passed via messages.
 * They are always read from the build-time environment.
 */
function getAPIKeys(): APIKeys {
  // In Vite, env vars are available via import.meta.env
  // For workers, Vite inlines VITE_* vars at build time
  return {
    openai: import.meta.env.VITE_OPENAI_API_KEY || '',
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
    google: import.meta.env.VITE_GOOGLE_API_KEY || '',
    groq: import.meta.env.VITE_GROQ_API_KEY || '',
    deepinfra: import.meta.env.VITE_DEEPINFRA_API_KEY || '',
  };
}

// API keys loaded once at worker initialization
const API_KEYS = getAPIKeys();

console.log('[ClassificationWorker] API keys loaded from environment:', {
  openai: API_KEYS.openai ? '✓ configured' : '✗ missing',
  anthropic: API_KEYS.anthropic ? '✓ configured' : '✗ missing',
  google: API_KEYS.google ? '✓ configured' : '✗ missing',
  groq: API_KEYS.groq ? '✓ configured' : '✗ missing',
  deepinfra: API_KEYS.deepinfra ? '✓ configured' : '✗ missing',
});

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, requestId } = event.data;

  try {
    if (type === 'classify') {
      const { emails, models } = event.data as ClassifyRequest;
      await runClassification(requestId, emails, models, API_KEYS);
    } else if (type === 'summarize') {
      const { emails, model } = event.data as SummarizeRequest;
      await runSummarization(requestId, emails, model, API_KEYS);
    } else {
      self.postMessage({
        type: 'error',
        requestId,
        error: `Unknown message type: ${type}`,
      } as ErrorMessage);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as ErrorMessage);
  }
};

console.log('[ClassificationWorker] Initialized and ready');
