'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  FALLBACK_MODELS,
  fetchAvailableModels,
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
import { getGmailOAuthClient } from '@/lib/gmail-oauth-client'
import { getOutlookOAuthClient } from '@/lib/outlook-oauth-client'
import { IndexedDBStore } from '@/lib/IndexedDBStore'
import { getPendingOAuthAction, setPendingOAuthAction, clearPendingOAuthAction, hasPendingOAuthAction, type PendingOAuthAction } from '@/lib/oauth-integration'

// Persistence namespace for A/B testing data
const AB_TESTING_NAMESPACE = ['ab_testing', 'session']

export default function ABTestingPage() {
  // Hydration handling (prevent SSR mismatch)
  const [hydrated, setHydrated] = useState(false)

  // IndexedDBStore for persistence
  const [store, setStore] = useState<IndexedDBStore | null>(null)
  const [storeInitialized, setStoreInitialized] = useState(false)

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

  // Dynamic models from API (loaded on mount)
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>(FALLBACK_MODELS)
  const [modelsLoading, setModelsLoading] = useState(true)

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

  // Stage 3 state - 4 independent model selections for maximum flexibility
  const [selectedModels, setSelectedModels] = useState<ModelConfig[]>([
    FALLBACK_MODELS[0], // GPT-4o-mini by default
  ])
  const [classificationResults, setClassificationResults] = useState<Map<string, ModelResults>>(new Map())
  const [modelProgress, setModelProgress] = useState<Map<string, 'started' | 'completed' | 'error'>>(new Map())

  // Fix hydration error: mark as hydrated after client-side mount
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Initialize IndexedDBStore on component mount
  useEffect(() => {
    try {
      console.log('[A/B Testing] Initializing IndexedDBStore...')
      const newStore = new IndexedDBStore('ownyou_ab_testing_store')
      setStore(newStore)
      setStoreInitialized(true)
      console.log('[A/B Testing] IndexedDBStore initialized')
    } catch (err) {
      console.error('[A/B Testing] Failed to initialize IndexedDBStore:', err)
    }
  }, [])

  // Load persisted A/B testing session from IndexedDB on page load
  useEffect(() => {
    if (!store || !storeInitialized) return

    const loadPersistedData = async () => {
      try {
        console.log('[A/B Testing Persistence] Loading session from IndexedDB...')

        // Load stage 1 data (downloaded emails)
        // IMPORTANT: Check for pending OAuth action BEFORE loading config
        // If there's a pending action, the user set a specific config (e.g., maxEmails: 50)
        // that should NOT be overwritten by stale IndexedDB data
        const hasPending = hasPendingOAuthAction()
        if (hasPending) {
          console.log('[A/B Testing Persistence] Pending OAuth action detected, skipping config restoration to preserve user settings')
        }

        const stage1Item = await store.get(AB_TESTING_NAMESPACE, 'stage1_emails')
        if (stage1Item?.value) {
          const data = stage1Item.value as { emails: Email[], config: any, stageStatus: StageStatus }
          setDownloadedEmails(data.emails || [])
          // Only restore config if there's NO pending OAuth action
          // Pending OAuth action has the user's most recent settings
          if (data.config && !hasPending) {
            setDownloadConfig(data.config)
          }
          if (data.stageStatus === 'completed') {
            setStageStatus(s => ({ ...s, download: 'completed' }))
          }
          console.log(`[A/B Testing Persistence] Loaded ${data.emails?.length || 0} downloaded emails`)
        }

        // Load stage 2 data (preprocessed emails)
        const stage2Item = await store.get(AB_TESTING_NAMESPACE, 'stage2_emails')
        if (stage2Item?.value) {
          const data = stage2Item.value as { emails: PreprocessedEmail[], config: any, stageStatus: StageStatus }
          setPreprocessedEmails(data.emails || [])
          if (data.config) {
            setPreprocessConfig(data.config)
          }
          if (data.stageStatus === 'completed') {
            setStageStatus(s => ({ ...s, preprocess: 'completed' }))
          }
          console.log(`[A/B Testing Persistence] Loaded ${data.emails?.length || 0} preprocessed emails`)
        }

        // Load stage 3 data (classification results only - NOT model selections)
        // Model selections are always loaded fresh from API to avoid stale/invalid models
        const stage3Item = await store.get(AB_TESTING_NAMESPACE, 'stage3_results')
        if (stage3Item?.value) {
          const data = stage3Item.value as {
            results: Record<string, ModelResults>,
            metrics: ComparisonMetrics | null,
            stageStatus: StageStatus
          }
          // Convert Record back to Map
          if (data.results) {
            const resultsMap = new Map<string, ModelResults>()
            Object.entries(data.results).forEach(([key, value]) => {
              resultsMap.set(key, value)
            })
            setClassificationResults(resultsMap)
          }
          if (data.metrics) {
            setComparisonMetrics(data.metrics)
          }
          if (data.stageStatus === 'completed') {
            setStageStatus(s => ({ ...s, classify: 'completed' }))
          }
          console.log(`[A/B Testing Persistence] Loaded classification results (models loaded fresh from API)`)
        }

        console.log('[A/B Testing Persistence] Session loaded successfully')
      } catch (err) {
        console.error('[A/B Testing Persistence] Failed to load session:', err)
      }
    }

    loadPersistedData()
  }, [store, storeInitialized])

  // Load models from API on mount - always fresh, never persisted
  useEffect(() => {
    const loadModels = async () => {
      console.log('[A/B Testing] Loading fresh models from API...')
      setModelsLoading(true)
      try {
        const models = await fetchAvailableModels(true) // Force refresh
        setAvailableModels(models)
        // Set default selection to first model from fresh API response
        if (models.length > 0) {
          setSelectedModels([models[0]])
          console.log(`[A/B Testing] Default model set to: ${models[0].provider}:${models[0].model}`)
        }
        console.log(`[A/B Testing] Loaded ${models.length} models from API`)
      } catch (error) {
        console.error('[A/B Testing] Failed to load models:', error)
        // Keep using fallback models
      } finally {
        setModelsLoading(false)
      }
    }
    loadModels()
  }, [])

  // Track if we've already checked for pending OAuth actions
  const pendingActionChecked = useRef(false)

  // Check for pending OAuth action after page load (auto-continue OAuth flow)
  useEffect(() => {
    if (!hydrated || pendingActionChecked.current) return
    pendingActionChecked.current = true

    const checkPendingAction = async () => {
      const pending = getPendingOAuthAction()
      if (pending?.action === 'download_both') {
        console.log('[A/B Testing] Found pending action: download_both, continuing OAuth flow...')

        // Restore the download config from the pending action
        if (pending.provider || pending.maxEmails) {
          console.log(`[A/B Testing] Restoring config: provider=${pending.provider}, maxEmails=${pending.maxEmails}`)
          setDownloadConfig(prev => ({
            provider: (pending.provider as EmailProvider) || prev.provider,
            maxEmails: pending.maxEmails || prev.maxEmails,
          }))
        }

        // Small delay to ensure page is fully rendered and state is updated
        setTimeout(() => {
          // Trigger download which will check auth status and continue appropriately
          const downloadBtn = document.querySelector('[data-action="download"]') as HTMLButtonElement
          if (downloadBtn) {
            downloadBtn.click()
          }
        }, 500)
      }
    }

    checkPendingAction()
  }, [hydrated])

  // Comparison metrics
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetrics | null>(null)

  // Compute current stage
  const currentStage: 1 | 2 | 3 =
    stageStatus.classify === 'completed' ? 3 :
    stageStatus.preprocess === 'completed' ? 3 :
    stageStatus.download === 'completed' ? 2 : 1

  // Stage 1: Download emails using direct OAuth clients (like /emails page)
  const handleDownload = async () => {
    setStageStatus(s => ({ ...s, download: 'running' }))
    try {
      const emails: Email[] = []
      const { provider, maxEmails } = downloadConfig

      // For "both" mode: download maxEmails from EACH provider (total = 2x maxEmails)
      // For single provider: download maxEmails total
      const emailsPerProvider = maxEmails

      // For "both" mode, check authorization status FIRST before any downloads
      // This prevents the issue where one provider redirects to OAuth and loses state
      if (provider === 'both') {
        const gmailOAuthClient = getGmailOAuthClient()
        const outlookOAuthClient = getOutlookOAuthClient()

        const gmailAuthorized = await gmailOAuthClient.isAuthorized()
        const outlookAuthorized = await outlookOAuthClient.isAuthorized()

        console.log(`[A/B Testing] Authorization status - Gmail: ${gmailAuthorized}, Outlook: ${outlookAuthorized}`)

        // If neither is authorized, start with Gmail OAuth
        if (!gmailAuthorized && !outlookAuthorized) {
          console.log('[A/B Testing] Neither provider authorized, starting Gmail OAuth...')
          setPendingOAuthAction('download_both', { provider, maxEmails }) // Auto-continue after OAuth
          await gmailOAuthClient.authorize()
          return // Will redirect, OAuth callback will return here and auto-continue
        }

        // If only Outlook not authorized, start Outlook OAuth
        if (gmailAuthorized && !outlookAuthorized) {
          console.log('[A/B Testing] Gmail authorized but Outlook not, starting Outlook OAuth...')
          setPendingOAuthAction('download_both', { provider, maxEmails }) // Auto-continue after OAuth
          await outlookOAuthClient.authorize()
          return
        }

        // If only Gmail not authorized, start Gmail OAuth
        if (!gmailAuthorized && outlookAuthorized) {
          console.log('[A/B Testing] Outlook authorized but Gmail not, starting Gmail OAuth...')
          setPendingOAuthAction('download_both', { provider, maxEmails }) // Auto-continue after OAuth
          await gmailOAuthClient.authorize()
          return
        }

        // Both are authorized, proceed with downloads
        console.log('[A/B Testing] Both providers authorized, proceeding with downloads...')
      }

      // Download from Gmail
      if (provider === 'gmail' || provider === 'both') {
        try {
          const gmailOAuthClient = getGmailOAuthClient()
          const isAuthorized = await gmailOAuthClient.isAuthorized()

          if (!isAuthorized) {
            console.log('[A/B Testing] Gmail not authorized, starting OAuth flow...')
            await gmailOAuthClient.authorize() // Redirects to Google OAuth
            return // Page will reload after OAuth callback
          }

          const gmailClient = await gmailOAuthClient.getClient()
          const gmailResponse = await gmailClient.listMessages(undefined, emailsPerProvider)

          console.log('[A/B Testing] Gmail API response:', gmailResponse)
          console.log('[A/B Testing] Gmail messages count:', gmailResponse.messages?.length || 0)

          if (gmailResponse.messages && gmailResponse.messages.length > 0) {
            const messagePromises = gmailResponse.messages.map((msg: { id: string }) =>
              gmailClient.getMessage(msg.id, 'full')
            )
            const messages = await Promise.all(messagePromises)

            const gmailEmails = messages.map((msg: any) => ({
              id: `gmail_${msg.id}`,
              from: gmailClient.getHeader(msg, 'From') || 'Unknown',
              subject: gmailClient.getHeader(msg, 'Subject') || 'No Subject',
              body: gmailClient.getPlainTextBody(msg) || gmailClient.getHtmlBody(msg) || 'No body',
              date: gmailClient.getHeader(msg, 'Date') || new Date().toISOString(),
            }))

            emails.push(...gmailEmails)
            console.log(`[A/B Testing] Downloaded ${gmailEmails.length} Gmail emails`)
          }
        } catch (err) {
          console.error('[A/B Testing] Failed to download Gmail emails:', err)
          if (provider === 'gmail') throw err // Only throw if Gmail-only mode
        }
      }

      // Download from Outlook
      if (provider === 'outlook' || provider === 'both') {
        try {
          const outlookOAuthClient = getOutlookOAuthClient()
          const isAuthorized = await outlookOAuthClient.isAuthorized()

          if (!isAuthorized) {
            console.log('[A/B Testing] Outlook not authorized, starting OAuth flow...')
            await outlookOAuthClient.authorize() // Redirects to Microsoft OAuth
            return // Page will reload after OAuth callback
          }

          const outlookClient = await outlookOAuthClient.getClient()
          const outlookResponse = await outlookClient.listMessages(undefined, emailsPerProvider)

          console.log('[A/B Testing] Outlook API response:', outlookResponse)
          console.log('[A/B Testing] Outlook messages count:', outlookResponse.value?.length || 0)

          if (outlookResponse.value && outlookResponse.value.length > 0) {
            const outlookEmails = outlookResponse.value.map((msg: any) => ({
              id: `outlook_${msg.id}`,
              from: msg.from?.emailAddress?.address || 'Unknown',
              subject: msg.subject || 'No Subject',
              body: msg.body?.content || 'No body',
              date: msg.receivedDateTime || new Date().toISOString(),
            }))

            emails.push(...outlookEmails)
            console.log(`[A/B Testing] Downloaded ${outlookEmails.length} Outlook emails`)
          }
        } catch (err) {
          console.error('[A/B Testing] Failed to download Outlook emails:', err)
          if (provider === 'outlook') throw err // Only throw if Outlook-only mode
        }
      }

      if (emails.length === 0) {
        throw new Error('No emails found. Please check your OAuth connection.')
      }

      console.log(`[A/B Testing] Total emails downloaded: ${emails.length}`)

      setDownloadedEmails(emails)
      setStageStatus(s => ({ ...s, download: 'completed' }))
      // Reset later stages
      setPreprocessedEmails([])
      setClassificationResults(new Map())
      setComparisonMetrics(null)
      setStageStatus(s => ({ ...s, preprocess: 'idle', classify: 'idle' }))

      // Persist to IndexedDB
      if (store) {
        await store.put(AB_TESTING_NAMESPACE, 'stage1_emails', {
          emails,
          config: downloadConfig,
          stageStatus: 'completed',
          savedAt: new Date().toISOString(),
        })
        // Clear later stages from persistence
        await store.delete(AB_TESTING_NAMESPACE, 'stage2_emails')
        await store.delete(AB_TESTING_NAMESPACE, 'stage3_results')
        console.log('[A/B Testing Persistence] Stage 1 saved to IndexedDB')
      }
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

      // Persist to IndexedDB
      if (store) {
        await store.put(AB_TESTING_NAMESPACE, 'stage2_emails', {
          emails: processed,
          config: preprocessConfig,
          stageStatus: 'completed',
          savedAt: new Date().toISOString(),
        })
        // Clear later stage from persistence
        await store.delete(AB_TESTING_NAMESPACE, 'stage3_results')
        console.log('[A/B Testing Persistence] Stage 2 saved to IndexedDB')
      }
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

      // Persist to IndexedDB
      // Convert Map to Record for storage (Maps don't serialize to JSON)
      if (store) {
        const resultsRecord: Record<string, ModelResults> = {}
        results.forEach((value, key) => {
          resultsRecord[key] = value
        })
        // Note: selectedModels NOT persisted - always loaded fresh from API
        await store.put(AB_TESTING_NAMESPACE, 'stage3_results', {
          results: resultsRecord,
          metrics,
          stageStatus: 'completed',
          savedAt: new Date().toISOString(),
        })
        console.log('[A/B Testing Persistence] Stage 3 saved to IndexedDB (models not persisted)')
      }
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

  // Clear all session data (both state and IndexedDB)
  const handleClearSession = async () => {
    if (!confirm('Are you sure you want to clear all A/B testing data? This cannot be undone.')) {
      return
    }

    // Clear state
    setDownloadedEmails([])
    setPreprocessedEmails([])
    setClassificationResults(new Map())
    setComparisonMetrics(null)
    setModelProgress(new Map())
    setStageStatus({
      download: 'idle',
      preprocess: 'idle',
      classify: 'idle',
    })
    // Use first model from fresh API list, fallback to FALLBACK_MODELS[0]
    setSelectedModels([availableModels[0] || FALLBACK_MODELS[0]])

    // Clear IndexedDB
    if (store) {
      try {
        await store.delete(AB_TESTING_NAMESPACE, 'stage1_emails')
        await store.delete(AB_TESTING_NAMESPACE, 'stage2_emails')
        await store.delete(AB_TESTING_NAMESPACE, 'stage3_results')
        console.log('[A/B Testing Persistence] Session cleared from IndexedDB')
      } catch (err) {
        console.error('[A/B Testing Persistence] Failed to clear session:', err)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">A/B Model Testing</h1>
            <p className="text-gray-600">
              Compare IAB Taxonomy classification across different LLM models
            </p>
          </div>
          {hydrated && (downloadedEmails.length > 0 || preprocessedEmails.length > 0 || classificationResults.size > 0) && (
            <button
              onClick={handleClearSession}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
            >
              Clear Session
            </button>
          )}
        </div>

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
            availableModels={availableModels}
            modelsLoading={modelsLoading}
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
            availableModels={availableModels}
            modelsLoading={modelsLoading}
          />

          {/* Results Dashboard */}
          {comparisonMetrics && classificationResults.size > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Results</h2>
              <ResultsDashboard
                metrics={comparisonMetrics}
                results={classificationResults}
                emails={preprocessedEmails}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
