/**
 * Shared LLM types
 * 
 * Re-exports from base.ts plus additional enums
 */

export type { LLMMessage, LLMRequest, LLMResponse } from './base'

/**
 * LLM Error types
 */
export enum LLMError {
  API_ERROR = 'api_error',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  INVALID_REQUEST = 'invalid_request',
}

/**
 * LLM Provider types
 */
export enum LLMProvider {
  CLAUDE = 'claude',
  OPENAI = 'openai',
  GOOGLE = 'google',
  OLLAMA = 'ollama',
}
