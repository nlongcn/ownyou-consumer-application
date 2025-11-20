'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getGmailOAuthClient } from '@/lib/gmail-oauth-client'
import { getOutlookOAuthClient } from '@/lib/outlook-oauth-client'
import { OutlookClient } from '@/lib/outlook-client'
import { OpenAIClient } from '@browser/llm/openaiClient'
import { GoogleClient } from '@browser/llm/googleClient'
import { getLLMConfig } from '@/lib/llm-config'

interface Email {
  id: string
  from: string
  subject: string
  body: string
  date: string
  provider?: 'gmail' | 'outlook'
  summary?: string  // Added for email summarization
}

interface Classification {
  category: string
  confidence: number
  reasoning: string
  section: string
  taxonomy_id: string
}

interface EmailWithClassification extends Email {
  classification: Classification | null
  classifying: boolean
  classificationError?: string
}

interface ModelsResponse {
  openai: string[]
  anthropic: string[]
  google: string[]
  ollama?: string[]
  last_email_model: string
  last_taxonomy_model: string
  last_max_emails?: number
}

export default function EmailDownloadPage() {
  const searchParams = useSearchParams()
  const [provider, setProvider] = useState<'both' | 'gmail' | 'outlook'>('gmail')
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [gmailStatus, setGmailStatus] = useState<'checking' | 'connected' | 'not_connected'>('checking')
  const [outlookStatus, setOutlookStatus] = useState<'checking' | 'connected' | 'not_connected'>('checking')
  const [maxEmails, setMaxEmails] = useState<number | string>(10)
  const [selectedEmailModel, setSelectedEmailModel] = useState<string>('')
  const [selectedTaxonomyModel, setSelectedTaxonomyModel] = useState<string>('')
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [skipSummarization, setSkipSummarization] = useState(false)
  const [loading, setLoading] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [classificationProgress, setClassificationProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [emails, setEmails] = useState<EmailWithClassification[]>([])

  // Automatically check Gmail OAuth tokens on page load (Python dashboard pattern)
  useEffect(() => {
    const checkGmailAuth = async () => {
      try {
        const client = getGmailOAuthClient()
        const isAuthorized = await client.isAuthorized()

        if (isAuthorized) {
          console.log('[Gmail OAuth] Token found, validating...')
          // Validate token by getting a valid access token (auto-refreshes if needed)
          await client.getValidAccessToken()
          setGmailConnected(true)
          setGmailStatus('connected')
          console.log('[Gmail OAuth] Token validated successfully')
        } else {
          console.log('[Gmail OAuth] No token found')
          setGmailConnected(false)
          setGmailStatus('not_connected')
        }
      } catch (err) {
        console.error('[Gmail OAuth] Token validation failed:', err)
        setGmailConnected(false)
        setGmailStatus('not_connected')
        setError('Gmail token validation failed. Please reconnect.')
      }
    }

    checkGmailAuth()
  }, [])

  // Automatically check Outlook OAuth tokens on page load (Python dashboard pattern)
  useEffect(() => {
    const checkOutlookAuth = async () => {
      try {
        const client = getOutlookOAuthClient()
        const isAuthorized = await client.isAuthorized()

        if (isAuthorized) {
          console.log('[Outlook OAuth] Token found, validating...')
          // Validate token by getting a valid access token (auto-refreshes if needed)
          await client.getValidAccessToken()
          setOutlookConnected(true)
          setOutlookStatus('connected')
          console.log('[Outlook OAuth] Token validated successfully')
        } else {
          console.log('[Outlook OAuth] No token found')
          setOutlookConnected(false)
          setOutlookStatus('not_connected')
        }
      } catch (err) {
        console.error('[Outlook OAuth] Token validation failed:', err)
        setOutlookConnected(false)
        setOutlookStatus('not_connected')
        setError('Outlook token validation failed. Please reconnect.')
      }
    }

    checkOutlookAuth()
  }, [])

  // Load models from API on mount (Python dashboard pattern)
  useEffect(() => {
    const initModels = async () => {
      // Load models from API first
      await loadModels(true)

      // THEN restore settings from localStorage (takes precedence over API defaults)
      const savedEmailModel = localStorage.getItem('selectedEmailModel')
      const savedTaxonomyModel = localStorage.getItem('selectedTaxonomyModel')

      if (savedEmailModel) {
        setSelectedEmailModel(savedEmailModel)
      }
      if (savedTaxonomyModel) {
        setSelectedTaxonomyModel(savedTaxonomyModel)
      }
    }

    initModels()
  }, [])

  const loadModels = async (refresh = false) => {
    try {
      setLoadingModels(true)
      const url = `/api/analyze/models${refresh ? '?refresh=true' : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to load models')
      }

      const data: ModelsResponse = await response.json()
      setModels(data)

      // Set selected models to last used or defaults
      // BUGFIX: Check localStorage first - it takes precedence over API defaults
      const savedEmailModel = localStorage.getItem('selectedEmailModel')
      const savedTaxonomyModel = localStorage.getItem('selectedTaxonomyModel')

      if (!selectedEmailModel && !savedEmailModel && data.last_email_model) {
        setSelectedEmailModel(data.last_email_model)
      }
      if (!selectedTaxonomyModel && !savedTaxonomyModel && data.last_taxonomy_model) {
        setSelectedTaxonomyModel(data.last_taxonomy_model)
      }

      // Set max emails to last used or default
      if (data.last_max_emails !== undefined) {
        setMaxEmails(data.last_max_emails)
      }
    } catch (err) {
      console.error('Failed to load models:', err)
      // Set defaults if API fails
      setModels({
        openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        anthropic: ['claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        google: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'],
        ollama: [],
        last_email_model: '',  // No default - user must select
        last_taxonomy_model: ''  // No default - user must select
      })
      // Don't set defaults - let user choose
      setSelectedTaxonomyModel('openai:gpt-4o-mini')
    } finally {
      setLoadingModels(false)
    }
  }

  // Check for OAuth callback status on mount (legacy, can remove later)
  useEffect(() => {
    const gmailConnectedParam = searchParams?.get('gmail_connected')
    const outlookConnectedParam = searchParams?.get('outlook_connected')
    const errorParam = searchParams?.get('error')

    if (gmailConnectedParam === 'true') {
      setGmailConnected(true)
      setSuccess('Gmail connected successfully!')
      setProvider('gmail')
    }

    if (outlookConnectedParam === 'true') {
      setOutlookConnected(true)
      setSuccess('Outlook connected successfully!')
      setProvider('outlook')
    }

    if (errorParam) {
      setError(`OAuth error: ${errorParam}`)
    }
  }, [searchParams])

  // Save model selections to localStorage whenever they change
  useEffect(() => {
    if (selectedEmailModel) {
      localStorage.setItem('selectedEmailModel', selectedEmailModel)
    }
  }, [selectedEmailModel])

  useEffect(() => {
    if (selectedTaxonomyModel) {
      localStorage.setItem('selectedTaxonomyModel', selectedTaxonomyModel)
    }
  }, [selectedTaxonomyModel])

  const handleDownloadAndClassify = async () => {
    // Check if we have OAuth connection
    const hasGmailAuth = (provider === 'gmail' || provider === 'both') && gmailConnected
    const hasOutlookAuth = (provider === 'outlook' || provider === 'both') && outlookConnected
    const needsBothAuth = provider === 'both' && (!gmailConnected || !outlookConnected)

    if (needsBothAuth) {
      setError('Please connect both Gmail and Outlook using OAuth first')
      return
    }

    if (!hasGmailAuth && !hasOutlookAuth) {
      setError(`Please connect ${provider} using OAuth first`)

      // Automatically redirect to OAuth
      if (provider === 'gmail') {
        try {
          const client = getGmailOAuthClient()
          await client.authorize() // This redirects to Google OAuth
        } catch (err) {
          console.error('Failed to start Gmail OAuth flow:', err)
        }
      } else if (provider === 'outlook') {
        try {
          const client = getOutlookOAuthClient()
          await client.authorize() // This redirects to Microsoft OAuth
        } catch (err) {
          console.error('Failed to start Outlook OAuth flow:', err)
        }
      }
      return
    }

    // Model selections are now auto-saved via useEffect (lines 208-219)

    setLoading(true)
    setError(null)
    setSuccess(null)
    setEmails([])

    try {
      let downloadedEmails: Email[] = []

      // Step 1: Download emails
      if (provider === 'both') {
        // Download from both Gmail and Outlook
        const emailsPerProvider = Math.ceil(maxEmails / 2)

        // Gmail
        try {
          const gmailOAuthClient = getGmailOAuthClient()
          const gmailClient = await gmailOAuthClient.getClient()
          const gmailResponse = await gmailClient.listMessages(undefined, emailsPerProvider)

          console.log('[Email Download] Gmail API response:', gmailResponse)
          console.log('[Email Download] Gmail messages count:', gmailResponse.messages?.length || 0)

          if (gmailResponse.messages && gmailResponse.messages.length > 0) {
            const messagePromises = gmailResponse.messages.map(msg =>
              gmailClient.getMessage(msg.id, 'full')
            )
            const messages = await Promise.all(messagePromises)

            const gmailEmails = messages.map(msg => ({
              id: `gmail_${msg.id}`,
              from: gmailClient.getHeader(msg, 'From') || 'Unknown',
              subject: gmailClient.getHeader(msg, 'Subject') || 'No Subject',
              body: gmailClient.getPlainTextBody(msg) || gmailClient.getHtmlBody(msg) || 'No body',
              date: gmailClient.getHeader(msg, 'Date') || 'Unknown date',
              provider: 'gmail' as 'gmail' | 'outlook'
            }))

            downloadedEmails.push(...gmailEmails)
          }
        } catch (err) {
          console.error('Failed to download Gmail emails:', err)
        }

        // Outlook
        try {
          const outlookOAuthClient = getOutlookOAuthClient()
          const outlookClient = await outlookOAuthClient.getClient()
          const outlookResponse = await outlookClient.listMessages(undefined, emailsPerProvider)

          console.log('[Email Download] Outlook API response:', outlookResponse)
          console.log('[Email Download] Outlook messages count:', outlookResponse.value?.length || 0)

          if (outlookResponse.value && outlookResponse.value.length > 0) {
            const outlookEmails = outlookResponse.value.map(msg => ({
              id: `outlook_${msg.id}`,
              from: msg.from?.emailAddress?.address || 'Unknown',
              subject: msg.subject || 'No Subject',
              body: msg.body?.content || 'No body',
              date: msg.receivedDateTime || 'Unknown date',
              provider: 'outlook' as 'gmail' | 'outlook'
            }))

            downloadedEmails.push(...outlookEmails)
          }
        } catch (err) {
          console.error('Failed to download Outlook emails:', err)
        }

        if (downloadedEmails.length === 0) {
          setLoading(false)
          setSuccess('No emails found in Gmail or Outlook')
          return
        }

      } else if (provider === 'gmail') {
        // Use GmailOAuthClient instead of manual token
        const oauthClient = getGmailOAuthClient()
        const client = await oauthClient.getClient() // Auto-refreshes token if needed

        const response = await client.listMessages(undefined, maxEmails)

        if (!response.messages || response.messages.length === 0) {
          setLoading(false)
          setSuccess('No emails found')
          return
        }

        const messagePromises = response.messages.map(msg =>
          client.getMessage(msg.id, 'full')
        )
        const messages = await Promise.all(messagePromises)

        downloadedEmails = messages.map(msg => ({
          id: msg.id,
          from: client.getHeader(msg, 'From') || 'Unknown',
          subject: client.getHeader(msg, 'Subject') || 'No Subject',
          body: client.getPlainTextBody(msg) || client.getHtmlBody(msg) || 'No body',
          date: client.getHeader(msg, 'Date') || 'Unknown date'
        }))

      } else {
        // Outlook
        // Use OutlookOAuthClient instead of manual token
        const oauthClient = getOutlookOAuthClient()
        const client = await oauthClient.getClient() // Auto-refreshes token if needed

        const response = await client.listMessages(undefined, maxEmails)

        if (!response.value || response.value.length === 0) {
          setLoading(false)
          setSuccess('No emails found')
          return
        }

        downloadedEmails = response.value.map(msg => ({
          id: msg.id,
          from: msg.from?.emailAddress?.address || 'Unknown',
          subject: msg.subject || 'No Subject',
          body: msg.body?.content || 'No body',
          date: msg.receivedDateTime || 'Unknown date'
        }))
      }

      // Initialize emails with classification state
      const emailsWithClassification: EmailWithClassification[] = downloadedEmails.map(email => ({
        ...email,
        classification: null,
        classifying: false
      }))

      setEmails(emailsWithClassification)
      setLoading(false)

      // Step 2: Concurrent Email Summarization (Python pattern: ThreadPoolExecutor with 5 workers)
      // Python source: src/email_parser/main.py:195-240
      let summarizedEmails = downloadedEmails

      if (!skipSummarization) {
        // Validate model selection before starting summarization
        const emailModelToUse = selectedEmailModel || selectedTaxonomyModel

        if (!emailModelToUse) {
          setError('Please select a model for email summarization in the dropdowns above')
          setLoading(false)
          return
        }

        console.log(`[Concurrent Summarization] Processing ${downloadedEmails.length} emails with model: ${emailModelToUse}`)

        // Parse provider and model from selected email model (format: "provider:model")
        const [emailProvider, emailModel] = emailModelToUse.split(':')

        // Python pattern: Process emails in chunks of 5 (max_workers=5)
        const MAX_CONCURRENT_WORKERS = 5
        const chunks: Email[][] = []
        for (let i = 0; i < downloadedEmails.length; i += MAX_CONCURRENT_WORKERS) {
          chunks.push(downloadedEmails.slice(i, i + MAX_CONCURRENT_WORKERS))
        }

        const allSummarized: Email[] = []

        // Process each chunk (5 emails at a time in parallel)
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex]
          console.log(`[Concurrent Summarization] Chunk ${chunkIndex + 1}/${chunks.length}: Processing ${chunk.length} emails in parallel`)

          // Promise.all = Python's ThreadPoolExecutor concurrent processing
          const summarizePromises = chunk.map(async (email) => {
            try {
              // Browser-direct LLM call (self-sovereign architecture)
              // Get user's API key from localStorage
              const config = getLLMConfig()

              // Validate API key exists for selected provider
              if (emailProvider === 'openai' && !config.openai.api_key) {
                console.error(`[Concurrent Summarization] OpenAI API key missing for email ${email.id}`)
                setError('OpenAI API key required. Please add it in Settings.')
                return {
                  ...email,
                  summary: email.body.substring(0, 500), // Fallback to substring
                }
              }
              if (emailProvider === 'google' && !config.google.api_key) {
                console.error(`[Concurrent Summarization] Google API key missing for email ${email.id}`)
                setError('Google API key required. Please add it in Settings.')
                return {
                  ...email,
                  summary: email.body.substring(0, 500), // Fallback to substring
                }
              }

              // Create LLM client with user's API key (browser-direct, no server)
              let client
              if (emailProvider === 'openai') {
                client = new OpenAIClient({
                  openai_api_key: config.openai.api_key,
                })
              } else if (emailProvider === 'google') {
                client = new GoogleClient({
                  google_api_key: config.google.api_key,
                })
              } else {
                throw new Error(`Unsupported provider: ${emailProvider}`)
              }

              // Call LLM directly (no /api/summarize route)
              // NOTE: Do NOT hardcode max_tokens or temperature here!
              // OpenAIClient handles model-specific parameters correctly:
              // - gpt-5/o1 models: uses max_completion_tokens, no temperature
              // - gpt-4/3.5 models: uses max_tokens + temperature
              const response = await client.generate({
                messages: [{
                  role: 'user',
                  content: `Summarize this email in 2-3 sentences, focusing on the main purpose and any action items:\n\nSubject: ${email.subject}\nFrom: ${email.from}\n\n${email.body}`
                }],
                model: emailModel,
                // Let OpenAIClient set correct parameters based on model
              })

              if (response.success) {
                return {
                  ...email,
                  summary: response.content,
                }
              } else {
                console.error(`[Concurrent Summarization] Failed for email ${email.id}:`, response.error)
                return {
                  ...email,
                  summary: email.body.substring(0, 500), // Fallback to substring
                }
              }
            } catch (error: any) {
              console.error(`[Concurrent Summarization] Error for email ${email.id}:`, error)

              // Show transparent error to user
              if (error.message?.includes('invalid_api_key') || error.message?.includes('Incorrect API key')) {
                setError(`Invalid ${emailProvider} API key. Please check your Settings.`)
              } else if (error.message?.includes('rate_limit')) {
                setError(`${emailProvider} rate limit exceeded. Please wait and try again.`)
              }

              return {
                ...email,
                summary: email.body.substring(0, 500), // Fallback to substring
              }
            }
          })

          // Wait for all 5 emails in this chunk to complete
          const chunkResults = await Promise.all(summarizePromises)
          allSummarized.push(...chunkResults)

          console.log(`[Concurrent Summarization] Chunk ${chunkIndex + 1} complete: ${chunkResults.length} emails summarized`)
        }

        summarizedEmails = allSummarized

        // Log summarization results
        const successfulSummaries = allSummarized.filter(e => e.summary && e.summary.length > 500).length
        const fallbackSummaries = allSummarized.filter(e => !e.summary || e.summary.length <= 500).length

        console.log(`[Concurrent Summarization] Complete: ${successfulSummaries} LLM summaries, ${fallbackSummaries} fallbacks`)

        if (fallbackSummaries > 0) {
          console.warn(`[Concurrent Summarization] Warning: ${fallbackSummaries} emails using fallback (truncated body) instead of LLM summary`)
        }
      } else {
        console.log(`[Concurrent Summarization] Skipped - using raw email bodies`)
      }

      // Step 3: Classify emails using workflow loop with batch processing
      // Following Python implementation: calculate batches → process each batch → accumulate results
      setClassifying(true)
      setClassificationProgress({ current: 0, total: summarizedEmails.length })

      // Parse provider and model from selected taxonomy model (format: "provider:model")
      const [llmProvider, llmModel] = selectedTaxonomyModel.split(':')

      // Mark all emails as classifying
      setEmails(prev => prev.map(e => ({ ...e, classifying: true })))

      try {
        // Import batch optimizer (dynamic import for client-side)
        const { calculateAllBatches } = await import('@/lib/batch-optimizer')

        // Calculate all batches based on context window and email sizes
        // Use summarized emails (shorter than raw bodies)
        const batches = calculateAllBatches(
          summarizedEmails.map(e => ({ id: e.id, subject: e.subject, body: e.summary || e.body, from: e.from })),
          llmProvider,
          llmModel
        )

        console.log(`[Workflow Loop] Processing ${summarizedEmails.length} emails in ${batches.length} batches`)

        // Accumulate all classifications across batches
        const allClassifications: Record<string, any> = {}

        // WORKFLOW LOOP: Process each batch sequentially
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex]
          const batchEmails = summarizedEmails.slice(batch.start, batch.start + batch.size)

          console.log(`[Workflow Loop] Batch ${batchIndex + 1}/${batches.length}: Processing emails ${batch.start}-${batch.start + batch.size - 1}`)

          // Update progress (show END of batch, not start)
          setClassificationProgress({ current: batch.start + batch.size, total: downloadedEmails.length })

          try {
            // Log batch preparation for verification
            console.log('📧 [Stage 3] Preparing batch for classification:', {
              batch: batchIndex + 1,
              total_batches: batches.length,
              email_count: batchEmails.length,
              summaries_present: batchEmails.filter(e => e.summary).length,
              sample_emails: batchEmails.slice(0, 2).map(e => ({
                id: e.id,
                subject: e.subject.substring(0, 50) + '...',
                has_summary: !!e.summary,
                summary_length: e.summary?.length || 0,
                summary_preview: e.summary?.substring(0, 80) + '...' || 'NO SUMMARY'
              }))
            })

            // Process this batch through the workflow
            // DIAGNOSTIC: Log request payload
            // Use 'default_user' for consistent profile lookup across sessions
            const requestPayload = {
              user_id: 'default_user',
              emails: batchEmails.map(email => {
                // [DIAGNOSTIC] Log exact summary values being sent to API
                console.log(`[DEBUG] Email ${email.id} summary details:`, {
                  has_summary: !!email.summary,
                  summary_length: email.summary?.length || 0,
                  summary_type: typeof email.summary,
                  summary_preview: email.summary?.substring(0, 100) || 'NO SUMMARY',
                  has_body: !!email.body,
                  body_length: email.body?.length || 0,
                })

                return {
                  id: email.id,
                  subject: email.subject,
                  from: email.from,
                  // FIX Bug #1: Don't send raw body - analyzers only use summary
                  // Sending full body wastes 10x-20x tokens (bodies: 1000s tokens, summaries: 100-200 tokens)
                  summary: email.summary || email.body.substring(0, 500),  // Fallback to substring if no summary
                }
              }),
              source: provider,
              llm_provider: llmProvider,
              llm_model: llmModel,
              batch_index: batchIndex,
              total_batches: batches.length,
            }

            console.log('[DIAGNOSTIC] API Request:', {
              url: '/api/classify',
              payload_size: JSON.stringify(requestPayload).length,
              email_count: batchEmails.length,
              llm: `${llmProvider}:${llmModel}`,
            })

            const response = await fetch('/api/classify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestPayload)
            })

            // DIAGNOSTIC: Log response details BEFORE parsing
            console.log('[DIAGNOSTIC] API Response:', {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              headers: Object.fromEntries(response.headers.entries()),
            })

            const result = await response.json()

            // DIAGNOSTIC: Log parsed result
            console.log('[DIAGNOSTIC] API Result:', {
              success: result.success,
              has_per_email: !!result.per_email_classifications,
              per_email_count: result.per_email_classifications?.length,
              error: result.error,
              full_result: result,
            })

            // DIAGNOSTIC: Log sample classifications
            if (result.per_email_classifications?.length > 0) {
              console.log('[DIAGNOSTIC] Sample classifications:', {
                first_email: result.per_email_classifications[0],
                first_classification: result.per_email_classifications[0]?.classification,
                first_all: result.per_email_classifications[0]?.all_classifications,
              })
            }

            if (result.success && result.per_email_classifications) {
              console.log(`[Workflow Loop] Batch ${batchIndex + 1} complete: ${result.per_email_classifications.length} classifications`)

              // Store classifications from this batch
              result.per_email_classifications.forEach((emailResult: any) => {
                allClassifications[emailResult.email_id] = emailResult.classification
              })

              // Update UI with classifications from this batch
              setEmails(prev => prev.map(email => {
                if (allClassifications[email.id]) {
                  return {
                    ...email,
                    classifying: false,
                    classification: allClassifications[email.id],
                    classificationError: undefined,
                  }
                }
                return email
              }))
            } else {
              console.error(`[Workflow Loop] Batch ${batchIndex + 1} failed:`, result.error)
              // Mark emails in this batch as failed
              batchEmails.forEach(email => {
                allClassifications[email.id] = null
              })
            }
          } catch (batchErr: any) {
            console.error(`[Workflow Loop] Batch ${batchIndex + 1} error:`, batchErr)
            // Mark emails in this batch as failed
            batchEmails.forEach(email => {
              allClassifications[email.id] = null
            })
          }
        }

        console.log(`[Workflow Loop] Complete: ${Object.keys(allClassifications).length} emails classified`)

        // Final update: Mark any remaining emails as failed
        setEmails(prev => prev.map(email => {
          if (!allClassifications[email.id]) {
            return {
              ...email,
              classifying: false,
              classificationError: 'Classification failed',
            }
          }
          return email
        }))

      } catch (err: any) {
        console.error('[Workflow Loop] Error:', err)
        setEmails(prev => prev.map(e => ({
          ...e,
          classifying: false,
          classificationError: err.message || 'Batch classification failed',
        })))
      }

      setClassifying(false)

    } catch (err: any) {
      console.error('Download error:', err)
      setError(err.message || 'Failed to download emails')
      setLoading(false)
      setClassifying(false)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800'
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          📥 Email Download & Classification
        </h1>
        <p className="text-gray-600">
          Download emails from Gmail or Outlook and automatically run IAB classification
        </p>
      </div>

      {/* Navigation to Analyzer Pages */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Analysis & Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/evidence"
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start">
              <span className="text-2xl mr-3">🔍</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Evidence & Reasoning</h3>
                <p className="text-sm text-gray-600">
                  View LLM explanations and evidence for each classification
                </p>
              </div>
            </div>
          </a>

          <a
            href="/confidence"
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start">
              <span className="text-2xl mr-3">📊</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Confidence Analysis</h3>
                <p className="text-sm text-gray-600">
                  See classifications grouped by confidence level (high/medium/low)
                </p>
              </div>
            </div>
          </a>

          <a
            href="/profile"
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start">
              <span className="text-2xl mr-3">👤</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Tiered Profile</h3>
                <p className="text-sm text-gray-600">
                  View complete IAB profile with demographics, interests, and purchase intent
                </p>
              </div>
            </div>
          </a>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-green-600 mr-2">✓</span>
            <div>
              <div className="font-semibold text-green-800">Success</div>
              <div className="text-sm text-green-600 mt-1">{success}</div>
            </div>
          </div>
        </div>
      )}

      {/* OAuth Connection Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Email Provider Status
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          OAuth authentication status for your email providers
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gmail Status */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-2">📧</span>
                <div>
                  <div className="font-medium text-gray-900">Gmail</div>
                  <div className="text-xs text-gray-500">Google Workspace</div>
                </div>
              </div>
              {gmailStatus === 'checking' && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center">
                  <span className="animate-pulse mr-1">●</span> Checking...
                </span>
              )}
              {gmailStatus === 'connected' && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center">
                  ✓ Connected
                </span>
              )}
              {gmailStatus === 'not_connected' && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded flex items-center">
                  ⚠ Not Connected
                </span>
              )}
            </div>
            {gmailStatus === 'not_connected' && (
              <p className="text-xs text-gray-500 mt-3">
                OAuth will start automatically when you try to download emails
              </p>
            )}
          </div>

          {/* Outlook Status */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-2">📨</span>
                <div>
                  <div className="font-medium text-gray-900">Outlook</div>
                  <div className="text-xs text-gray-500">Microsoft 365</div>
                </div>
              </div>
              {outlookStatus === 'checking' && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center">
                  <span className="animate-pulse mr-1">●</span> Checking...
                </span>
              )}
              {outlookStatus === 'connected' && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center">
                  ✓ Connected
                </span>
              )}
              {outlookStatus === 'not_connected' && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded flex items-center">
                  ⚠ Not Connected
                </span>
              )}
            </div>
            {outlookStatus === 'not_connected' && (
              <p className="text-xs text-gray-500 mt-3">
                OAuth will start automatically when you try to download emails
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="text-xs text-blue-800">
            <strong>Note:</strong> OAuth credentials must be configured in .env.local.
            See .env.example for setup instructions.
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>

        <div className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'both' | 'gmail' | 'outlook')}
              disabled={loading || classifying}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="both">Both (Gmail + Outlook)</option>
              <option value="gmail">Gmail Only</option>
              <option value="outlook">Outlook Only</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {provider === "both"
                ? "Download from both Gmail and Outlook accounts"
                : `Download from ${provider === "gmail" ? "Gmail" : "Outlook"} account only`}
            </p>
          </div>

          {/* Max Emails */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Emails
            </label>
            <input
              type="number"
              value={maxEmails}
              onChange={(e) => setMaxEmails(e.target.value)}
              onBlur={(e) => {
                const val = parseInt(e.target.value)
                if (isNaN(val) || val < 1) {
                  setMaxEmails(1)
                } else if (val > 100) {
                  setMaxEmails(100)
                } else {
                  setMaxEmails(val)
                }
              }}
              min={1}
              max={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={loading || classifying}
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of emails to download (1-100)
            </p>
          </div>

          {/* Model Selection - Email Summarization */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Email Summarization Model (Fast)
              </label>
              <button
                onClick={() => loadModels(true)}
                disabled={loadingModels || loading || classifying}
                className="text-xs px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingModels ? 'Refreshing...' : 'Refresh Models'}
              </button>
            </div>
            <select
              value={selectedEmailModel}
              onChange={(e) => setSelectedEmailModel(e.target.value)}
              disabled={loading || classifying || !models}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {!models && <option value="">Loading models...</option>}
              {models && (
                <>
                  <optgroup label="OpenAI">
                    {models.openai.map(model => (
                      <option key={model} value={`openai:${model}`}>
                        {model}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Claude (Anthropic)">
                    {models.anthropic.map(model => (
                      <option key={model} value={`anthropic:${model}`}>
                        {model}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Google Gemini">
                    {models.google.map(model => (
                      <option key={model} value={`google:${model}`}>
                        {model}
                      </option>
                    ))}
                  </optgroup>
                  {models.ollama && models.ollama.length > 0 && (
                    <optgroup label="Ollama (Local)">
                      {models.ollama.map(model => (
                        <option key={model} value={`ollama:${model}`}>
                          {model}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Fast model for email preprocessing (recommended: Gemini Flash)
            </p>
          </div>

          {/* Model Selection - IAB Taxonomy Classification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IAB Classification Model (Accurate)
            </label>
            <select
              value={selectedTaxonomyModel}
              onChange={(e) => setSelectedTaxonomyModel(e.target.value)}
              disabled={loading || classifying || !models}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {!models && <option value="">Loading models...</option>}
              {models && (
                <>
                  <optgroup label="OpenAI">
                    {models.openai.map(model => (
                      <option key={model} value={`openai:${model}`}>
                        {model}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Claude (Anthropic)">
                    {models.anthropic.map(model => (
                      <option key={model} value={`anthropic:${model}`}>
                        {model}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Google Gemini">
                    {models.google.map(model => (
                      <option key={model} value={`google:${model}`}>
                        {model}
                      </option>
                    ))}
                  </optgroup>
                  {models.ollama && models.ollama.length > 0 && (
                    <optgroup label="Ollama (Local)">
                      {models.ollama.map(model => (
                        <option key={model} value={`ollama:${model}`}>
                          {model}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Accurate model for IAB taxonomy classification (recommended: GPT-4o-mini or Claude)
            </p>
          </div>

          {/* Summarization Toggle */}
          <div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="skip-summarization"
                checked={skipSummarization}
                onChange={(e) => setSkipSummarization(e.target.checked)}
                disabled={loading || classifying}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="skip-summarization" className="text-sm font-medium text-gray-700">
                Skip summarization (use raw email bodies)
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {skipSummarization
                ? "⚠️ Advanced: Raw emails sent directly to classifier (slower, more expensive)"
                : "✅ Default: Fast model summarizes, then accurate model classifies (recommended)"}
            </p>
          </div>

          {/* Download & Classify Button */}
          <div>
            <button
              onClick={handleDownloadAndClassify}
              disabled={loading || classifying}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Downloading...' : classifying ? `Classifying ${classificationProgress.current}/${classificationProgress.total}...` : (gmailConnected || outlookConnected) ? 'Download & Classify Emails' : `Connect ${provider === 'gmail' ? 'Gmail' : 'Outlook'} & Download`}
            </button>
            {!(gmailConnected || outlookConnected) && (
              <p className="text-xs text-gray-500 mt-2">
                OAuth will start automatically when you click the button above
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-red-600 mr-2">❌</span>
            <div>
              <div className="font-semibold text-red-800">Error</div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Classification Progress */}
      {classifying && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-blue-600 mr-2">🔄</span>
            <div>
              <div className="font-semibold text-blue-800">Classifying Emails</div>
              <div className="text-sm text-blue-600 mt-1">
                Processing email {classificationProgress.current} of {classificationProgress.total}...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {emails.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Email Classifications ({emails.length})
          </h2>

          <div className="space-y-4">
            {emails.map((email, index) => (
              <div
                key={email.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {email.subject}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      From: {email.from}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {email.date}
                    </div>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    #{index + 1}
                  </span>
                </div>

                {/* FIX Bug #4: Display LLM-generated summary instead of raw email body */}
                <div className="text-sm text-gray-700 mb-3 line-clamp-2">
                  {email.summary
                    ? email.summary  // Show clean LLM summary
                    : email.body.substring(0, 150)  // Fallback to raw body if no summary
                  }
                  {!email.summary && email.body.length > 150 && '...'}
                </div>

                {/* Classification Status */}
                {email.classifying && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-sm text-blue-800">
                      🔄 Classifying...
                    </div>
                  </div>
                )}

                {email.classificationError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                    <div className="text-sm text-red-800 font-medium">
                      Classification Error
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      {email.classificationError}
                    </div>
                  </div>
                )}

                {email.classification && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-green-900">
                          {email.classification.category}
                        </div>
                        <div className="text-xs text-green-700 mt-1">
                          Section: {email.classification.section} | Taxonomy ID: {email.classification.taxonomy_id}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${getConfidenceColor(email.classification.confidence)}`}>
                        {(email.classification.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <div className="text-xs text-green-700 mt-2">
                      <strong>Reasoning:</strong> {email.classification.reasoning}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary Stats */}
          {!classifying && emails.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-900 mb-2">
                Classification Summary
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Total Emails</div>
                  <div className="font-semibold text-gray-900">{emails.length}</div>
                </div>
                <div>
                  <div className="text-gray-600">Classified</div>
                  <div className="font-semibold text-gray-900">
                    {emails.filter(e => e.classification).length}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Errors</div>
                  <div className="font-semibold text-gray-900">
                    {emails.filter(e => e.classificationError).length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
