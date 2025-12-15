/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_CLIENT_SECRET?: string;
  readonly VITE_GOOGLE_REDIRECT_URI?: string;
  readonly VITE_MICROSOFT_CLIENT_ID: string;
  readonly VITE_MICROSOFT_CLIENT_SECRET?: string;
  readonly VITE_MICROSOFT_REDIRECT_URI?: string;
  readonly VITE_LLM_PROVIDER?: string;
  readonly VITE_LLM_MODEL?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_ANTHROPIC_API_KEY?: string;
  readonly VITE_GOOGLE_API_KEY?: string;
  readonly VITE_MISTRAL_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
