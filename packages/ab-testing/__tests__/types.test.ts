/**
 * Tests for A/B Testing types
 */

import { describe, it, expect } from 'vitest';
import {
  FALLBACK_MODELS,
  DEFAULT_ABTESTING_CONFIG,
  type Email,
  type PreprocessedEmail,
  type ModelConfig,
  type Classification,
  type ModelResults,
  type ABTestingState,
} from '../src';

describe('FALLBACK_MODELS', () => {
  it('should have at least 4 models', () => {
    expect(FALLBACK_MODELS.length).toBeGreaterThanOrEqual(4);
  });

  it('should have valid model configs', () => {
    for (const model of FALLBACK_MODELS) {
      expect(model.provider).toBeDefined();
      expect(model.model).toBeDefined();
      expect(model.displayName).toBeDefined();
    }
  });

  it('should include OpenAI models', () => {
    const openaiModels = FALLBACK_MODELS.filter(m => m.provider === 'openai');
    expect(openaiModels.length).toBeGreaterThan(0);
  });

  it('should include Claude models', () => {
    const claudeModels = FALLBACK_MODELS.filter(m => m.provider === 'claude');
    expect(claudeModels.length).toBeGreaterThan(0);
  });

  it('should include Gemini models', () => {
    const geminiModels = FALLBACK_MODELS.filter(m => m.provider === 'gemini');
    expect(geminiModels.length).toBeGreaterThan(0);
  });
});

describe('DEFAULT_ABTESTING_CONFIG', () => {
  it('should have valid maxEmails', () => {
    expect(DEFAULT_ABTESTING_CONFIG.maxEmails).toBeGreaterThan(0);
    expect(DEFAULT_ABTESTING_CONFIG.maxEmails).toBeLessThanOrEqual(1000);
  });

  it('should have valid timeoutMs', () => {
    expect(DEFAULT_ABTESTING_CONFIG.timeoutMs).toBeGreaterThan(0);
  });

  it('should have defaultModels', () => {
    expect(DEFAULT_ABTESTING_CONFIG.defaultModels.length).toBeGreaterThan(0);
  });

  it('should have valid batchSize', () => {
    expect(DEFAULT_ABTESTING_CONFIG.batchSize).toBeGreaterThan(0);
  });
});

describe('Type validation', () => {
  it('should create valid Email', () => {
    const email: Email = {
      id: 'test-1',
      subject: 'Test Subject',
      from: 'test@example.com',
      body: 'Test body',
      date: '2025-01-01T00:00:00Z',
    };
    expect(email.id).toBe('test-1');
  });

  it('should create valid PreprocessedEmail', () => {
    const email: PreprocessedEmail = {
      id: 'test-1',
      subject: 'Test Subject',
      from: 'test@example.com',
      body: 'Test body',
      date: '2025-01-01T00:00:00Z',
      summary: 'Test summary',
      summaryTokenCount: 10,
    };
    expect(email.summary).toBe('Test summary');
  });

  it('should create valid Classification', () => {
    const classification: Classification = {
      emailId: 'test-1',
      category: 'Shopping',
      taxonomyId: 'IAB-123',
      confidence: 0.85,
      reasoning: 'Contains shopping keywords',
      section: 'interests',
    };
    expect(classification.confidence).toBe(0.85);
  });

  it('should create valid ModelResults', () => {
    const results: ModelResults = {
      modelKey: 'openai:gpt-4o-mini',
      classifications: [],
      stats: {
        avgConfidence: 0.8,
        minConfidence: 0.5,
        maxConfidence: 1.0,
        totalClassifications: 10,
        uniqueCategories: ['Shopping', 'Travel'],
      },
      timing: {
        startTime: '2025-01-01T00:00:00Z',
        endTime: '2025-01-01T00:01:00Z',
        durationMs: 60000,
      },
    };
    expect(results.modelKey).toBe('openai:gpt-4o-mini');
  });
});
