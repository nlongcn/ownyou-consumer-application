/// <reference types="vite/client" />

/**
 * Vite Environment Variables Type Declaration
 *
 * This file provides type definitions for import.meta.env in the browser code.
 * These variables are prefixed with VITE_ to be exposed to the browser by Vite.
 */

interface ImportMetaEnv {
  // LLM API Keys
  readonly VITE_OPENAI_API_KEY?: string
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_GROQ_API_KEY?: string
  readonly VITE_DEEPINFRA_API_KEY?: string
  readonly VITE_GOOGLE_API_KEY?: string

  // Next.js public API keys (for compatibility when used from Next.js)
  readonly NEXT_PUBLIC_GROQ_API_KEY?: string
  readonly NEXT_PUBLIC_DEEPINFRA_API_KEY?: string

  // Ollama configuration
  readonly VITE_OLLAMA_HOST?: string

  // LLM Provider selection
  readonly VITE_LLM_PROVIDER?: string

  // Development flags
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
