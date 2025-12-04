'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getGmailOAuthClient } from '@/lib/gmail-oauth-client'
import { getOutlookOAuthClient } from '@/lib/outlook-oauth-client'
import { getLLMConfig } from '@/lib/llm-config'
import { IndexedDBStore } from '@/lib/IndexedDBStore'
import { buildWorkflowGraph } from '@ownyou/iab-classifier'
// Sprint 2: Use consolidated @ownyou/llm-client providers
import {
  OpenAIProvider,
  GoogleProvider,
  GroqProvider,
  DeepInfraProvider,
  AnthropicProvider,
} from '@ownyou/llm-client/providers'

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
  groq?: string[]
  deepinfra?: string[]
  last_email_model: string
  last_taxonomy_model: string
  last_max_emails?: number
}

function EmailsLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

export default function EmailDownloadPage() {
  return (
    <Suspense fallback={<EmailsLoading />}>
      <EmailDownloadContent />
    </Suspense>
  )
}

function EmailDownloadContent() {
  const searchParams = useSearchParams()

  // Get user_id from URL parameter, default to 'default_user'
  const userId = searchParams.get('user_id') || 'default_user'

  const [provider, setProvider] = useState<'both' | 'gmail' | 'outlook'>('gmail')
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [gmailStatus, setGmailStatus] = useState<'checking' | 'connected' | 'not_connected'>('checking')
  const [outlookStatus, setOutlookStatus] = useState<'checking' | 'connected' | 'not_connected'>('checking')
  const [maxEmails, setMaxEmails] = useState<number>(10)
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
  const [store, setStore] = useState<IndexedDBStore | null>(null)
  const [storeInitialized, setStoreInitialized] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Fix hydration error: mark as hydrated after client-side mount
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Initialize IndexedDBStore on component mount
  useEffect(() => {
    try {
      console.log('[IndexedDBStore] Initializing persistent store...')
      const newStore = new IndexedDBStore('ownyou_store')
      // IndexedDBStore lazily initializes on first operation (no explicit init() needed)
      setStore(newStore)
      setStoreInitialized(true)
      console.log('[IndexedDBStore] ✅ Store initialized successfully')
    } catch (err) {
      console.error('[IndexedDBStore] ❌ Failed to initialize:', err)
      setError('Failed to initialize persistent storage')
    }
  }, [])

  // Load persisted emails and classifications from IndexedDB on page load
  useEffect(() => {
    if (!store || !storeInitialized) return

    const loadPersistedData = async () => {
      try {
        console.log('[Persistence] Loading emails from IndexedDB...')

        // Episodic memories are stored in namespace [user_id, 'iab_taxonomy_profile']
        // Load ALL items from namespace (no filter), then filter by key in JavaScript
        const allMemories = await store.search([userId, 'iab_taxonomy_profile'], {
          limit: 1000 // High limit to get all emails
        })

        console.log(`[Persistence] Search returned ${allMemories?.length || 0} total memories`)

        // Filter for episodic email memories only
        const episodicMemories = allMemories.filter((item: any) =>
          item.key && item.key.startsWith('episodic_email_')
        )

        console.log(`[Persistence] Found ${episodicMemories?.length || 0} episodic email memories`)

        if (episodicMemories && episodicMemories.length > 0) {
          console.log(`[Persistence] Found ${episodicMemories.length} episodic memories in IndexedDB`)

          // Convert episodic memories to Email format
          const persistedEmails: EmailWithClassification[] = []
          for (const item of episodicMemories) {
            const episodic = (item as any).value
            if (!episodic || !episodic.email_id) {
              console.warn('[Persistence] Skipping invalid episodic memory:', item)
              continue
            }

            console.log(`[Persistence] Loading email: ${episodic.email_id} (${episodic.email_subject})`)

            persistedEmails.push({
              id: episodic.email_id,
              subject: episodic.email_subject || 'No subject',
              from: 'Unknown', // Not stored in episodic memory
              body: episodic.email_summary || '',
              date: episodic.email_date || 'Unknown date',
              provider: 'gmail',
              summary: episodic.email_summary,
              classification: null, // TODO: Load classifications from semantic memories
              classifying: false,
            })
          }

          setEmails(persistedEmails)
          console.log(`[Persistence] ✅ Loaded ${persistedEmails.length} emails from IndexedDB`)
        } else {
          console.log('[Persistence] No persisted emails found - starting fresh')
        }
      } catch (err) {
        console.error('[Persistence] Failed to load from IndexedDB:', err)
        // Don't show error to user - just start fresh
      }
    }

    loadPersistedData()
  }, [store, storeInitialized])

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
      const loadedModels = await loadModels(true)

      if (!loadedModels) return

      // THEN restore settings from localStorage (takes precedence over API defaults)
      const savedEmailModel = localStorage.getItem('selectedEmailModel')
      const savedTaxonomyModel = localStorage.getItem('selectedTaxonomyModel')

      // Default model to use when no saved preference exists
      const defaultModel = 'openai:gpt-4o-mini'

      // Restore email model if saved, otherwise use default
      if (savedEmailModel) {
        console.log(`[Model Restore] Restoring email model: ${savedEmailModel}`)
        setSelectedEmailModel(savedEmailModel)
      } else {
        console.log(`[Model Restore] No saved email model, using default: ${defaultModel}`)
        setSelectedEmailModel(defaultModel)
      }

      // Restore taxonomy model if saved, otherwise use default
      if (savedTaxonomyModel) {
        console.log(`[Model Restore] Restoring taxonomy model: ${savedTaxonomyModel}`)
        setSelectedTaxonomyModel(savedTaxonomyModel)
      } else {
        console.log(`[Model Restore] No saved taxonomy model, using default: ${defaultModel}`)
        setSelectedTaxonomyModel(defaultModel)
      }
    }

    initModels()
  }, [])

  const loadModels = async (refresh = false): Promise<ModelsResponse | null> => {
    try {
      setLoadingModels(true)
      const url = `/api/analyze/models${refresh ? '?refresh=true' : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to load models')
      }

      const data: ModelsResponse = await response.json()
      setModels(data)

      // Set max emails to last used or default
      if (data.last_max_emails !== undefined) {
        setMaxEmails(data.last_max_emails)
      }

      return data
    } catch (err) {
      console.error('Failed to load models:', err)
      // Set defaults if API fails
      const fallbackModels: ModelsResponse = {
        openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        anthropic: ['claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        google: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'],
        ollama: [],
        groq: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        deepinfra: ['meta-llama/Llama-3.3-70B-Instruct', 'meta-llama/Llama-3.1-70B-Instruct', 'meta-llama/Llama-3.1-8B-Instruct', 'Qwen/Qwen2.5-72B-Instruct'],
        last_email_model: 'openai:gpt-4o-mini',
        last_taxonomy_model: 'openai:gpt-4o-mini'
      }
      setModels(fallbackModels)
      setSelectedTaxonomyModel('openai:gpt-4o-mini')
      return fallbackModels
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

        // Debug: Check which user is authenticated
        console.log('[Email Download] Checking authenticated Outlook user...')
        try {
          const user = await client.getCurrentUser()
          console.log('[Email Download] Authenticated as:', user.mail || user.userPrincipalName)
        } catch (err) {
          console.warn('[Email Download] Could not get user info:', err)
        }

        // Debug: List mail folders to see message counts
        console.log('[Email Download] Checking Outlook mailbox folders...')
        try {
          const folders = await client.listMailFolders()
          console.log('[Email Download] Outlook folders:', folders.map(f => ({
            name: f.displayName,
            total: f.totalItemCount,
            unread: f.unreadItemCount
          })))
        } catch (err) {
          console.warn('[Email Download] Could not list folders:', err)
        }

        // Try inbox first, then fall back to all messages
        let response = await client.listMessages(undefined, maxEmails)

        // If inbox returns 0, try /me/messages (all folders) as fallback
        if (!response.value || response.value.length === 0) {
          console.log('[Email Download] Inbox returned 0 emails, trying /me/messages fallback...')
          response = await client.listAllMessages(maxEmails)
        }

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

              // Sprint 2: Create LLM provider with user's API key (browser-direct, no server)
              let provider
              if (emailProvider === 'openai') {
                provider = new OpenAIProvider({
                  apiKey: config.openai.api_key,
                  model: emailModel,
                })
              } else if (emailProvider === 'google') {
                provider = new GoogleProvider({
                  apiKey: config.google.api_key,
                  model: emailModel,
                })
              } else if (emailProvider === 'groq') {
                provider = new GroqProvider({
                  apiKey: config.groq?.api_key || '',
                  model: emailModel,
                })
              } else if (emailProvider === 'deepinfra') {
                provider = new DeepInfraProvider({
                  apiKey: config.deepinfra?.api_key || '',
                  model: emailModel,
                })
              } else if (emailProvider === 'anthropic') {
                provider = new AnthropicProvider({
                  apiKey: config.anthropic?.api_key || '',
                  model: emailModel,
                })
              } else {
                throw new Error(`Unsupported provider: ${emailProvider}`)
              }

              // Call LLM directly using @ownyou/llm-client provider
              // Provider handles model-specific parameters correctly
              //
              // EMAIL SUBJECT DETECTION: Extend summarization to detect WHO the email is about
              // This enables systematic handling of third-party emails (child, spouse, etc.)
              const response = await provider.complete({
                messages: [{
                  role: 'user',
                  content: `Analyze this email and return ONLY valid JSON (no markdown, no code blocks):
{
  "summary": "2-3 sentence summary focusing on main purpose and action items",
  "subject_of_email": "self|child|spouse|household|other",
  "subject_reasoning": "Brief explanation of who the email is about"
}

Rules for subject_of_email:
- "self": Email is directly about/addressed to the email account owner (default)
- "child": Email is about the owner's child (school, activities, healthcare, parental monitoring)
- "spouse": Email is about the owner's spouse/partner
- "household": Email is about the household generally (bills, family plans)
- "other": Email is about someone else (friend, colleague, forwarded content)

Signals for "child":
- Google Classroom, school emails, parent portal
- "Daily summary for [Name]" where Name is NOT the email recipient
- Homework, report cards, school activities
- "Your child", "Your son/daughter", "Your student"
- Parental monitoring or activity summaries for minors

Email to analyze:
Subject: ${email.subject}
From: ${email.from}

${email.body}`
                }],
                model: emailModel,
                // Let OpenAIClient set correct parameters based on model
              })

              // Sprint 2: @ownyou/llm-client provider returns LLMResponse (check for error field)
              if (response.error) {
                console.error(`[Concurrent Summarization] Failed for email ${email.id}:`, response.error)
                return {
                  ...email,
                  summary: email.body.substring(0, 500), // Fallback to substring
                }
              }

              // Parse JSON response for subject detection
              try {
                // Handle potential markdown code blocks
                let jsonContent = response.content.trim()
                if (jsonContent.startsWith('```json')) {
                  jsonContent = jsonContent.slice(7)
                } else if (jsonContent.startsWith('```')) {
                  jsonContent = jsonContent.slice(3)
                }
                if (jsonContent.endsWith('```')) {
                  jsonContent = jsonContent.slice(0, -3)
                }
                jsonContent = jsonContent.trim()

                const parsed = JSON.parse(jsonContent)
                console.log(`[Subject Detection] Email ${email.id}: subject_of_email=${parsed.subject_of_email}, reason="${parsed.subject_reasoning}"`)
                return {
                  ...email,
                  summary: parsed.summary || response.content,
                  subject_of_email: parsed.subject_of_email || 'self',
                  subject_reasoning: parsed.subject_reasoning || '',
                }
              } catch (parseErr) {
                // Fallback: if JSON parsing fails, use raw response as summary
                console.warn(`[Subject Detection] Failed to parse JSON for email ${email.id}, using raw response`)
                return {
                  ...email,
                  summary: response.content,
                  subject_of_email: 'self',  // Default to self if parsing fails
                  subject_reasoning: '',
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

            // ✅ FIX: Run workflow IN BROWSER with IndexedDBStore (not server)
            if (!store) {
              throw new Error('IndexedDBStore not initialized')
            }

            console.log('[Browser Workflow] Processing batch in browser with IndexedDBStore')
            console.log('[Browser Workflow] Batch:', {
              batch_index: batchIndex + 1,
              total_batches: batches.length,
              email_count: batchEmails.length,
              llm: `${llmProvider}:${llmModel}`,
            })

            // Build workflow graph with persistent IndexedDBStore
            const graph = buildWorkflowGraph(store, null, userId)

            // Get LLM config from localStorage
            const llmConfig = getLLMConfig()

            // Prepare LLM config for workflow (workflow expects this structure)
            // Get API key based on provider
            let apiKey = ''
            let temperature = 1.0
            switch (llmProvider) {
              case 'openai':
                apiKey = llmConfig.openai.api_key
                temperature = llmConfig.openai.temperature
                break
              case 'google':
                apiKey = llmConfig.google.api_key
                break
              case 'groq':
                apiKey = llmConfig.groq.api_key
                break
              case 'deepinfra':
                apiKey = llmConfig.deepinfra.api_key
                break
              case 'anthropic':
                apiKey = llmConfig.anthropic.api_key
                break
            }
            const workflowLLMConfig = {
              api_key: apiKey,
              model: llmModel,
              temperature: temperature,
            }

            // Prepare workflow input (Python format)
            const workflowInput = {
              user_id: userId,
              emails: batchEmails.map(email => ({
                id: email.id,
                subject: email.subject,
                from: email.from,
                body: email.body,
                date: email.date,
                summary: email.summary || email.body.substring(0, 500),
              })),
              llm_provider: llmProvider,
              llm_model: llmModel,
              llm_config: workflowLLMConfig,  // Pass LLM config with API keys
              workflow_started_at: new Date().toISOString(),
              batch_size: batchEmails.length,  // Tell workflow to process all emails in this batch at once
            }

            // Execute workflow in browser (data persists to IndexedDB!)
            console.log('[Browser Workflow] Invoking LangGraph workflow...')
            const workflowResult = await graph.invoke(workflowInput)

            console.log('[Browser Workflow] Workflow complete:', {
              demographics: workflowResult.demographics_results?.length || 0,
              household: workflowResult.household_results?.length || 0,
              interests: workflowResult.interests_results?.length || 0,
              purchase: workflowResult.purchase_results?.length || 0,
            })

            // Extract per-email classifications from workflow results
            // Group by email_id to get best classification per email
            const perEmailClassifications = new Map()

            const allResults = [
              ...(workflowResult.demographics_results || []),
              ...(workflowResult.household_results || []),
              ...(workflowResult.interests_results || []),
              ...(workflowResult.purchase_results || []),
            ]

            for (const classification of allResults) {
              const emailIds = classification.email_ids || []
              for (const emailId of emailIds) {
                if (!perEmailClassifications.has(emailId)) {
                  perEmailClassifications.set(emailId, {
                    email_id: emailId,
                    classification: {
                      category: classification.value,
                      confidence: classification.confidence,
                      reasoning: classification.reasoning || '',
                      section: classification.section,
                      taxonomy_id: classification.taxonomy_id?.toString() || '',
                    },
                    all_classifications: [],
                  })
                }
                perEmailClassifications.get(emailId).all_classifications.push(classification)
              }
            }

            const per_email_array = Array.from(perEmailClassifications.values())

            console.log('[Browser Workflow] Per-email classifications:', {
              total_emails: batchEmails.length,
              classified_emails: per_email_array.length,
            })

            if (per_email_array.length > 0) {
              console.log(`[Workflow Loop] Batch ${batchIndex + 1} complete: ${per_email_array.length} classifications`)

              // Store classifications from this batch
              per_email_array.forEach((emailResult: any) => {
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
              console.warn(`[Workflow Loop] Batch ${batchIndex + 1} produced no classifications`)
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
              onChange={(e) => {
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
                  {models.groq && models.groq.length > 0 && (
                    <optgroup label="Groq (Fastest)">
                      {models.groq.map(model => (
                        <option key={model} value={`groq:${model}`}>
                          {model}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {models.deepinfra && models.deepinfra.length > 0 && (
                    <optgroup label="DeepInfra (ZDR Default)">
                      {models.deepinfra.map(model => (
                        <option key={model} value={`deepinfra:${model}`}>
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
                  {models.groq && models.groq.length > 0 && (
                    <optgroup label="Groq (Fastest)">
                      {models.groq.map(model => (
                        <option key={model} value={`groq:${model}`}>
                          {model}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {models.deepinfra && models.deepinfra.length > 0 && (
                    <optgroup label="DeepInfra (ZDR Default)">
                      {models.deepinfra.map(model => (
                        <option key={model} value={`deepinfra:${model}`}>
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
      {emails.length > 0 && hydrated && (
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
