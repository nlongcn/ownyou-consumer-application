# A/B Model Testing Framework Specification

**Version:** 1.0
**Date:** 2025-11-27
**Status:** Draft

---

## Overview

The A/B Testing Framework enables comparison of multiple LLM models for IAB Taxonomy classification. It provides a 3-stage pipeline architecture where each stage's output can be exported/imported, allowing repeated testing with different model configurations without re-downloading or re-processing data.

### Goals

- **Model Quality Comparison**: Compare classification accuracy and confidence across different LLM providers/models
- **Reproducible Testing**: Export/import stage outputs to repeat tests with different configurations
- **Parallel Execution**: Run multiple models concurrently for efficient comparison
- **Comprehensive Metrics**: Confidence distribution, category agreement, and coverage analysis

### Non-Goals

- Cost/latency optimization (metrics displayed but not primary focus)
- Ground truth labeling or accuracy measurement against a reference
- Production model selection automation

---

## Architecture

### Pipeline Architecture

The framework uses a 3-stage pipeline where each stage must complete before the next can begin. Stages can be re-run independently by importing previously exported data.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Stage 1       │      │   Stage 2       │      │   Stage 3       │
│   Download      │ ───► │   Pre-process   │ ───► │   Classify      │
│                 │      │                 │      │   & Compare     │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         ▼                        ▼                        ▼
   [Export JSON]           [Export JSON]           [Export JSON]
   [Import JSON]           [Import JSON]
```

### Key Behaviors

1. **Progressive Unlocking**: Stage 2 disabled until Stage 1 completes; Stage 3 disabled until Stage 2 completes
2. **State Persistence**: Each stage's output persists in React state, enabling re-runs of later stages
3. **Export/Import**: Stage 1 and Stage 2 outputs exportable as JSON files for later re-use
4. **Parallel Classification**: Stage 3 runs all selected models concurrently via `Promise.all()`

---

## Page Layout

### URL

```
/ab-testing
```

### Structure

```
/ab-testing (new dashboard page)
├── Header: "A/B Model Testing"
├── Pipeline Progress Indicator (3 steps)
│   └── [1. Download] ─→ [2. Pre-process] ─→ [3. Classify & Compare]
│
├── Stage 1 Panel: Email Download
│   ├── [Download from Gmail/Outlook] OR [Upload Stage 1 JSON]
│   ├── Provider selector (Gmail/Outlook/Both)
│   ├── Max emails input
│   ├── OAuth status indicators
│   ├── Email count: "47 emails loaded"
│   └── [Export Stage 1 JSON] button (enabled after download/upload)
│
├── Stage 2 Panel: Pre-processing (visible after Stage 1 completes)
│   ├── [Run Pre-processing] OR [Upload Stage 2 JSON]
│   ├── Summarization model selector (provider + model)
│   ├── Preview: "47 emails with summaries"
│   └── [Export Stage 2 JSON] button (enabled after processing/upload)
│
├── Stage 3 Panel: Classification (visible after Stage 2 completes)
│   ├── Model multi-select (checkboxes)
│   │   └── OpenAI: gpt-4o-mini, gpt-4o
│   │   └── Claude: claude-3-5-sonnet, claude-3-5-haiku
│   │   └── Gemini: gemini-1.5-flash, gemini-2.0-flash
│   │   └── Groq: llama-3.3-70b-versatile
│   │   └── DeepInfra: meta-llama/Llama-3.3-70B-Instruct
│   ├── [Run Classification] button
│   ├── Progress: "Running 4 models in parallel..."
│   └── [Export Stage 3 JSON] button
│
└── Results Panel: Comparison Dashboard (visible after Stage 3)
    ├── Tab: Overview (summary table)
    ├── Tab: Confidence (histograms, box plots)
    ├── Tab: Agreement (heatmap, disagreement list)
    └── Tab: Coverage (category overlap analysis)
```

---

## Data Models

### Pipeline State (React Component State)

```typescript
interface ABTestingState {
  // Stage tracking
  currentStage: 1 | 2 | 3
  stageStatus: {
    download: 'idle' | 'running' | 'completed' | 'error'
    preprocess: 'idle' | 'running' | 'completed' | 'error'
    classify: 'idle' | 'running' | 'completed' | 'error'
  }

  // Stage 1: Downloaded emails
  downloadedEmails: Email[]
  downloadConfig: {
    provider: 'gmail' | 'outlook' | 'both'
    maxEmails: number
  }

  // Stage 2: Pre-processed emails
  preprocessedEmails: PreprocessedEmail[]
  preprocessConfig: {
    summarizerModel: string
    summarizerProvider: string
  }

  // Stage 3: Classification results per model
  selectedModels: ModelConfig[]
  classificationResults: Map<string, ModelResults>  // key = "provider:model"

  // Comparison metrics (computed from results)
  comparisonMetrics: ComparisonMetrics | null
}
```

### Core Types

```typescript
interface Email {
  id: string
  subject: string
  from: string
  body: string
  date: Date
}

interface PreprocessedEmail extends Email {
  summary: string           // LLM-generated summary
  summaryTokenCount: number // For reference
}

interface ModelConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'groq' | 'deepinfra'
  model: string
  displayName: string       // e.g., "GPT-4o-mini"
}

interface ModelResults {
  modelKey: string          // "openai:gpt-4o-mini"
  classifications: Classification[]
  stats: {
    avgConfidence: number
    minConfidence: number
    maxConfidence: number
    totalClassifications: number
    uniqueCategories: string[]
  }
  timing: {
    startTime: Date
    endTime: Date
    durationMs: number
  }
}

interface Classification {
  emailId: string
  category: string          // IAB category
  taxonomyId: string
  confidence: number
  reasoning: string
  section: 'demographics' | 'household' | 'interests' | 'purchase_intent'
}
```

---

## Export/Import Formats

### Stage 1 Export

**Filename:** `downloaded_emails_{timestamp}.json`

```typescript
interface Stage1Export {
  version: '1.0'
  exportedAt: string  // ISO timestamp
  downloadConfig: {
    provider: 'gmail' | 'outlook' | 'both'
    maxEmails: number
    userId: string
  }
  emails: Email[]
}
```

### Stage 2 Export

**Filename:** `preprocessed_emails_{timestamp}.json`

```typescript
interface Stage2Export {
  version: '1.0'
  exportedAt: string
  preprocessConfig: {
    summarizerProvider: string
    summarizerModel: string
    sourceStage1File?: string  // Reference to original Stage 1 export
  }
  emails: PreprocessedEmail[]  // Includes summaries
}
```

### Stage 3 Export

**Filename:** `classification_results_{timestamp}.json`

```typescript
interface Stage3Export {
  version: '1.0'
  exportedAt: string
  sourceStage2File?: string
  models: ModelConfig[]
  results: Record<string, ModelResults>  // keyed by "provider:model"
  comparisonMetrics: ComparisonMetrics
}
```

---

## Comparison Metrics

### ComparisonMetrics Interface

```typescript
interface ComparisonMetrics {
  // Per-model stats
  modelStats: Record<string, {
    avgConfidence: number
    minConfidence: number
    maxConfidence: number
    stdDevConfidence: number
    totalClassifications: number
    uniqueCategories: string[]
    classificationRate: number  // % of emails that got at least one classification
    durationMs: number
  }>

  // Cross-model agreement
  agreement: {
    fullAgreementCount: number      // All models picked same category
    partialAgreementCount: number   // Majority agreed
    noAgreementCount: number        // No majority
    agreementRate: number           // fullAgreement / totalEmails

    // Pairwise agreement matrix
    pairwiseAgreement: Record<string, Record<string, number>>
    // e.g., { "openai:gpt-4o-mini": { "claude:claude-3-5-sonnet": 0.85 } }
  }

  // Category coverage analysis
  coverage: {
    categoriesByModel: Record<string, string[]>
    commonCategories: string[]
    uniqueCategories: Record<string, string[]>
    categoryFrequency: Record<string, number>
  }
}
```

### Results Dashboard Tabs

#### Overview Tab

| Model | Avg Conf | Classifications | Time | Coverage |
|-------|----------|-----------------|------|----------|
| GPT-4o-mini | 78.3% | 142 | 12.4s | 94% |
| Claude-3-5-sonnet | 81.2% | 138 | 18.2s | 91% |
| Gemini-1.5-flash | 72.1% | 156 | 8.1s | 98% |
| Llama-3.3-70b | 69.8% | 147 | 6.2s | 89% |

#### Confidence Tab

- Histogram: Confidence distribution per model
- Box plot: Min/Q1/Median/Q3/Max per model

#### Agreement Tab

- Agreement Rate: "67% (32/47 emails had majority agreement)"
- Heatmap: Pairwise agreement matrix
- List: Emails with no agreement (click to inspect)

#### Coverage Tab

- Common categories (found by all models)
- Unique categories per model (potential outliers or unique insights)
- Bar chart or Venn diagram of category overlap

### Drill-down Features

- Click on any email row → see side-by-side classifications from all models
- Click on a category → see which emails were classified into it by which models

---

## API Integration

### Extended `/api/classify` Endpoint

The existing classify endpoint will be extended with new flags for A/B testing.

#### Request

```typescript
interface ClassifyRequest {
  user_id: string
  emails: Array<{
    id: string
    subject: string
    from: string
    body: string
    summary?: string  // If provided, skip summarization
  }>
  source: string
  llm_provider: string
  llm_model: string

  // NEW: A/B testing flags
  summarize_only?: boolean  // If true, return summaries without classification
  skip_store_write?: boolean  // If true, don't write to profile store
}
```

#### Response (when `summarize_only=true`)

```typescript
interface SummarizeResponse {
  success: true
  summarize_only: true
  emails: Array<{
    id: string
    summary: string
    token_count: number
  }>
}
```

### Parallel Classification (Frontend)

```typescript
async function runParallelClassification(
  preprocessedEmails: PreprocessedEmail[],
  selectedModels: ModelConfig[],
  userId: string
): Promise<Map<string, ModelResults>> {

  const results = new Map<string, ModelResults>()

  // Create promises for all models
  const promises = selectedModels.map(async (model) => {
    const startTime = new Date()

    const response = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        emails: preprocessedEmails.map(e => ({
          id: e.id,
          subject: e.subject,
          from: e.from,
          body: e.body,
          summary: e.summary,
        })),
        source: 'ab_testing',
        llm_provider: model.provider,
        llm_model: model.model,
        skip_store_write: true,  // Don't pollute profile store with test data
      }),
    })

    const data = await response.json()
    const endTime = new Date()

    return {
      modelKey: `${model.provider}:${model.model}`,
      model,
      data,
      timing: { startTime, endTime, durationMs: endTime.getTime() - startTime.getTime() }
    }
  })

  // Wait for all models to complete
  const allResults = await Promise.all(promises)

  for (const result of allResults) {
    results.set(result.modelKey, transformToModelResults(result))
  }

  return results
}
```

---

## Workflow Examples

### 1. Full Run

1. Download emails from Gmail (Stage 1)
2. Export Stage 1 JSON (backup)
3. Run pre-processing with GPT-4o-mini (Stage 2)
4. Export Stage 2 JSON (backup)
5. Select 4 models, run classification (Stage 3)
6. View results dashboard
7. Export Stage 3 JSON (archive)

### 2. Re-run Classification with Different Models

1. Upload Stage 2 JSON (skips Stage 1 and 2)
2. Select different models
3. Run classification (Stage 3)
4. Compare new results

### 3. Re-run Pre-processing with Different Summarizer

1. Upload Stage 1 JSON (skips download)
2. Change summarizer to Claude-3-5-haiku
3. Run pre-processing (Stage 2)
4. Export new Stage 2 JSON
5. Run classification (Stage 3)

### 4. Share Dataset

1. Complete Stage 1 and Stage 2
2. Export both JSON files
3. Send to colleague
4. Colleague imports and runs their own model comparisons

---

## File Structure

```
src/admin-dashboard/
├── app/
│   └── ab-testing/
│       └── page.tsx              # Main A/B testing page
├── components/
│   └── ab-testing/
│       ├── StageIndicator.tsx    # Pipeline progress indicator
│       ├── Stage1Panel.tsx       # Download panel
│       ├── Stage2Panel.tsx       # Pre-processing panel
│       ├── Stage3Panel.tsx       # Classification panel
│       ├── ResultsDashboard.tsx  # Results with tabs
│       ├── OverviewTab.tsx       # Summary table
│       ├── ConfidenceTab.tsx     # Confidence charts
│       ├── AgreementTab.tsx      # Agreement heatmap
│       ├── CoverageTab.tsx       # Coverage analysis
│       └── EmailDrilldown.tsx    # Side-by-side comparison modal
└── lib/
    └── ab-testing/
        ├── types.ts              # TypeScript interfaces
        ├── metrics.ts            # Metrics computation
        ├── export-import.ts      # JSON export/import utilities
        └── parallel-classify.ts  # Parallel classification logic
```

---

## Implementation Notes

### API Changes Required

1. **Extend `/api/classify`**: Add `summarize_only` and `skip_store_write` flags
2. **Summarization Logic**: When `summarize_only=true`, run LLM summarization and return without classification

### Frontend Components

1. **Stage State Machine**: Manage stage transitions and enable/disable logic
2. **File Upload/Download**: JSON export/import with file picker
3. **Progress Tracking**: Real-time progress for parallel model runs
4. **Charting Library**: Use existing chart components or add lightweight library for histograms/heatmaps

### Performance Considerations

- Parallel model execution limited by browser connection limits (~6 concurrent)
- Large email counts (100+) may require batching within each model run
- Consider adding cancellation support for long-running comparisons

---

## Future Enhancements

1. **Cost Tracking**: Add token usage and estimated cost per model
2. **Human Labeling**: Optional ground truth labeling for accuracy measurement
3. **Saved Experiments**: Persist experiments to IndexedDB with names/descriptions
4. **Model Presets**: Save and load model selection presets
5. **Diff View**: Detailed diff view for disagreement analysis

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-27 | 1.0 | Initial specification |
