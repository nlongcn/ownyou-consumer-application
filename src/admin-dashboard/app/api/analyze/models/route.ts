import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Force dynamic rendering - this route fetches from external APIs
export const dynamic = 'force-dynamic'

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

    // OpenAI models - fetch from API (only chat-capable gpt-* models)
    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (apiKey) {
        const client = new OpenAI({ apiKey })
        const response = await client.models.list()

        // Filter to only chat-capable models
        const chatModels = response.data
          .map(m => m.id)
          .filter(id => {
            // Include o1/o3 reasoning models
            if (id.startsWith('o1') || id.startsWith('o3')) return true
            // Include GPT chat models, exclude image/audio/realtime/search
            if (id.startsWith('gpt-') &&
                !id.includes('image') &&
                !id.includes('audio') &&
                !id.includes('realtime') &&
                !id.includes('search') &&
                !id.includes('transcribe') &&
                !id.includes('tts')) return true
            return false
          })
          .sort()
          .reverse() // Newest first

        models.openai = chatModels
        console.log(`[Models API] Found ${chatModels.length} OpenAI chat models`)
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch OpenAI models:', error)
      // @deprecated Bundled fallback - for dynamic fallbacks use:
      // import { configService } from '@ownyou/llm-client';
      // models.openai = await configService.getModelsByProvider('openai');
      models.openai = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
    }

    // Anthropic (Claude) models - fetch from API
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (apiKey) {
        // Try to fetch from Anthropic's models API
        const response = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          signal: AbortSignal.timeout(5000)
        })

        if (response.ok) {
          const data = await response.json() as { data: Array<{ id: string }> }
          const allModels = data.data
            .map(m => m.id)
            .sort()
            .reverse()

          models.anthropic = allModels
          console.log(`[Models API] Found ${allModels.length} Anthropic models from API`)
        } else {
          throw new Error(`Anthropic API returned ${response.status}`)
        }
      } else {
        throw new Error('No ANTHROPIC_API_KEY found')
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch Claude models from API:', error)
      // @deprecated Bundled fallback - for dynamic fallbacks use:
      // import { configService } from '@ownyou/llm-client';
      // models.anthropic = await configService.getModelsByProvider('anthropic');
      models.anthropic = [
        'claude-opus-4-5-20251101',
        'claude-sonnet-4-5-20251101',
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307',
      ]
      console.log(`[Models API] Using fallback list of ${models.anthropic.length} Claude models`)
    }

    // Google Gemini models - fetch from API
    try {
      const apiKey = process.env.GOOGLE_API_KEY
      if (apiKey) {
        // Fetch models list from Google's REST API
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { signal: AbortSignal.timeout(5000) }
        )

        if (response.ok) {
          const data = await response.json() as { models: Array<{ name: string, supportedGenerationMethods?: string[] }> }
          // Return all models that support generateContent (chat/completion)
          const allModels = data.models
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .sort()
            .reverse()

          models.google = allModels
          console.log(`[Models API] Found ${models.google.length} Google Gemini models from API`)
        } else {
          throw new Error(`Google API returned ${response.status}`)
        }
      } else {
        throw new Error('No GOOGLE_API_KEY found')
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch Google models from API:', error)
      // @deprecated Bundled fallback - for dynamic fallbacks use:
      // import { configService } from '@ownyou/llm-client';
      // models.google = await configService.getModelsByProvider('google');
      models.google = [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
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
      // @deprecated Bundled fallback - for dynamic fallbacks use:
      // import { configService } from '@ownyou/llm-client';
      // models.groq = await configService.getModelsByProvider('groq');
      models.groq = [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
        'gemma2-9b-it'
      ]
      console.log(`[Models API] Using fallback list of ${models.groq.length} Groq models`)
    }

    // DeepInfra models - only chat/instruct models (OpenAI-compatible API)
    try {
      const apiKey = process.env.NEXT_PUBLIC_DEEPINFRA_API_KEY || process.env.DEEPINFRA_API_KEY
      if (apiKey) {
        const response = await fetch('https://api.deepinfra.com/v1/openai/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000)
        })

        if (response.ok) {
          const data = await response.json() as { data: Array<{ id: string }> }
          // Filter to chat-capable models (Instruct, Chat, or known chat models)
          const chatModels = data.data
            .map(m => m.id)
            .filter(id =>
              id.includes('Instruct') ||
              id.includes('Chat') ||
              id.includes('chat') ||
              id.includes('DeepSeek') ||  // DeepSeek models are chat-capable
              id.includes('Qwen') ||      // Qwen models are chat-capable
              id.includes('gemma')        // Gemma models are chat-capable
            )
            .sort()
          models.deepinfra = chatModels
          console.log(`[Models API] Found ${chatModels.length} DeepInfra chat models`)
        } else {
          throw new Error(`DeepInfra API returned ${response.status}`)
        }
      } else {
        throw new Error('No DEEPINFRA_API_KEY found')
      }
    } catch (error) {
      console.warn('[Models API] Failed to fetch DeepInfra models:', error)
      // @deprecated Bundled fallback - for dynamic fallbacks use:
      // import { configService } from '@ownyou/llm-client';
      // models.deepinfra = await configService.getModelsByProvider('deepinfra');
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
