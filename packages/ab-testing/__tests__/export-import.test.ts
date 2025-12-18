/**
 * Tests for A/B Testing export/import utilities
 */

import { describe, it, expect } from 'vitest';
import {
  createStage1Export,
  parseStage1,
  createStage2Export,
  parseStage2,
  createStage3Export,
  parseStage3,
  resultsRecordToMap,
  serializeState,
  deserializeState,
  type Email,
  type PreprocessedEmail,
  type ModelConfig,
  type ModelResults,
  type ComparisonMetrics,
} from '../src';

describe('Stage 1 export/import', () => {
  const testEmails: Email[] = [
    {
      id: 'e1',
      subject: 'Test Subject 1',
      from: 'test1@example.com',
      body: 'Test body 1',
      date: '2025-01-01T00:00:00Z',
    },
    {
      id: 'e2',
      subject: 'Test Subject 2',
      from: 'test2@example.com',
      body: 'Test body 2',
      date: '2025-01-02T00:00:00Z',
    },
  ];

  it('should create valid export data', () => {
    const exportData = createStage1Export(testEmails, {
      provider: 'gmail',
      maxEmails: 100,
      userId: 'user123',
    });

    expect(exportData.version).toBe('1.0');
    expect(exportData.emails).toHaveLength(2);
    expect(exportData.downloadConfig.provider).toBe('gmail');
    expect(exportData.exportedAt).toBeDefined();
  });

  it('should round-trip through JSON', () => {
    const exportData = createStage1Export(testEmails, {
      provider: 'outlook',
      maxEmails: 50,
      userId: 'user456',
    });

    const json = JSON.stringify(exportData);
    const parsed = parseStage1(json);

    expect(parsed.emails).toHaveLength(2);
    expect(parsed.downloadConfig.provider).toBe('outlook');
    expect(parsed.downloadConfig.maxEmails).toBe(50);
  });

  it('should reject invalid version', () => {
    const invalidData = {
      version: '2.0',
      emails: [],
      downloadConfig: { provider: 'gmail', maxEmails: 10, userId: 'u' },
    };

    expect(() => parseStage1(JSON.stringify(invalidData))).toThrow(
      'Unsupported version'
    );
  });

  it('should reject missing emails array', () => {
    const invalidData = {
      version: '1.0',
      downloadConfig: { provider: 'gmail', maxEmails: 10, userId: 'u' },
    };

    expect(() => parseStage1(JSON.stringify(invalidData))).toThrow(
      'missing emails array'
    );
  });
});

describe('Stage 2 export/import', () => {
  const testEmails: PreprocessedEmail[] = [
    {
      id: 'e1',
      subject: 'Test Subject 1',
      from: 'test1@example.com',
      body: 'Test body 1',
      date: '2025-01-01T00:00:00Z',
      summary: 'Summary of email 1',
      summaryTokenCount: 15,
    },
    {
      id: 'e2',
      subject: 'Test Subject 2',
      from: 'test2@example.com',
      body: 'Test body 2',
      date: '2025-01-02T00:00:00Z',
      summary: 'Summary of email 2',
      summaryTokenCount: 12,
    },
  ];

  it('should create valid export data', () => {
    const exportData = createStage2Export(testEmails, {
      summarizerProvider: 'openai',
      summarizerModel: 'gpt-4o-mini',
    });

    expect(exportData.version).toBe('1.0');
    expect(exportData.emails).toHaveLength(2);
    expect(exportData.preprocessConfig.summarizerProvider).toBe('openai');
  });

  it('should round-trip through JSON', () => {
    const exportData = createStage2Export(testEmails, {
      summarizerProvider: 'claude',
      summarizerModel: 'claude-3-5-haiku',
      sourceStage1File: 'stage1.json',
    });

    const json = JSON.stringify(exportData);
    const parsed = parseStage2(json);

    expect(parsed.emails).toHaveLength(2);
    expect(parsed.emails[0].summary).toBe('Summary of email 1');
    expect(parsed.preprocessConfig.sourceStage1File).toBe('stage1.json');
  });

  it('should reject email without summary', () => {
    const invalidEmails = [
      {
        id: 'e1',
        subject: 'Test',
        from: 'test@example.com',
        body: 'Test',
        date: '2025-01-01T00:00:00Z',
        // Missing summary
      },
    ];

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      preprocessConfig: { summarizerProvider: 'test', summarizerModel: 'test' },
      emails: invalidEmails,
    };

    expect(() => parseStage2(JSON.stringify(exportData))).toThrow(
      'missing summary'
    );
  });
});

describe('Stage 3 export/import', () => {
  const testModels: ModelConfig[] = [
    { provider: 'openai', model: 'gpt-4o-mini', displayName: 'GPT-4o-mini' },
    { provider: 'claude', model: 'claude-3-5-haiku', displayName: 'Claude Haiku' },
  ];

  const testResults = new Map<string, ModelResults>();
  testResults.set('openai:gpt-4o-mini', {
    modelKey: 'openai:gpt-4o-mini',
    classifications: [
      {
        emailId: 'e1',
        category: 'Shopping',
        taxonomyId: 'IAB-SHO',
        confidence: 0.85,
        reasoning: 'Test',
        section: 'interests',
      },
    ],
    stats: {
      avgConfidence: 0.85,
      minConfidence: 0.85,
      maxConfidence: 0.85,
      totalClassifications: 1,
      uniqueCategories: ['Shopping'],
    },
    timing: {
      startTime: '2025-01-01T00:00:00Z',
      endTime: '2025-01-01T00:01:00Z',
      durationMs: 60000,
    },
  });

  const testMetrics: ComparisonMetrics = {
    modelStats: {},
    agreement: {
      fullAgreementCount: 1,
      partialAgreementCount: 0,
      noAgreementCount: 0,
      agreementRate: 1.0,
      pairwiseAgreement: {},
    },
    coverage: {
      categoriesByModel: {},
      commonCategories: [],
      uniqueCategories: {},
      categoryFrequency: {},
    },
  };

  it('should create valid export data', () => {
    const exportData = createStage3Export(
      testModels,
      testResults,
      testMetrics,
      'stage2.json'
    );

    expect(exportData.version).toBe('1.0');
    expect(exportData.models).toHaveLength(2);
    expect(exportData.results['openai:gpt-4o-mini']).toBeDefined();
    expect(exportData.comparisonMetrics).toBeDefined();
  });

  it('should round-trip through JSON', () => {
    const exportData = createStage3Export(testModels, testResults, testMetrics);

    const json = JSON.stringify(exportData);
    const parsed = parseStage3(json);

    expect(parsed.models).toHaveLength(2);
    expect(parsed.results['openai:gpt-4o-mini'].classifications).toHaveLength(1);
    expect(parsed.comparisonMetrics.agreement.agreementRate).toBe(1.0);
  });

  it('should reject missing results', () => {
    const invalidData = {
      version: '1.0',
      models: [],
      comparisonMetrics: testMetrics,
    };

    expect(() => parseStage3(JSON.stringify(invalidData))).toThrow(
      'missing results'
    );
  });
});

describe('resultsRecordToMap', () => {
  it('should convert Record to Map', () => {
    const record: Record<string, ModelResults> = {
      'model1': {
        modelKey: 'model1',
        classifications: [],
        stats: {
          avgConfidence: 0,
          minConfidence: 0,
          maxConfidence: 0,
          totalClassifications: 0,
          uniqueCategories: [],
        },
        timing: {
          startTime: '',
          endTime: '',
          durationMs: 0,
        },
      },
    };

    const map = resultsRecordToMap(record);
    expect(map).toBeInstanceOf(Map);
    expect(map.get('model1')).toBeDefined();
    expect(map.size).toBe(1);
  });
});

describe('serializeState/deserializeState', () => {
  it('should round-trip state with Map', () => {
    const state = {
      currentStage: 3 as const,
      classificationResults: new Map<string, ModelResults>(),
      someOtherField: 'test',
    };

    state.classificationResults.set('model1', {
      modelKey: 'model1',
      classifications: [],
      stats: {
        avgConfidence: 0.8,
        minConfidence: 0.5,
        maxConfidence: 1.0,
        totalClassifications: 10,
        uniqueCategories: [],
      },
      timing: {
        startTime: '2025-01-01T00:00:00Z',
        endTime: '2025-01-01T00:01:00Z',
        durationMs: 60000,
      },
    });

    const serialized = serializeState(state);
    const deserialized = deserializeState(serialized);

    expect(deserialized.classificationResults).toBeInstanceOf(Map);
    expect(deserialized.classificationResults.get('model1')).toBeDefined();
    expect(deserialized.someOtherField).toBe('test');
  });
});
