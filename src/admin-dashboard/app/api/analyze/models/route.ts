import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface ModelsResponse {
  openai: string[]
  anthropic: string[]
  google: string[]
  ollama: string[]
  groq: string[]
  deepinfra: string[]
  last_email_model: string
  last_taxonomy_model: string
  last_max_emails?: number
}

// Cache for models (5 minute TTL)
let modelsCache: { timestamp: Date | null; models: ModelsResponse | null } = {
  timestamp: null,
  models: null
}

/**
 * Get available LLM models from OpenAI, Anthropic, Google, and Ollama
 *
 * Replicates Python dashboard backend/api/analyze.py get_available_models()
 *
 * Query params:
 *   refresh: Force refresh from APIs (default: false)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // Check cache (valid for 5 minutes)
    if (!forceRefresh && modelsCache.models && modelsCache.timestamp) {
      const age = (new Date().getTime() - modelsCache.timestamp.getTime()) / 1000
      if (age < 300) {  // 5 minutes
        console.log('[Models API] Returning cached models')
        return NextResponse.json(modelsCache.models)
      }
    }

    console.log('[Models API] Fetching fresh model list from providers')

    const models: ModelsResponse = {
      openai: [],
      anthropic: [],
      google: [],
      ollama: [],
      groq: [],
      deepinfra: [],
      last_email_model: 'google:gemini-2.0-flash-exp',
      last_taxonomy_model: 'openai:gpt-4o-mini',
      last_max_emails: 10
    }

    // OpenAI models - fetch from API
    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (apiKey) {
        const client = new OpenAI({ apiKey })
        const response = await client.models.list()

        // Filter for GPT models only (exclude instruct models)
        const gptModels = response.data
          .filter(m => m.id.toLowerCase().includes('gpt') && !m.id.toLowerCase().includes('instruct'))
          .map(m => m.id)
          .sort()

        models.openai = gptModels
        console.log(`[Models API] Found ${gptModels.length} OpenAI models`)
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch OpenAI models:', error)
      // Fallback to known models
      models.openai = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
    }

    // Anthropic (Claude) models - fetch from API
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (apiKey) {
        const client = new Anthropic({ apiKey })

        console.log('[Models API] Fetching Claude models from API using client.models.list()')
        const response = await client.models.list({ limit: 100 })

        const claudeModels = response.data.map(m => m.id)
        models.anthropic = claudeModels
        console.log(`[Models API] Found ${claudeModels.length} Claude models from API`)
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch Claude models from API:', error)
      models.anthropic = []
    }

    // Google Gemini models - fetch from API
    try {
      const apiKey = process.env.GOOGLE_API_KEY
      if (apiKey) {
        const genai = new GoogleGenerativeAI(apiKey)

        // List available models from API
        const geminiModels: string[] = []

        // The Google SDK doesn't expose models.list() in the same way
        // Use known latest models as fallback
        const fallbackModels = [
          'gemini-2.5-pro',
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
          'gemini-1.5-pro',
          'gemini-1.5-flash'
        ]

        models.google = fallbackModels.sort().reverse()
        console.log(`[Models API] Using fallback list of ${models.google.length} Google Gemini models`)
      } else {
        // No API key - use fallback
        throw new Error('No GOOGLE_API_KEY found')
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch Google models from API:', error)
      // Fallback to latest known models
      models.google = [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite'
      ]
      console.log(`[Models API] Using fallback list of ${models.google.length} Google models`)
    }

    // Ollama models - fetch from local Ollama instance
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000)  // 2 second timeout
      })

      if (response.ok) {
        const data = await response.json() as { models: Array<{ name: string }> }
        const ollamaModels = data.models.map(m => m.name).sort()
        models.ollama = ollamaModels
        console.log(`[Models API] Found ${ollamaModels.length} Ollama models`)
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch Ollama models:', error)
      models.ollama = []
    }

    // Groq models - fetch from API or use defaults
    try {
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY
      if (apiKey) {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000)
        })

        if (response.ok) {
          const data = await response.json() as { data: Array<{ id: string }> }
          const groqModels = data.data.map(m => m.id).sort()
          models.groq = groqModels
          console.log(`[Models API] Found ${groqModels.length} Groq models`)
        } else {
          throw new Error(`Groq API returned ${response.status}`)
        }
      } else {
        // No API key - use fallback
        throw new Error('No GROQ_API_KEY found')
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch Groq models:', error)
      // Fallback to known Llama 3 models
      models.groq = [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
        'gemma2-9b-it'
      ]
      console.log(`[Models API] Using fallback list of ${models.groq.length} Groq models`)
    }

    // DeepInfra models - use known models (OpenAI-compatible API)
    try {
      const apiKey = process.env.NEXT_PUBLIC_DEEPINFRA_API_KEY || process.env.DEEPINFRA_API_KEY
      if (apiKey) {
        const response = await fetch('https://api.deepinfra.com/v1/openai/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000)
        })

        if (response.ok) {
          const data = await response.json() as { data: Array<{ id: string }> }
          // Filter to chat/instruct models
          const chatModels = data.data
            .filter(m => m.id.includes('Instruct') || m.id.includes('Chat') || m.id.includes('it'))
            .map(m => m.id)
            .sort()
          models.deepinfra = chatModels.length > 0 ? chatModels : [
            'meta-llama/Llama-3.3-70B-Instruct',
            'meta-llama/Llama-3.1-70B-Instruct',
            'meta-llama/Llama-3.1-8B-Instruct',
            'Qwen/Qwen2.5-72B-Instruct'
          ]
          console.log(`[Models API] Found ${models.deepinfra.length} DeepInfra models`)
        } else {
          throw new Error(`DeepInfra API returned ${response.status}`)
        }
      } else {
        throw new Error('No DEEPINFRA_API_KEY found')
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch DeepInfra models:', error)
      // Fallback to known Llama 3 models
      models.deepinfra = [
        'meta-llama/Llama-3.3-70B-Instruct',
        'meta-llama/Llama-3.1-70B-Instruct',
        'meta-llama/Llama-3.1-8B-Instruct',
        'Qwen/Qwen2.5-72B-Instruct',
        'mistralai/Mixtral-8x7B-Instruct-v0.1'
      ]
      console.log(`[Models API] Using fallback list of ${models.deepinfra.length} DeepInfra models`)
    }

    // Get last used models from localStorage (browser-side)
    // For now, use defaults - the frontend will override with localStorage values
    models.last_email_model = 'google:gemini-2.0-flash-exp'
    models.last_taxonomy_model = 'openai:gpt-4o-mini'
    models.last_max_emails = 10

    // Cache the results
    modelsCache.models = models
    modelsCache.timestamp = new Date()

    return NextResponse.json(models)

  } catch (error) {
    console.error('[Models API] Failed to get models:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch models' },
      { status: 500 }
    )
  }
}
