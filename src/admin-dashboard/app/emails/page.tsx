'use client'

import { useState } from 'react'
import { GmailClient } from '@/lib/gmail-client'
import { OutlookClient } from '@/lib/outlook-client'

interface Email {
  id: string
  from: string
  subject: string
  body: string
  date: string
}

interface DownloadResult {
  emails: Email[]
  totalDownloaded: number
  provider: string
}

export default function EmailDownloadPage() {
  const [provider, setProvider] = useState<'gmail' | 'outlook'>('gmail')
  const [accessToken, setAccessToken] = useState('')
  const [maxEmails, setMaxEmails] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DownloadResult | null>(null)

  const handleDownload = async () => {
    if (!accessToken.trim()) {
      setError('Please enter an access token')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let emails: Email[] = []

      if (provider === 'gmail') {
        const client = new GmailClient(accessToken)

        // List messages
        const response = await client.listMessages(undefined, maxEmails)

        if (!response.messages || response.messages.length === 0) {
          setResult({
            emails: [],
            totalDownloaded: 0,
            provider: 'Gmail'
          })
          return
        }

        // Fetch full message details
        const messagePromises = response.messages.map(msg =>
          client.getMessage(msg.id, 'full')
        )
        const messages = await Promise.all(messagePromises)

        // Extract email data
        emails = messages.map(msg => ({
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
          setResult({
            emails: [],
            totalDownloaded: 0,
            provider: 'Outlook'
          })
          return
        }

        emails = response.value.map(msg => ({
          id: msg.id,
          from: msg.from?.emailAddress?.address || 'Unknown',
          subject: msg.subject || 'No Subject',
          body: msg.body?.content || 'No body',
          date: msg.receivedDateTime || 'Unknown date'
        }))
      }

      setResult({
        emails,
        totalDownloaded: emails.length,
        provider: provider === 'gmail' ? 'Gmail' : 'Outlook'
      })

    } catch (err: any) {
      console.error('Download error:', err)
      setError(err.message || 'Failed to download emails')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          📥 Email Download
        </h1>
        <p className="text-gray-600">
          Download emails from Gmail or Outlook to run IAB classification
        </p>
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
                  disabled={loading}
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
                  disabled={loading}
                />
                <span>Outlook</span>
              </label>
            </div>
          </div>

          {/* Access Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OAuth Access Token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste your OAuth access token"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Get token from:{' '}
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
              disabled={loading}
            />
          </div>

          {/* Download Button */}
          <div>
            <button
              onClick={handleDownload}
              disabled={loading || !accessToken}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Downloading...' : 'Download Emails'}
            </button>
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

      {/* Results Display */}
      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Downloaded Emails ({result.totalDownloaded})
          </h2>

          {result.totalDownloaded === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No emails found
            </div>
          ) : (
            <div className="space-y-4">
              {result.emails.map((email, index) => (
                <div
                  key={email.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
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
                  <div className="text-sm text-gray-700 mt-2 line-clamp-3">
                    {email.body.substring(0, 200)}
                    {email.body.length > 200 && '...'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Next Steps */}
          {result.totalDownloaded > 0 && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="font-semibold text-blue-900 mb-2">
                Next: Run IAB Classification
              </div>
              <div className="text-sm text-blue-700">
                Go to the Analyze page to run IAB Taxonomy classification on these emails
              </div>
              <a
                href="/analyze"
                className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Go to Analyze Page →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
