/**
 * A/B Testing Framework Type Definitions
 *
 * Ported from admin-dashboard for 3W-compliant consumer app.
 * These types define the complete A/B testing workflow:
 * - Stage 1: Email download
 * - Stage 2: Summarization/preprocessing
 * - Stage 3: Multi-model classification comparison
 */

/** Stage status tracking */
export type StageStatus = 'idle' | 'running' | 'completed' | 'error';

/** Email providers */
export type EmailProvider = 'gmail' | 'outlook' | 'both';

/** LLM Providers - matches @ownyou/llm-client registry */
export type LLMProvider =
  | 'openai'
  | 'claude'
  | 'gemini'
  | 'groq'
  | 'deepinfra'
  | 'ollama'
  | 'webllm';

/** IAB Classification sections */
export type IABSection =
  | 'demographics'
  | 'household'
  | 'interests'
  | 'purchase_intent';

/** Core Email interface */
export interface Email {
  id: string;
  subject: string;
  from: string;
  body: string;
  date: string; // ISO date string
}

/** Pre-processed email with summary */
export interface PreprocessedEmail extends Email {
  summary: string;
  summaryTokenCount: number;
}

/** Model configuration */
export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  displayName: string;
}

/** Individual classification result */
export interface Classification {
  emailId: string;
  category: string;
  taxonomyId: string;
  confidence: number;
  reasoning: string;
  section: IABSection;
}

/** Results for a single model */
export interface ModelResults {
  modelKey: string; // "provider:model"
  classifications: Classification[];
  stats: {
    avgConfidence: number;
    minConfidence: number;
    maxConfidence: number;
    totalClassifications: number;
    uniqueCategories: string[];
  };
  timing: {
    startTime: string; // ISO date string
    endTime: string; // ISO date string
    durationMs: number;
  };
}

/** Stage 1 export format */
export interface Stage1Export {
  version: '1.0';
  exportedAt: string;
  downloadConfig: {
    provider: EmailProvider;
    maxEmails: number;
    userId: string;
  };
  emails: Email[];
}

/** Stage 2 export format */
export interface Stage2Export {
  version: '1.0';
  exportedAt: string;
  preprocessConfig: {
    summarizerProvider: string;
    summarizerModel: string;
    sourceStage1File?: string;
  };
  emails: PreprocessedEmail[];
}

/** Stage 3 export format */
export interface Stage3Export {
  version: '1.0';
  exportedAt: string;
  sourceStage2File?: string;
  models: ModelConfig[];
  results: Record<string, ModelResults>;
  comparisonMetrics: ComparisonMetrics;
}

/** Per-model statistics */
export interface ModelStats {
  avgConfidence: number;
  minConfidence: number;
  maxConfidence: number;
  stdDevConfidence: number;
  totalClassifications: number;
  uniqueCategories: string[];
  classificationRate: number;
  durationMs: number;
}

/** Cross-model agreement metrics */
export interface AgreementMetrics {
  fullAgreementCount: number;
  partialAgreementCount: number;
  noAgreementCount: number;
  agreementRate: number;
  pairwiseAgreement: Record<string, Record<string, number>>;
}

/** Category coverage metrics */
export interface CoverageMetrics {
  categoriesByModel: Record<string, string[]>;
  commonCategories: string[];
  uniqueCategories: Record<string, string[]>;
  categoryFrequency: Record<string, number>;
}

/** Complete comparison metrics */
export interface ComparisonMetrics {
  modelStats: Record<string, ModelStats>;
  agreement: AgreementMetrics;
  coverage: CoverageMetrics;
}

/** Main A/B testing state interface */
export interface ABTestingState {
  /** Current stage (1, 2, or 3) */
  currentStage: 1 | 2 | 3;
  /** Status of each stage */
  stageStatus: {
    download: StageStatus;
    preprocess: StageStatus;
    classify: StageStatus;
  };
  /** Stage 1: Downloaded emails */
  downloadedEmails: Email[];
  downloadConfig: {
    provider: EmailProvider;
    maxEmails: number;
  };
  /** Stage 2: Pre-processed emails */
  preprocessedEmails: PreprocessedEmail[];
  preprocessConfig: {
    summarizerModel: string;
    summarizerProvider: string;
  };
  /** Stage 3: Classification results */
  selectedModels: ModelConfig[];
  classificationResults: Map<string, ModelResults>;
  /** Comparison metrics */
  comparisonMetrics: ComparisonMetrics | null;
}

/** Fallback models for selection (used when API is not available) */
export const FALLBACK_MODELS: ModelConfig[] = [
  // OpenAI
  { provider: 'openai', model: 'gpt-4o-mini', displayName: 'GPT-4o-mini' },
  { provider: 'openai', model: 'gpt-4o', displayName: 'GPT-4o' },
  // Claude
  {
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
  },
  {
    provider: 'claude',
    model: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
  },
  // Gemini
  {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
  },
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash',
  },
  // Groq
  {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B (Groq)',
  },
  // DeepInfra
  {
    provider: 'deepinfra',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    displayName: 'Llama 3.3 70B (DeepInfra)',
  },
];

/** @deprecated Use FALLBACK_MODELS instead */
export const AVAILABLE_MODELS = FALLBACK_MODELS;

/** A/B Testing configuration with extracted magic numbers */
export interface ABTestingConfig {
  maxEmails: number;
  timeoutMs: number;
  defaultModels: ModelConfig[];
  batchSize: number;
}

/** Default configuration */
export const DEFAULT_ABTESTING_CONFIG: ABTestingConfig = {
  maxEmails: 100,
  timeoutMs: 30000,
  defaultModels: FALLBACK_MODELS.slice(0, 4),
  batchSize: 10,
};
