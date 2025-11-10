'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { GmailClient } from '@/lib/gmail-client'
import { OutlookClient } from '@/lib/outlook-client'

interface Email {
  id: string
  from: string
  subject: string
  body: string
  date: string
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

export default function EmailDownloadPage() {
  const searchParams = useSearchParams()
  const [provider, setProvider] = useState<'gmail' | 'outlook'>('gmail')
  const [accessToken, setAccessToken] = useState('')
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [maxEmails, setMaxEmails] = useState(10)
  const [llmProvider, setLlmProvider] = useState('openai')
  const [llmModel, setLlmModel] = useState('gpt-4o-mini')
  const [loading, setLoading] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [classificationProgress, setClassificationProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [emails, setEmails] = useState<EmailWithClassification[]>([])

  // Check for OAuth callback status on mount
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

  const handleDownloadAndClassify = async () => {
    // Check if we have either OAuth connection or manual token
    const hasGmailAuth = provider === 'gmail' && (gmailConnected || accessToken.trim())
    const hasOutlookAuth = provider === 'outlook' && (outlookConnected || accessToken.trim())

    if (!hasGmailAuth && !hasOutlookAuth) {
      setError(`Please connect ${provider} using OAuth or enter an access token manually`)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    setEmails([])

    try {
      let downloadedEmails: Email[] = []

      // Step 1: Download emails
      if (provider === 'gmail') {
        const client = new GmailClient(accessToken)
        const response = await client.listMessages(undefined, maxEmails)

        if (!response.messages || response.messages.length === 0) {
          setLoading(false)
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
        const client = new OutlookClient(accessToken)
        const response = await client.listMessages(undefined, maxEmails)

        if (!response.value || response.value.length === 0) {
          setLoading(false)
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

      // Step 2: Classify each email
      setClassifying(true)
      setClassificationProgress({ current: 0, total: downloadedEmails.length })

      for (let i = 0; i < emailsWithClassification.length; i++) {
        const email = emailsWithClassification[i]

        // Update UI to show which email is being classified
        setEmails(prev => prev.map((e, idx) =>
          idx === i ? { ...e, classifying: true } : e
        ))
        setClassificationProgress({ current: i + 1, total: downloadedEmails.length })

        try {
          // Call classification API
          const response = await fetch('/api/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: `email_${Date.now()}`,
              text: `Subject: ${email.subject}\n\nFrom: ${email.from}\n\n${email.body}`,
              source: provider,
              llm_provider: llmProvider,
              llm_model: llmModel,
            })
          })

          const result = await response.json()

          if (result.success && result.classification) {
            // Update email with classification
            setEmails(prev => prev.map((e, idx) =>
              idx === i ? {
                ...e,
                classification: result.classification,
                classifying: false
              } : e
            ))
          } else {
            // Classification failed
            setEmails(prev => prev.map((e, idx) =>
              idx === i ? {
                ...e,
                classifying: false,
                classificationError: result.error || 'Classification failed'
              } : e
            ))
          }
        } catch (err: any) {
          console.error(`Classification error for email ${i}:`, err)
          setEmails(prev => prev.map((e, idx) =>
            idx === i ? {
              ...e,
              classifying: false,
              classificationError: err.message || 'Classification failed'
            } : e
          ))
        }
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

  const handleConnect = (provider: 'gmail' | 'outlook') => {
    window.location.href = `/api/auth/${provider}/authorize`
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

      {/* OAuth Connection Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Connect Email Provider
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Connect your Gmail or Outlook account to download and classify emails
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gmail Connection */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <span className="text-2xl mr-2">📧</span>
                <div>
                  <div className="font-medium text-gray-900">Gmail</div>
                  <div className="text-xs text-gray-500">Google Workspace</div>
                </div>
              </div>
              {gmailConnected && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Connected
                </span>
              )}
            </div>
            <button
              onClick={() => handleConnect('gmail')}
              disabled={loading || classifying}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
            >
              {gmailConnected ? 'Reconnect Gmail' : 'Connect Gmail'}
            </button>
          </div>

          {/* Outlook Connection */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <span className="text-2xl mr-2">📨</span>
                <div>
                  <div className="font-medium text-gray-900">Outlook</div>
                  <div className="text-xs text-gray-500">Microsoft 365</div>
                </div>
              </div>
              {outlookConnected && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Connected
                </span>
              )}
            </div>
            <button
              onClick={() => handleConnect('outlook')}
              disabled={loading || classifying}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
            >
              {outlookConnected ? 'Reconnect Outlook' : 'Connect Outlook'}
            </button>
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

        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Provider
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="gmail"
                  checked={provider === 'gmail'}
                  onChange={(e) => setProvider(e.target.value as 'gmail')}
                  className="mr-2"
                  disabled={loading || classifying}
                />
                <span>Gmail</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="outlook"
                  checked={provider === 'outlook'}
                  onChange={(e) => setProvider(e.target.value as 'outlook')}
                  className="mr-2"
                  disabled={loading || classifying}
                />
                <span>Outlook</span>
              </label>
            </div>
          </div>

          {/* Access Token (Manual Entry - Optional) */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Manual Token Entry (Optional)
              </label>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                For Testing
              </span>
            </div>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste OAuth access token for manual testing"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={loading || classifying}
            />
            <p className="text-xs text-gray-500 mt-1">
              Only needed if not using OAuth buttons above. Get token from:{' '}
              {provider === 'gmail' ? (
                <a
                  href="https://developers.google.com/oauthplayground/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google OAuth Playground
                </a>
              ) : (
                <a
                  href="https://developer.microsoft.com/en-us/graph/graph-explorer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Microsoft Graph Explorer
                </a>
              )}
            </p>
          </div>

          {/* Max Emails */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Emails
            </label>
            <input
              type="number"
              value={maxEmails}
              onChange={(e) => setMaxEmails(parseInt(e.target.value))}
              min={1}
              max={100}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={loading || classifying}
            />
          </div>

          {/* LLM Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LLM Provider
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="openai"
                  checked={llmProvider === 'openai'}
                  onChange={(e) => setLlmProvider(e.target.value)}
                  className="mr-2"
                  disabled={loading || classifying}
                />
                <span>OpenAI</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="anthropic"
                  checked={llmProvider === 'anthropic'}
                  onChange={(e) => setLlmProvider(e.target.value)}
                  className="mr-2"
                  disabled={loading || classifying}
                />
                <span>Claude</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="google"
                  checked={llmProvider === 'google'}
                  onChange={(e) => setLlmProvider(e.target.value)}
                  className="mr-2"
                  disabled={loading || classifying}
                />
                <span>Gemini</span>
              </label>
            </div>
          </div>

          {/* LLM Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model
            </label>
            <input
              type="text"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              placeholder="e.g., gpt-4o-mini"
              className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={loading || classifying}
            />
          </div>

          {/* Download & Classify Button */}
          <div>
            <button
              onClick={handleDownloadAndClassify}
              disabled={loading || classifying || !(gmailConnected || outlookConnected || accessToken.trim())}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Downloading...' : classifying ? `Classifying ${classificationProgress.current}/${classificationProgress.total}...` : 'Download & Classify Emails'}
            </button>
            {!(gmailConnected || outlookConnected || accessToken.trim()) && (
              <p className="text-xs text-gray-500 mt-2">
                Connect an email provider or enter a manual token above to continue
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

                <div className="text-sm text-gray-700 mb-3 line-clamp-2">
                  {email.body.substring(0, 150)}
                  {email.body.length > 150 && '...'}
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
