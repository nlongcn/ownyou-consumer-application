'use client'

import { useState, useCallback } from 'react'
import {
  Email,
  PreprocessedEmail,
  ModelConfig,
  ModelResults,
  ComparisonMetrics,
  StageStatus,
  EmailProvider,
  Stage1Export,
  Stage2Export,
  AVAILABLE_MODELS,
} from '@/lib/ab-testing/types'
import {
  exportStage3,
  resultsRecordToMap,
} from '@/lib/ab-testing/export-import'
import {
  runParallelClassification,
  runSummarization,
  ProgressCallback,
} from '@/lib/ab-testing/parallel-classify'
import { computeComparisonMetrics } from '@/lib/ab-testing/metrics'
import {
  StageIndicator,
  Stage1Panel,
  Stage2Panel,
  Stage3Panel,
  ResultsDashboard,
} from '@/components/ab-testing'

export default function ABTestingPage() {
  // Stage status
  const [stageStatus, setStageStatus] = useState<{
    download: StageStatus
    preprocess: StageStatus
    classify: StageStatus
  }>({
    download: 'idle',
    preprocess: 'idle',
    classify: 'idle',
  })

  // Stage 1 state
  const [downloadedEmails, setDownloadedEmails] = useState<Email[]>([])
  const [downloadConfig, setDownloadConfig] = useState<{
    provider: EmailProvider
    maxEmails: number
  }>({
    provider: 'outlook',
    maxEmails: 50,
  })

  // Stage 2 state
  const [preprocessedEmails, setPreprocessedEmails] = useState<PreprocessedEmail[]>([])
  const [preprocessConfig, setPreprocessConfig] = useState({
    summarizerProvider: 'openai',
    summarizerModel: 'gpt-4o-mini',
  })

  // Stage 3 state
  const [selectedModels, setSelectedModels] = useState<ModelConfig[]>([
    AVAILABLE_MODELS[0], // GPT-4o-mini by default
  ])
  const [classificationResults, setClassificationResults] = useState<Map<string, ModelResults>>(new Map())
  const [modelProgress, setModelProgress] = useState<Map<string, 'started' | 'completed' | 'error'>>(new Map())

  // Comparison metrics
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetrics | null>(null)

  // Compute current stage
  const currentStage: 1 | 2 | 3 =
    stageStatus.classify === 'completed' ? 3 :
    stageStatus.preprocess === 'completed' ? 3 :
    stageStatus.download === 'completed' ? 2 : 1

  // Stage 1: Download emails
  const handleDownload = async () => {
    setStageStatus(s => ({ ...s, download: 'running' }))
    try {
      const response = await fetch(`/api/oauth/emails?provider=${downloadConfig.provider}&maxResults=${downloadConfig.maxEmails}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch emails: ${response.statusText}`)
      }
      const data = await response.json()

      const emails: Email[] = data.emails?.map((e: { id: string; subject?: string; from?: string; body?: string; date?: string }) => ({
        id: e.id,
        subject: e.subject || '(No subject)',
        from: e.from || '',
        body: e.body || '',
        date: e.date || new Date().toISOString(),
      })) || []

      setDownloadedEmails(emails)
      setStageStatus(s => ({ ...s, download: 'completed' }))
      // Reset later stages
      setPreprocessedEmails([])
      setClassificationResults(new Map())
      setComparisonMetrics(null)
      setStageStatus(s => ({ ...s, preprocess: 'idle', classify: 'idle' }))
    } catch (error) {
      console.error('Download error:', error)
      setStageStatus(s => ({ ...s, download: 'error' }))
      throw error
    }
  }

  // Stage 1: Import emails
  const handleStage1Import = (data: Stage1Export) => {
    setDownloadedEmails(data.emails)
    setDownloadConfig({
      provider: data.downloadConfig.provider,
      maxEmails: data.downloadConfig.maxEmails,
    })
    setStageStatus(s => ({ ...s, download: 'completed' }))
    // Reset later stages
    setPreprocessedEmails([])
    setClassificationResults(new Map())
    setComparisonMetrics(null)
    setStageStatus(s => ({ ...s, preprocess: 'idle', classify: 'idle' }))
  }

  // Stage 2: Pre-process emails
  const handlePreprocess = async () => {
    setStageStatus(s => ({ ...s, preprocess: 'running' }))
    try {
      const processed = await runSummarization(
        downloadedEmails,
        preprocessConfig.summarizerProvider,
        preprocessConfig.summarizerModel,
        'ab_testing_user'
      )
      setPreprocessedEmails(processed)
      setStageStatus(s => ({ ...s, preprocess: 'completed' }))
      // Reset later stage
      setClassificationResults(new Map())
      setComparisonMetrics(null)
      setStageStatus(s => ({ ...s, classify: 'idle' }))
    } catch (error) {
      console.error('Preprocess error:', error)
      setStageStatus(s => ({ ...s, preprocess: 'error' }))
      throw error
    }
  }

  // Stage 2: Import preprocessed emails
  const handleStage2Import = (data: Stage2Export) => {
    setPreprocessedEmails(data.emails)
    setPreprocessConfig({
      summarizerProvider: data.preprocessConfig.summarizerProvider,
      summarizerModel: data.preprocessConfig.summarizerModel,
    })
    // Also set stage 1 as complete since we have the emails
    setDownloadedEmails(data.emails.map(e => ({
      id: e.id,
      subject: e.subject,
      from: e.from,
      body: e.body,
      date: e.date,
    })))
    setStageStatus(s => ({ ...s, download: 'completed', preprocess: 'completed' }))
    // Reset later stage
    setClassificationResults(new Map())
    setComparisonMetrics(null)
    setStageStatus(s => ({ ...s, classify: 'idle' }))
  }

  // Stage 3: Model toggle
  const handleModelToggle = (model: ModelConfig) => {
    setSelectedModels(prev => {
      const exists = prev.some(m => m.provider === model.provider && m.model === model.model)
      if (exists) {
        return prev.filter(m => !(m.provider === model.provider && m.model === model.model))
      } else {
        return [...prev, model]
      }
    })
  }

  // Stage 3: Progress callback
  const handleProgress: ProgressCallback = useCallback((modelKey, status) => {
    setModelProgress(prev => new Map(prev).set(modelKey, status))
  }, [])

  // Stage 3: Run classification
  const handleClassify = async () => {
    setStageStatus(s => ({ ...s, classify: 'running' }))
    setModelProgress(new Map())
    try {
      const results = await runParallelClassification(
        preprocessedEmails,
        selectedModels,
        'ab_testing_user',
        handleProgress
      )
      setClassificationResults(results)

      // Compute metrics
      const emailIds = preprocessedEmails.map(e => e.id)
      const metrics = computeComparisonMetrics(results, emailIds)
      setComparisonMetrics(metrics)

      setStageStatus(s => ({ ...s, classify: 'completed' }))
    } catch (error) {
      console.error('Classification error:', error)
      setStageStatus(s => ({ ...s, classify: 'error' }))
      throw error
    }
  }

  // Stage 3: Export results
  const handleStage3Export = () => {
    if (comparisonMetrics) {
      exportStage3(selectedModels, classificationResults, comparisonMetrics)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">A/B Model Testing</h1>
        <p className="text-gray-600 mb-6">
          Compare IAB Taxonomy classification across different LLM models
        </p>

        {/* Stage indicator */}
        <StageIndicator currentStage={currentStage} stageStatus={stageStatus} />

        {/* Stage panels */}
        <div className="space-y-6">
          {/* Stage 1 */}
          <Stage1Panel
            status={stageStatus.download}
            emails={downloadedEmails}
            config={downloadConfig}
            onConfigChange={setDownloadConfig}
            onDownload={handleDownload}
            onImport={handleStage1Import}
            onExport={() => {}}
          />

          {/* Stage 2 */}
          <Stage2Panel
            status={stageStatus.preprocess}
            emails={preprocessedEmails}
            config={preprocessConfig}
            sourceEmailCount={downloadedEmails.length}
            onConfigChange={setPreprocessConfig}
            onPreprocess={handlePreprocess}
            onImport={handleStage2Import}
            onExport={() => {}}
            disabled={stageStatus.download !== 'completed'}
          />

          {/* Stage 3 */}
          <Stage3Panel
            status={stageStatus.classify}
            selectedModels={selectedModels}
            results={classificationResults}
            sourceEmailCount={preprocessedEmails.length}
            onModelToggle={handleModelToggle}
            onClassify={handleClassify}
            onExport={handleStage3Export}
            disabled={stageStatus.preprocess !== 'completed'}
            progress={modelProgress}
          />

          {/* Results Dashboard */}
          {comparisonMetrics && classificationResults.size > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Results</h2>
              <ResultsDashboard
                metrics={comparisonMetrics}
                results={classificationResults}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
