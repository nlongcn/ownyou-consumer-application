/**
 * Analysis Runner Page - Enhanced with Email Download & Classification
 *
 * Features:
 * - Email download from Gmail/Outlook
 * - IAB classification with progress tracking
 * - Manual text input classification
 * - Job tracking with IndexedDB
 */

'use client'

import { useState, useEffect } from 'react'
import { getClassifierAPI, type ClassificationResult } from '@/lib/classifier-api'
import { GmailClient, type GmailMessage } from '@/lib/gmail-client'
import { OutlookClient, type OutlookMessage } from '@/lib/outlook-client'
import { getProgressTracker, type ProgressUpdate } from '@/lib/progress-tracker'

type Mode = 'manual' | 'email'
type Provider = 'gmail' | 'outlook' | 'both'
type LLMProvider = 'openai' | 'claude' | 'gemini' | 'ollama'

interface EmailMessage {
  id: string
  subject: string
  from: string
  body: string
  date: Date
}

// Helper to get cookie value
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift()
  return undefined
}

export default function AnalyzePage() {
  // Mode selection
  const [mode, setMode] = useState<Mode>('email')

  // User settings
  const [userId, setUserId] = useState('default_user')

  // Manual text mode
  const [text, setText] = useState('')

  // Email mode
  const [provider, setProvider] = useState<Provider>('gmail')
  const [maxEmails, setMaxEmails] = useState(20)
  const [llmProvider, setLLMProvider] = useState<LLMProvider>('openai')
  const [llmModel, setLLMModel] = useState('gpt-4o-mini')

  // OAuth status
  const [authStatus, setAuthStatus] = useState({ gmail: false, outlook: false })

  // Processing state
  const [running, setRunning] = useState(false)
  const [currentJob, setCurrentJob] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressUpdate | null>(null)

  // Results
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [downloadedEmails, setDownloadedEmails] = useState<EmailMessage[]>([])

  // Check OAuth status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  // Poll job progress
  useEffect(() => {
    if (!currentJob) return

    const interval = setInterval(async () => {
      const tracker = getProgressTracker()
      const status = await tracker.getJobStatus(currentJob)
      if (status) {
        setProgress(status)
        if (status.status === 'completed' || status.status === 'failed') {
          setRunning(false)
          clearInterval(interval)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [currentJob])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status')
      const data = await response.json()
      setAuthStatus(data)
    } catch (error) {
      console.error('Failed to check auth status:', error)
    }
  }

  const handleDownloadAndClassify = async () => {
    setRunning(true)
    setResult(null)
    setDownloadedEmails([])
    setProgress(null)

    try {
      const tracker = getProgressTracker()

      // Create job
      const jobId = await tracker.createJob({
        userId,
        provider,
        maxEmails,
        emailModel: llmModel,
        taxonomyModel: llmModel,
      })
      setCurrentJob(jobId)

      await tracker.updateProgress(jobId, {
        status: 'downloading',
        step: 'download',
      })

      // Download emails
      await tracker.log('info', `Starting email download from ${provider}...`, jobId)
      const emails = await downloadEmails(provider, maxEmails, tracker, jobId)
      setDownloadedEmails(emails)

      await tracker.updateProgress(jobId, {
        status: 'classifying',
        step: 'classify',
        processed: 0,
        total: emails.length,
      })

      // Classify emails
      await tracker.log('info', `Starting classification of ${emails.length} emails...`, jobId)
      const api = getClassifierAPI(userId)

      let processedCount = 0
      const batchStatus = await api.classifyBatch(
        emails.map((email) => ({
          text: `Subject: ${email.subject}\nFrom: ${email.from}\n\n${email.body}`,
          source: `email_${provider}`,
        })),
        async (status) => {
          processedCount++
          await tracker.updateProgress(jobId, {
            processed: processedCount,
          })
          await tracker.log(
            'info',
            `Processed ${processedCount}/${emails.length} emails`,
            jobId
          )
        }
      )

      await tracker.updateProgress(jobId, {
        status: 'completed',
        step: 'complete',
        processed: emails.length,
        total: emails.length,
      })

      await tracker.log('info', 'Classification complete!', jobId)

      // Convert batch status to result format
      setResult({
        success: batchStatus.status === 'complete',
        error: batchStatus.error,
      })
    } catch (error) {
      const tracker = getProgressTracker()
      if (currentJob) {
        await tracker.updateProgress(currentJob, {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
        await tracker.log('error', `Job failed: ${error}`, currentJob)
      }
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setRunning(false)
    }
  }

  const downloadEmails = async (
    provider: Provider,
    maxEmails: number,
    tracker: ReturnType<typeof getProgressTracker>,
    jobId: string
  ): Promise<EmailMessage[]> => {
    const allEmails: EmailMessage[] = []

    const providers: Array<'gmail' | 'outlook'> =
      provider === 'both' ? ['gmail', 'outlook'] : [provider]

    for (const prov of providers) {
      await tracker.log('info', `Downloading from ${prov}...`, jobId)

      if (prov === 'gmail') {
        const client = new GmailClient(getCookie('gmail_access_token') || '')
        const response = await client.listMessages(undefined, maxEmails)
        const messageIds = response.messages || []
        for (const msg of messageIds) {
          const details = await client.getMessage(msg.id)
          allEmails.push(convertGmailMessage(details))
        }
      } else {
        const client = new OutlookClient(getCookie('outlook_access_token') || '')
        const response = await client.listMessages(undefined, maxEmails)
        const messages = response.value || []
        for (const msg of messages) {
          const details = await client.getMessage(msg.id)
          allEmails.push(convertOutlookMessage(details))
        }
      }

      await tracker.log('info', `Downloaded ${allEmails.length} emails from ${prov}`, jobId)
    }

    return allEmails
  }

  const convertGmailMessage = (msg: GmailMessage): EmailMessage => {
    const headers = msg.payload?.headers || []
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

    return {
      id: msg.id,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      body: msg.snippet || '',
      date: new Date(parseInt(msg.internalDate || '0')),
    }
  }

  const convertOutlookMessage = (msg: OutlookMessage): EmailMessage => {
    return {
      id: msg.id,
      subject: msg.subject || '',
      from: msg.from?.emailAddress?.address || '',
      body: msg.bodyPreview || '',
      date: new Date(msg.receivedDateTime || Date.now()),
    }
  }

  const handleAnalyzeText = async () => {
    if (!text.trim()) {
      alert('Please enter some text to analyze')
      return
    }

    setRunning(true)
    setResult(null)

    try {
      const api = getClassifierAPI(userId)
      const classificationResult = await api.classifyText({
        user_id: userId,
        text: text.trim(),
        source: 'manual_input',
        source_item_id: `manual_${Date.now()}`,
        llm_provider: llmProvider,
        llm_model: llmModel,
      })

      setResult(classificationResult)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setRunning(false)
    }
  }

  const handleClear = () => {
    setText('')
    setResult(null)
    setDownloadedEmails([])
    setProgress(null)
    setCurrentJob(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analysis Runner</h1>
        <p className="text-gray-600 mt-1">
          Download emails and run IAB Taxonomy classification
        </p>
      </div>

      {/* Mode Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Analysis Mode
        </label>
        <div className="flex space-x-4">
          <button
            onClick={() => setMode('email')}
            className={`px-6 py-3 rounded-lg font-medium ${
              mode === 'email'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📧 Email Download
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`px-6 py-3 rounded-lg font-medium ${
              mode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ✍️ Manual Text
          </button>
        </div>
      </div>

      {/* User ID Input */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          User ID
        </label>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="default_user"
        />
        <p className="text-xs text-gray-500 mt-1">
          Classifications will be stored for this user ID
        </p>
      </div>

      {/* Email Mode */}
      {mode === 'email' && (
        <>
          {/* OAuth Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">OAuth Status</h3>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    authStatus.gmail ? 'bg-green-500' : 'bg-red-500'
                  }`}
                ></span>
                <span className="text-sm text-gray-700">Gmail</span>
                {!authStatus.gmail && (
                  <a
                    href="/api/auth/gmail"
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Connect
                  </a>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    authStatus.outlook ? 'bg-green-500' : 'bg-red-500'
                  }`}
                ></span>
                <span className="text-sm text-gray-700">Outlook</span>
                {!authStatus.outlook && (
                  <a
                    href="/api/auth/outlook"
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Email Settings */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Email Settings</h3>

            {/* Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
                <option value="both">Both</option>
              </select>
            </div>

            {/* Max Emails */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Emails
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxEmails}
                onChange={(e) => setMaxEmails(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">1-100 emails</p>
            </div>

            {/* LLM Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LLM Provider
              </label>
              <select
                value={llmProvider}
                onChange={(e) => setLLMProvider(e.target.value as LLMProvider)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="openai">OpenAI</option>
                <option value="claude">Anthropic (Claude)</option>
                <option value="gemini">Google (Gemini)</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>

            {/* LLM Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LLM Model
              </label>
              <input
                type="text"
                value={llmModel}
                onChange={(e) => setLLMModel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="gpt-4o-mini"
              />
              <p className="text-xs text-gray-500 mt-1">
                Examples: gpt-4o-mini, claude-3-5-sonnet-20241022, gemini-1.5-flash
              </p>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleDownloadAndClassify}
            disabled={running}
            className={`w-full px-6 py-4 rounded-lg font-medium text-lg ${
              running
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {running ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-6 w-6 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {progress?.step === 'download'
                  ? 'Downloading Emails...'
                  : 'Classifying Emails...'}
              </span>
            ) : (
              '🚀 Download & Classify Emails'
            )}
          </button>
        </>
      )}

      {/* Manual Text Mode */}
      {mode === 'manual' && (
        <>
          {/* LLM Settings */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">LLM Settings</h3>

            {/* LLM Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LLM Provider
              </label>
              <select
                value={llmProvider}
                onChange={(e) => setLLMProvider(e.target.value as LLMProvider)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="openai">OpenAI</option>
                <option value="claude">Anthropic (Claude)</option>
                <option value="gemini">Google (Gemini)</option>
              </select>
            </div>

            {/* LLM Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LLM Model
              </label>
              <input
                type="text"
                value={llmModel}
                onChange={(e) => setLLMModel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>

          {/* Text Input */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text to Analyze
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="Enter email text, transaction description, or any other content to classify..."
            />
            <p className="text-xs text-gray-500 mt-1">{text.length} characters</p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleAnalyzeText}
              disabled={running || !text.trim()}
              className={`flex-1 px-6 py-3 rounded-lg font-medium ${
                running || !text.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {running ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Running Classification...
                </span>
              ) : (
                'Run IAB Classification'
              )}
            </button>

            <button
              onClick={handleClear}
              disabled={running}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
        </>
      )}

      {/* Progress */}
      {progress && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Progress</h2>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span className="capitalize">{progress.status}</span>
              <span>
                {progress.processed} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((progress.processed / progress.total) * 100)}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Logs */}
          {progress.logs && progress.logs.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Recent Logs</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                {progress.logs.slice(-20).map((log, i) => (
                  <p key={i} className="text-xs text-gray-600 font-mono">
                    {log}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Downloaded Emails Preview */}
      {downloadedEmails.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Downloaded Emails ({downloadedEmails.length})
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {downloadedEmails.slice(0, 10).map((email) => (
              <div key={email.id} className="border border-gray-200 rounded p-3">
                <p className="text-sm font-medium text-gray-900">{email.subject}</p>
                <p className="text-xs text-gray-500">{email.from}</p>
              </div>
            ))}
            {downloadedEmails.length > 10 && (
              <p className="text-xs text-gray-500 text-center">
                ... and {downloadedEmails.length - 10} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Classification Results
          </h2>

          {result.success ? (
            <div className="space-y-4">
              {/* Success Banner */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-900 font-medium">
                  ✅ Classification Successful
                  {downloadedEmails.length > 0 &&
                    ` - ${downloadedEmails.length} emails processed`}
                </p>
              </div>

              {result.classification && (
                <>
                  {/* Classification Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Section</p>
                      <p className="text-lg font-semibold text-gray-900 capitalize">
                        {result.classification.section}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Category</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {result.classification.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Confidence</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {Math.round(result.classification.confidence * 100)}%
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${result.classification.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Taxonomy ID</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {result.classification.taxonomy_id || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div>
                    <p className="text-sm text-gray-500 mb-2">LLM Reasoning</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {result.classification.reasoning}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Action */}
              <div className="flex items-center space-x-4 pt-4 border-t">
                <a
                  href="/profile"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Profile →
                </a>
                <a
                  href="/dashboard"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Dashboard →
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-900 font-medium mb-2">❌ Classification Failed</p>
              <p className="text-red-700 text-sm">{result.error || 'Unknown error occurred'}</p>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">How It Works</h3>
        <ul className="text-blue-700 space-y-1 text-sm">
          <li>
            • Downloads emails directly from Gmail/Outlook APIs (OAuth in browser)
          </li>
          <li>• Runs 4 IAB analyzer agents (Demographics, Household, Interests, Purchase)</li>
          <li>• Supports OpenAI, Claude, and Google Gemini models</li>
          <li>• Stores results in browser IndexedDB (self-sovereign)</li>
          <li>• All processing happens locally in your browser</li>
          <li>• No Python subprocess, no backend server required</li>
        </ul>
      </div>

      {/* Clear Button */}
      {(result || downloadedEmails.length > 0) && (
        <button
          onClick={handleClear}
          className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
        >
          Clear Results & Start New Analysis
        </button>
      )}
    </div>
  )
}
