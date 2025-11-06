"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

interface AnalysisJob {
  job_id: string
  status: string
  provider: string
  max_emails: number
  started_at: string
  log_preview?: string
}

interface ModelsResponse {
  openai: string[]
  claude: string[]
  google: string[]
  ollama: string[]
  last_email_model: string
  last_taxonomy_model: string
  last_max_emails?: number
}

export default function AnalyzePage() {
  // Mode selection
  const [mode, setMode] = useState<"full" | "discrete">("full")

  // Full pipeline mode state
  const [provider, setProvider] = useState("both")
  const [maxEmails, setMaxEmails] = useState<number | string>(20)
  const [running, setRunning] = useState(false)
  const [currentJob, setCurrentJob] = useState<AnalysisJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<{gmail: boolean, outlook: boolean} | null>(null)
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [selectedEmailModel, setSelectedEmailModel] = useState<string>("")
  const [selectedTaxonomyModel, setSelectedTaxonomyModel] = useState<string>("")
  const [loadingModels, setLoadingModels] = useState(false)
  const [skipSummarization, setSkipSummarization] = useState(false)
  const [enableStudio, setEnableStudio] = useState(false)
  const [studioUrl, setStudioUrl] = useState<string>("")
  const [studioLoading, setStudioLoading] = useState(false)
  const [studioError, setStudioError] = useState<string>("")
  const [studioStatus, setStudioStatus] = useState<'unknown' | 'running' | 'stopped'>('unknown')

  // Discrete step mode state
  const [step1Job, setStep1Job] = useState<AnalysisJob | null>(null)
  const [step2Job, setStep2Job] = useState<AnalysisJob | null>(null)
  const [step3Job, setStep3Job] = useState<AnalysisJob | null>(null)
  const [step1OutputFile, setStep1OutputFile] = useState<string>("")
  const [step2OutputFile, setStep2OutputFile] = useState<string>("")
  const [step3OutputFile, setStep3OutputFile] = useState<string>("")
  const [step2InputFile, setStep2InputFile] = useState<string>("")
  const [step3InputFile, setStep3InputFile] = useState<string>("")

  const router = useRouter()

  // Check authentication status and load models on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.getAnalyzeAuthStatus()
        setAuthStatus(response)
      } catch (err) {
        console.error('Failed to check auth status:', err)
      }
    }
    checkAuth()
    loadModels(true)  // Always refresh models from API on page load

    // Restore step output files from localStorage
    const savedStep1Output = localStorage.getItem('step1OutputFile')
    const savedStep2Output = localStorage.getItem('step2OutputFile')
    const savedStep3Output = localStorage.getItem('step3OutputFile')

    if (savedStep1Output) {
      setStep1OutputFile(savedStep1Output)
      setStep2InputFile(savedStep1Output) // Auto-populate Step 2 input
    }
    if (savedStep2Output) {
      setStep2OutputFile(savedStep2Output)
      setStep3InputFile(savedStep2Output) // Auto-populate Step 3 input
    }
    if (savedStep3Output) {
      setStep3OutputFile(savedStep3Output)
    }
  }, [])

  const loadModels = async (refresh = false) => {
    try {
      setLoadingModels(true)
      const url = `/api/analyze/models${refresh ? '?refresh=true' : ''}`
      const data: ModelsResponse = await api.request(url)
      setModels(data)

      // Set selected models to last used or defaults
      if (!selectedEmailModel && data.last_email_model) {
        setSelectedEmailModel(data.last_email_model)
      }
      if (!selectedTaxonomyModel && data.last_taxonomy_model) {
        setSelectedTaxonomyModel(data.last_taxonomy_model)
      }

      // Set max emails to last used or default
      if (data.last_max_emails !== undefined) {
        setMaxEmails(data.last_max_emails)
      }

      // Also check localStorage for user preferences
      const savedEmailModel = localStorage.getItem('selectedEmailModel')
      const savedTaxonomyModel = localStorage.getItem('selectedTaxonomyModel')
      if (savedEmailModel && !selectedEmailModel) {
        setSelectedEmailModel(savedEmailModel)
      } else if (!selectedEmailModel && data.last_email_model) {
        setSelectedEmailModel(data.last_email_model)
      }
      if (savedTaxonomyModel && !selectedTaxonomyModel) {
        setSelectedTaxonomyModel(savedTaxonomyModel)
      } else if (!selectedTaxonomyModel && data.last_taxonomy_model) {
        setSelectedTaxonomyModel(data.last_taxonomy_model)
      }
    } catch (err) {
      console.error('Failed to load models:', err)
    } finally {
      setLoadingModels(false)
    }
  }

  // Handle Studio toggle - check status and auto-start if needed
  const handleStudioToggle = async (checked: boolean) => {
    if (!checked) {
      // Disabling Studio - just update state
      setEnableStudio(false)
      setStudioError("")
      return
    }

    // Enabling Studio - check if server is running
    setStudioLoading(true)
    setStudioError("")

    try {
      // Check current status
      const statusData = await api.request<{
        running: boolean
        url: string | null
        error: string | null
      }>('/api/studio/status')

      if (statusData.running) {
        // Already running - just enable
        setEnableStudio(true)
        setStudioUrl(statusData.url || "")
        setStudioStatus('running')
        setStudioLoading(false)
        return
      }

      // Not running - attempt to start
      setStudioError("Starting LangGraph Studio server...")

      const startData = await api.request<{
        success: boolean
        url?: string
        error?: string
      }>('/api/studio/start', {
        method: 'POST'
      })

      if (startData.success) {
        setEnableStudio(true)
        setStudioUrl(startData.url || "")
        setStudioStatus('running')
        setStudioError("")
      } else {
        setEnableStudio(false)
        setStudioStatus('stopped')
        setStudioError(startData.error || "Failed to start Studio server")
      }
    } catch (err) {
      setEnableStudio(false)
      setStudioStatus('stopped')
      const errorMsg = err instanceof Error ? err.message : 'Failed to start Studio server'
      setStudioError(errorMsg)
      console.error('Studio toggle error:', err)
    } finally {
      setStudioLoading(false)
    }
  }

  // Poll for job status if there's a running job
  useEffect(() => {
    if (!currentJob || currentJob.status !== 'running') return

    const interval = setInterval(async () => {
      try {
        const data = await api.getJobStatus(currentJob.job_id)
        setCurrentJob(data)

        if (data.status === 'completed') {
          setRunning(false)
        }
      } catch (err) {
        console.error('Failed to poll job status:', err)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [currentJob])

  const handleStartAnalysis = async () => {
    try {
      setError(null)
      setRunning(true)

      // Check auth status first
      const authStatus = await api.getAuthStatus()
      if (!authStatus.authenticated) {
        router.push('/login')
        return
      }

      // Save selected models to localStorage
      if (selectedEmailModel) {
        localStorage.setItem('selectedEmailModel', selectedEmailModel)
      }
      if (selectedTaxonomyModel) {
        localStorage.setItem('selectedTaxonomyModel', selectedTaxonomyModel)
      }

      // Start analysis
      const data = await api.request<{
        job_id: string
        status: string
        studio_enabled?: boolean
        studio_url?: string
      }>('/api/analyze/start', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          max_emails: typeof maxEmails === 'string' ? parseInt(maxEmails) : maxEmails,
          email_model: selectedEmailModel,
          taxonomy_model: selectedTaxonomyModel,
          skip_summarization: skipSummarization,
          enable_studio: enableStudio
        })
      })

      // Store Studio URL if enabled
      if (data.studio_enabled && data.studio_url) {
        setStudioUrl(data.studio_url)
      }

      // Start polling for status
      setCurrentJob({
        job_id: data.job_id,
        status: 'running',
        provider,
        max_emails: typeof maxEmails === 'string' ? parseInt(maxEmails) : maxEmails,
        started_at: new Date().toISOString()
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start analysis'
      setError(errorMessage)
      setRunning(false)
    }
  }

  // Discrete Step 1: Download emails
  const handleStep1Download = async () => {
    try {
      setError(null)

      const authStatus = await api.getAuthStatus()
      if (!authStatus.authenticated) {
        router.push('/login')
        return
      }

      const data = await api.downloadEmails({
        provider,
        max_emails: typeof maxEmails === 'string' ? parseInt(maxEmails) : maxEmails
      })

      setStep1Job({
        job_id: data.job_id,
        status: 'running',
        provider,
        max_emails: typeof maxEmails === 'string' ? parseInt(maxEmails) : maxEmails,
        started_at: new Date().toISOString()
      })
      setStep1OutputFile(data.output_file)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start Step 1'
      setError(errorMessage)
    }
  }

  // Discrete Step 2: Summarize emails
  const handleStep2Summarize = async () => {
    try {
      setError(null)

      if (!step2InputFile) {
        setError('Please provide input CSV file from Step 1')
        return
      }

      const authStatus = await api.getAuthStatus()
      if (!authStatus.authenticated) {
        router.push('/login')
        return
      }

      const data = await api.summarizeEmails({
        input_csv: step2InputFile,
        email_model: selectedEmailModel
      })

      setStep2Job({
        job_id: data.job_id,
        status: 'running',
        provider: 'n/a',
        max_emails: 0,
        started_at: new Date().toISOString()
      })
      setStep2OutputFile(data.output_file)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start Step 2'
      setError(errorMessage)
    }
  }

  // Discrete Step 3: Classify emails
  const handleStep3Classify = async () => {
    try {
      setError(null)

      if (!step3InputFile) {
        setError('Please provide input CSV file from Step 2')
        return
      }

      const authStatus = await api.getAuthStatus()
      if (!authStatus.authenticated) {
        router.push('/login')
        return
      }

      const data = await api.classifyEmails({
        input_csv: step3InputFile,
        taxonomy_model: selectedTaxonomyModel,
        enable_studio: enableStudio
      })

      // Store Studio URL if enabled
      if (data.studio_enabled && data.studio_url) {
        setStudioUrl(data.studio_url)
      }

      setStep3Job({
        job_id: data.job_id,
        status: 'running',
        provider: 'n/a',
        max_emails: 0,
        started_at: new Date().toISOString()
      })
      setStep3OutputFile(data.output_file)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start Step 3'
      setError(errorMessage)
    }
  }

  // Poll for discrete step jobs
  useEffect(() => {
    const pollJob = async (job: AnalysisJob | null, setJob: (job: AnalysisJob) => void) => {
      if (!job || job.status !== 'running') return

      try {
        const data = await api.getJobStatus(job.job_id)
        setJob(data)
      } catch (err) {
        console.error('Failed to poll job status:', err)
      }
    }

    const interval = setInterval(() => {
      if (step1Job) pollJob(step1Job, setStep1Job)
      if (step2Job) pollJob(step2Job, setStep2Job)
      if (step3Job) pollJob(step3Job, setStep3Job)
    }, 3000)

    return () => clearInterval(interval)
  }, [step1Job, step2Job, step3Job])

  // Auto-populate next step input when previous step completes
  useEffect(() => {
    if (step1Job?.status === 'completed' && step1OutputFile && !step2InputFile) {
      setStep2InputFile(step1OutputFile)
    }
  }, [step1Job, step1OutputFile, step2InputFile])

  useEffect(() => {
    if (step2Job?.status === 'completed' && step2OutputFile && !step3InputFile) {
      setStep3InputFile(step2OutputFile)
    }
  }, [step2Job, step2OutputFile, step3InputFile])

  // Persist step output files to localStorage
  useEffect(() => {
    if (step1OutputFile) {
      localStorage.setItem('step1OutputFile', step1OutputFile)
    }
  }, [step1OutputFile])

  useEffect(() => {
    if (step2OutputFile) {
      localStorage.setItem('step2OutputFile', step2OutputFile)
    }
  }, [step2OutputFile])

  useEffect(() => {
    if (step3OutputFile) {
      localStorage.setItem('step3OutputFile', step3OutputFile)
    }
  }, [step3OutputFile])

  // Helper function to view logs in new window
  const viewLogs = async (jobId: string, stepName: string) => {
    try {
      const data = await api.request<{ logs: string }>(`/api/analyze/logs/${jobId}`)
      const logWindow = window.open('', '_blank')
      if (logWindow) {
        logWindow.document.write(`
          <html>
            <head>
              <title>${stepName} Logs - ${jobId}</title>
              <style>
                body {
                  font-family: monospace;
                  background: #1e1e1e;
                  color: #d4d4d4;
                  padding: 20px;
                  margin: 0;
                }
                pre {
                  white-space: pre-wrap;
                  word-wrap: break-word;
                }
                .highlight { background: #264f78; padding: 2px; }
              </style>
            </head>
            <body>
              <h2>${stepName} Logs: ${jobId}</h2>
              <pre>${data.logs.replace(/google|gemini|LLM_PROVIDER|EMAIL_MODEL|TAXONOMY_MODEL/gi, (match) => `<span class="highlight">${match}</span>`)}</pre>
            </body>
          </html>
        `)
      }
    } catch (err) {
      console.error('Failed to load logs:', err)
      alert('Failed to load logs: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Run Analysis</h1>
          <p className="text-muted-foreground">
            Download and process new emails to update your profile
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setMode("full")}
          className={`px-4 py-2 font-medium transition-colors ${
            mode === "full"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Full Pipeline
        </button>
        <button
          onClick={() => setMode("discrete")}
          className={`px-4 py-2 font-medium transition-colors ${
            mode === "discrete"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Step-by-Step
        </button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Full Pipeline Mode */}
      {mode === "full" && (
        <Card>
          <CardHeader>
            <CardTitle>Email Analysis Configuration</CardTitle>
            <CardDescription>
              Configure and start email download and processing
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            >
              <option value="both">Both (Gmail + Outlook)</option>
              <option value="gmail">Gmail Only</option>
              <option value="outlook">Outlook Only</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {provider === "both"
                ? "Download from both Gmail and Outlook accounts"
                : `Download from ${provider === "gmail" ? "Gmail" : "Outlook"} account only`}
            </p>
            {authStatus && (
              <div className="flex gap-2 text-xs">
                <span className={authStatus.gmail ? "text-green-600" : "text-amber-600"}>
                  Gmail: {authStatus.gmail ? "✓ Authenticated" : "⚠ Not authenticated"}
                </span>
                <span className={authStatus.outlook ? "text-green-600" : "text-amber-600"}>
                  Outlook: {authStatus.outlook ? "✓ Authenticated" : "⚠ Not authenticated"}
                </span>
              </div>
            )}
          </div>

          {/* Max Emails */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Maximum Emails</label>
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
              disabled={running}
              min={1}
              max={100}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Number of emails to download (1-100)
            </p>
          </div>

          {/* Model Selection - Email Summarization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Email Summarization Model (Fast)</label>
              <button
                onClick={() => loadModels(true)}
                disabled={loadingModels || running}
                className="text-xs px-2 py-1 rounded border hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {loadingModels ? 'Refreshing...' : 'Refresh Models'}
              </button>
            </div>
            <select
              value={selectedEmailModel}
              onChange={(e) => setSelectedEmailModel(e.target.value)}
              disabled={running || !models}
              className="w-full px-3 py-2 rounded-lg border bg-background"
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
                    {models.claude.map(model => (
                      <option key={model} value={`claude:${model}`}>
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
            <p className="text-xs text-muted-foreground">
              Fast model for email preprocessing (recommended: Gemini Flash)
            </p>
          </div>

          {/* Model Selection - IAB Taxonomy Classification */}
          <div className="space-y-2">
            <label className="text-sm font-medium">IAB Classification Model (Accurate)</label>
            <select
              value={selectedTaxonomyModel}
              onChange={(e) => setSelectedTaxonomyModel(e.target.value)}
              disabled={running || !models}
              className="w-full px-3 py-2 rounded-lg border bg-background"
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
                    {models.claude.map(model => (
                      <option key={model} value={`claude:${model}`}>
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
            <p className="text-xs text-muted-foreground">
              Accurate model for IAB taxonomy classification (recommended: GPT-4o-mini or Claude)
            </p>
          </div>

          {/* Summarization Toggle */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="skip-summarization"
                checked={skipSummarization}
                onChange={(e) => setSkipSummarization(e.target.checked)}
                disabled={running}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="skip-summarization" className="text-sm font-medium">
                Skip summarization (use raw email bodies)
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {skipSummarization
                ? "⚠️ Advanced: Raw emails sent directly to classifier (slower, more expensive)"
                : "✅ Default: Fast model summarizes, then accurate model classifies (recommended)"}
            </p>
          </div>

          {/* Studio Visualization Toggle */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enable-studio"
                checked={enableStudio}
                onChange={(e) => handleStudioToggle(e.target.checked)}
                disabled={running || studioLoading}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="enable-studio" className="text-sm font-medium">
                Enable LangGraph Studio visualization
                {studioLoading && <span className="ml-2 text-xs text-muted-foreground">(Starting...)</span>}
              </label>
            </div>
            {studioError && (
              <p className="text-xs text-red-600">{studioError}</p>
            )}
            {!studioError && (
              <p className="text-xs text-muted-foreground">
                {enableStudio
                  ? "🎨 Studio mode enabled - you can view workflow execution in real-time"
                  : "View workflow agents and state transitions in LangGraph Studio"}
              </p>
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartAnalysis}
            disabled={running}
            className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Processing...' : 'Start Analysis'}
          </button>
        </CardContent>
      </Card>
      )}

      {/* Job Status - Full Pipeline Mode */}
      {mode === "full" && currentJob && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Status</CardTitle>
            <CardDescription>
              Job ID: {currentJob.job_id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="text-lg font-semibold capitalize">{currentJob.status}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Provider</p>
                <p className="text-lg font-semibold capitalize">{currentJob.provider}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Emails</p>
                <p className="text-lg font-semibold">{currentJob.max_emails}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Started</p>
                <p className="text-lg font-semibold">
                  {new Date(currentJob.started_at).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {currentJob.log_preview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Log Output</p>
                  <button
                    onClick={async () => {
                      // Fetch full log and open in new window
                      try {
                        const data = await api.request<{ logs: string }>(`/api/analyze/logs/${currentJob.job_id}`)
                        const logWindow = window.open('', '_blank')
                        if (logWindow) {
                          logWindow.document.write(`
                            <html>
                              <head>
                                <title>Analysis Logs - ${currentJob.job_id}</title>
                                <style>
                                  body {
                                    font-family: monospace;
                                    background: #1e1e1e;
                                    color: #d4d4d4;
                                    padding: 20px;
                                    margin: 0;
                                  }
                                  pre {
                                    white-space: pre-wrap;
                                    word-wrap: break-word;
                                  }
                                  .highlight { background: #264f78; padding: 2px; }
                                </style>
                              </head>
                              <body>
                                <h2>Analysis Logs: ${currentJob.job_id}</h2>
                                <pre>${data.logs.replace(/google|gemini|LLM_PROVIDER|EMAIL_MODEL/gi, (match) => `<span class="highlight">${match}</span>`)}</pre>
                              </body>
                            </html>
                          `)
                        }
                      } catch (err) {
                        console.error('Failed to load logs:', err)
                      }
                    }}
                    className="text-xs px-2 py-1 rounded border hover:bg-accent transition-colors"
                  >
                    View Full Logs
                  </button>
                </div>
                <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono">
                  {currentJob.log_preview}
                </pre>
              </div>
            )}

            {studioUrl && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  🎨 Studio visualization enabled
                </p>
                <a
                  href={studioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View workflow in LangGraph Studio →
                </a>
              </div>
            )}

            {currentJob.status === 'completed' && (
              <div className="flex space-x-2">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  View Updated Profile
                </button>
                <button
                  onClick={() => setCurrentJob(null)}
                  className="flex-1 px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
                >
                  Run Another Analysis
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Discrete Step Mode */}
      {mode === "discrete" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Step-by-Step Analysis</CardTitle>
              <CardDescription>
                Run each step independently for more control and cost savings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                💡 This mode allows you to run each step separately: download emails, summarize them, and classify into IAB categories.
                Perfect for testing different models or resuming from checkpoints.
              </p>
            </CardContent>
          </Card>

          {/* Step 1: Download */}
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Download Emails</CardTitle>
              <CardDescription>Download raw emails from Gmail/Outlook to CSV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step1OutputFile && !step1Job && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    ℹ️ Previous Step 1 output restored: {step1OutputFile}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  disabled={step1Job?.status === 'running'}
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                >
                  <option value="both">Both (Gmail + Outlook)</option>
                  <option value="gmail">Gmail Only</option>
                  <option value="outlook">Outlook Only</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Maximum Emails</label>
                <input
                  type="number"
                  value={maxEmails}
                  onChange={(e) => setMaxEmails(e.target.value)}
                  disabled={step1Job?.status === 'running'}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                />
              </div>

              <button
                onClick={handleStep1Download}
                disabled={step1Job?.status === 'running'}
                className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {step1Job?.status === 'running' ? 'Downloading...' : 'Run Step 1'}
              </button>

              {step1Job && (
                <div className="mt-4 p-4 rounded-lg bg-muted space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Status: <span className="capitalize">{step1Job.status}</span></p>
                    <button
                      onClick={() => viewLogs(step1Job.job_id, 'Step 1 - Download')}
                      className="text-xs px-2 py-1 rounded border hover:bg-accent transition-colors"
                    >
                      View Logs
                    </button>
                  </div>
                  {step1OutputFile && (
                    <p className="text-xs text-muted-foreground">Output: {step1OutputFile}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Summarize */}
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Summarize Emails</CardTitle>
              <CardDescription>Process raw emails with EMAIL_MODEL (fast summarization)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step2OutputFile && !step2Job && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    ℹ️ Previous Step 2 output restored: {step2OutputFile}
                  </p>
                </div>
              )}
              {!step1OutputFile && !step2InputFile && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ Run Step 1 first or provide a raw emails CSV file
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Input CSV (from Step 1)</label>
                <input
                  type="text"
                  value={step2InputFile}
                  onChange={(e) => setStep2InputFile(e.target.value)}
                  placeholder="data/raw_user_123_20251008_120000.csv"
                  disabled={step2Job?.status === 'running'}
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email Summarization Model</label>
                <select
                  value={selectedEmailModel}
                  onChange={(e) => setSelectedEmailModel(e.target.value)}
                  disabled={step2Job?.status === 'running' || !models}
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                >
                  {models && (
                    <>
                      <optgroup label="Google Gemini">
                        {models.google.map(model => (
                          <option key={model} value={`google:${model}`}>{model}</option>
                        ))}
                      </optgroup>
                      <optgroup label="OpenAI">
                        {models.openai.map(model => (
                          <option key={model} value={`openai:${model}`}>{model}</option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>

              <button
                onClick={handleStep2Summarize}
                disabled={!step2InputFile || step2Job?.status === 'running'}
                className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {step2Job?.status === 'running' ? 'Summarizing...' : 'Run Step 2'}
              </button>

              {step2Job && (
                <div className="mt-4 p-4 rounded-lg bg-muted space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Status: <span className="capitalize">{step2Job.status}</span></p>
                    <button
                      onClick={() => viewLogs(step2Job.job_id, 'Step 2 - Summarize')}
                      className="text-xs px-2 py-1 rounded border hover:bg-accent transition-colors"
                    >
                      View Logs
                    </button>
                  </div>
                  {step2OutputFile && (
                    <p className="text-xs text-muted-foreground">Output: {step2OutputFile}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Classify */}
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Classify Emails</CardTitle>
              <CardDescription>Run IAB taxonomy classification with TAXONOMY_MODEL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step3OutputFile && !step3Job && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    ℹ️ Previous Step 3 output restored: {step3OutputFile}
                  </p>
                </div>
              )}
              {!step2OutputFile && !step3InputFile && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ Run Step 2 first or provide a summaries CSV file
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Input CSV (from Step 2)</label>
                <input
                  type="text"
                  value={step3InputFile}
                  onChange={(e) => setStep3InputFile(e.target.value)}
                  placeholder="data/summaries_user_123_20251008_120500.csv"
                  disabled={step3Job?.status === 'running'}
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">IAB Classification Model</label>
                <select
                  value={selectedTaxonomyModel}
                  onChange={(e) => setSelectedTaxonomyModel(e.target.value)}
                  disabled={step3Job?.status === 'running' || !models}
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                >
                  {models && (
                    <>
                      <optgroup label="OpenAI">
                        {models.openai.map(model => (
                          <option key={model} value={`openai:${model}`}>{model}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Claude">
                        {models.claude.map(model => (
                          <option key={model} value={`claude:${model}`}>{model}</option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>

              {/* Studio Toggle for Step 3 */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enable-studio-step3"
                    checked={enableStudio}
                    onChange={(e) => handleStudioToggle(e.target.checked)}
                    disabled={step3Job?.status === 'running' || studioLoading}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <label htmlFor="enable-studio-step3" className="text-sm font-medium">
                    Enable LangGraph Studio visualization
                    {studioLoading && <span className="ml-2 text-xs text-muted-foreground">(Starting...)</span>}
                  </label>
                </div>
                {studioError && (
                  <p className="text-xs text-red-600">{studioError}</p>
                )}
                {!studioError && (
                  <p className="text-xs text-muted-foreground">
                    {enableStudio
                      ? "🎨 Studio mode enabled"
                      : "View workflow agents in LangGraph Studio"}
                  </p>
                )}
              </div>

              <button
                onClick={handleStep3Classify}
                disabled={!step3InputFile || step3Job?.status === 'running'}
                className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {step3Job?.status === 'running' ? 'Classifying...' : 'Run Step 3'}
              </button>

              {step3Job && (
                <div className="mt-4 p-4 rounded-lg bg-muted space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Status: <span className="capitalize">{step3Job.status}</span></p>
                    <button
                      onClick={() => viewLogs(step3Job.job_id, 'Step 3 - Classify')}
                      className="text-xs px-2 py-1 rounded border hover:bg-accent transition-colors"
                    >
                      View Logs
                    </button>
                  </div>
                  {step3OutputFile && (
                    <p className="text-xs text-muted-foreground">Output: {step3OutputFile}</p>
                  )}
                  {studioUrl && (
                    <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-800 dark:text-blue-200 mb-1">
                        🎨 Studio visualization enabled
                      </p>
                      <a
                        href={studioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View workflow in LangGraph Studio →
                      </a>
                    </div>
                  )}
                  {step3Job.status === 'completed' && (
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="mt-2 w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      View Updated Profile
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
