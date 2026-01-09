import { useState, useRef } from 'react'
import { Email, EmailProvider, StageStatus, Stage1Export } from '../../lib/ab-testing/types'
import { exportStage1, importStage1 } from '../../lib/ab-testing/export-import'

interface Stage1PanelProps {
  status: StageStatus
  emails: Email[]
  config: {
    provider: EmailProvider
    maxEmails: number
  }
  onConfigChange: (config: { provider: EmailProvider; maxEmails: number }) => void
  onDownload: () => Promise<void>
  onImport: (data: Stage1Export) => void
  onExport: () => void
  disabled?: boolean
}

export function Stage1Panel({
  status,
  emails,
  config,
  onConfigChange,
  onDownload,
  onImport,
  onExport,
  disabled = false,
}: Stage1PanelProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownload = async () => {
    setError(null)
    setIsDownloading(true)
    try {
      await onDownload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    try {
      const data = await importStage1(file)
      onImport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleExport = () => {
    exportStage1(emails, {
      ...config,
      userId: 'ab_testing_user',
    })
    onExport()
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${disabled ? 'opacity-50' : ''}`}>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">Stage 1</span>
        Email Download
      </h2>

      {/* Configuration */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Provider
          </label>
          <select
            value={config.provider}
            onChange={(e) => onConfigChange({ ...config, provider: e.target.value as EmailProvider })}
            disabled={disabled || status === 'running'}
            className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
          >
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Emails
          </label>
          <input
            type="number"
            value={config.maxEmails || ''}
            onChange={(e) => {
              const value = e.target.value
              if (value === '') {
                // Allow empty during editing
                onConfigChange({ ...config, maxEmails: 0 })
              } else {
                const parsed = parseInt(value, 10)
                if (!isNaN(parsed) && parsed >= 0) {
                  // Clamp to max but allow typing any positive number
                  const clamped = Math.min(500, parsed)
                  onConfigChange({ ...config, maxEmails: clamped })
                }
              }
            }}
            onBlur={() => {
              // Ensure valid value on blur (default to 50 if empty or invalid)
              if (config.maxEmails < 1) {
                onConfigChange({ ...config, maxEmails: 50 })
              }
            }}
            disabled={disabled || status === 'running'}
            min={1}
            max={500}
            className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleDownload}
          disabled={disabled || isDownloading}
          data-action="download"
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isDownloading ? 'Downloading...' : 'Download Emails'}
        </button>

        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            disabled={disabled}
            className="hidden"
            id="stage1-upload"
          />
          <label
            htmlFor="stage1-upload"
            className={`block px-4 py-2 border-2 border-dashed rounded cursor-pointer text-center
              ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300 hover:border-blue-500 text-gray-600 hover:text-blue-500'}`}
          >
            Upload JSON
          </label>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {/* Status display */}
      {emails.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded p-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-green-700 font-medium">{emails.length} emails loaded</span>
              <p className="text-sm text-green-600 mt-1">
                Ready for pre-processing
              </p>
            </div>
            <button
              onClick={handleExport}
              className="text-green-600 hover:text-green-800 underline text-sm"
            >
              Export Stage 1 JSON
            </button>
          </div>
        </div>
      )}

      {/* Running indicator */}
      {status === 'running' && (
        <div className="flex items-center gap-2 text-blue-600">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Downloading emails...
        </div>
      )}
    </div>
  )
}
