/**
 * Privacy Sanitizer - v13 Section 10.8
 *
 * PII redaction and content truncation for privacy-preserving debugging.
 */

/**
 * Configuration for sanitization
 */
export interface SanitizeConfig {
  maxLength: number;
  redactPatterns: {
    email: boolean;
    phone: boolean;
    creditCard: boolean;
    ssn: boolean;
    customPatterns?: RegExp[];
  };
}

/**
 * Default sanitization config per v13 Section 10.8
 */
export const DEFAULT_SANITIZE_CONFIG: SanitizeConfig = {
  maxLength: 200,
  redactPatterns: {
    email: true,
    phone: true,
    creditCard: true,
    ssn: true,
  },
};

// PII regex patterns
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_PATTERN = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
const CREDIT_CARD_PATTERN = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
const SSN_PATTERN = /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g;

/**
 * Sanitize content for trace storage
 *
 * Performs PII redaction and truncation to ensure no sensitive
 * data is stored in debug traces.
 *
 * @param content - Raw content to sanitize
 * @param config - Sanitization configuration
 * @returns Sanitized content
 */
export function sanitizeForTrace(
  content: string | undefined | null,
  config: SanitizeConfig = DEFAULT_SANITIZE_CONFIG
): string {
  // Handle undefined/null gracefully
  if (content === undefined || content === null) {
    return '';
  }

  let result = content;

  // Apply PII redaction patterns
  if (config.redactPatterns.email) {
    result = result.replace(EMAIL_PATTERN, '[EMAIL]');
  }
  if (config.redactPatterns.phone) {
    result = result.replace(PHONE_PATTERN, '[PHONE]');
  }
  if (config.redactPatterns.creditCard) {
    result = result.replace(CREDIT_CARD_PATTERN, '[CARD]');
  }
  if (config.redactPatterns.ssn) {
    result = result.replace(SSN_PATTERN, '[SSN]');
  }

  // Apply custom patterns
  if (config.redactPatterns.customPatterns) {
    for (const pattern of config.redactPatterns.customPatterns) {
      result = result.replace(pattern, '[REDACTED]');
    }
  }

  // Truncate to max length
  if (result.length > config.maxLength) {
    result = result.substring(0, config.maxLength) + '...';
  }

  return result;
}

/**
 * Create a sanitizer with custom config
 */
export function createSanitizer(config: Partial<SanitizeConfig> = {}) {
  const mergedConfig: SanitizeConfig = {
    maxLength: config.maxLength ?? DEFAULT_SANITIZE_CONFIG.maxLength,
    redactPatterns: {
      ...DEFAULT_SANITIZE_CONFIG.redactPatterns,
      ...config.redactPatterns,
    },
  };

  return (content: string) => sanitizeForTrace(content, mergedConfig);
}
