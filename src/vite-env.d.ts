/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_OPENAI_API_KEY?: string
  readonly VITE_OLLAMA_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
