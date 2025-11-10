/**
 * Rate Limiter for Email API Clients
 *
 * Provides exponential backoff retry logic with 429 (Too Many Requests) handling.
 * Ported from Python implementation: src/email_parser/providers/
 */

export interface RateLimiterConfig {
  maxRetries: number
  retryDelay: number  // Initial delay in seconds
  respectRetryAfter: boolean  // Use Retry-After header if present
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}

export class RateLimiter {
  private maxRetries: number
  private retryDelay: number
  private respectRetryAfter: boolean

  constructor(config: RateLimiterConfig = {
    maxRetries: 3,
    retryDelay: 2,
    respectRetryAfter: true
  }) {
    this.maxRetries = config.maxRetries
    this.retryDelay = config.retryDelay
    this.respectRetryAfter = config.respectRetryAfter
  }

  /**
   * Execute API call with exponential backoff retry logic
   *
   * Python equivalent: GmailProvider._retry_api_call (line 249)
   *                    OutlookProvider._retry_api_call (line 480)
   */
  async executeWithRetry<T>(
    apiCall: () => Promise<Response>,
    operation: string
  ): Promise<Response> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await apiCall()

        // Handle 429 (Too Many Requests) with retry
        if (response.status === 429) {
          if (attempt < this.maxRetries - 1) {
            const delay = this.calculateDelay(attempt, response)

            console.warn(
              `[RateLimiter] Rate limited on ${operation}, retrying in ${delay}s (attempt ${attempt + 1}/${this.maxRetries})`
            )

            await this.sleep(delay * 1000)
            continue
          }

          throw new RateLimitError(`Rate limit exceeded for ${operation} after ${this.maxRetries} attempts`)
        }

        // Success - return response
        return response

      } catch (error) {
        // Network or other errors
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelay * (2 ** attempt)

          console.warn(
            `[RateLimiter] ${operation} failed, retrying in ${delay}s (attempt ${attempt + 1}/${this.maxRetries}): ${error}`
          )

          await this.sleep(delay * 1000)
          continue
        }

        throw error
      }
    }

    throw new Error(`API call failed after ${this.maxRetries} attempts`)
  }

  /**
   * Calculate delay with exponential backoff and Retry-After header support
   *
   * Python equivalent: Outlook lines 488-493
   */
  private calculateDelay(attempt: number, response: Response): number {
    // Exponential backoff: 2, 4, 8 seconds...
    let delay = this.retryDelay * (2 ** attempt)

    // Respect Retry-After header if present (Outlook pattern)
    if (this.respectRetryAfter) {
      const retryAfter = response.headers.get('Retry-After')
      if (retryAfter) {
        try {
          const retryAfterSeconds = parseInt(retryAfter, 10)
          if (!isNaN(retryAfterSeconds)) {
            delay = retryAfterSeconds
          }
        } catch {
          // If parsing fails, stick with exponential backoff
        }
      }
    }

    return delay
  }

  /**
   * Sleep utility for delays between requests
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Add small delay between requests to avoid hitting rate limits
   *
   * Python equivalent:
   * - Gmail: time.sleep(0.1) - line 404
   * - Outlook: time.sleep(0.2) - line 642
   */
  static async throttle(delayMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delayMs))
  }
}

/**
 * Email Token Estimator for Batch Optimization
 *
 * Python equivalent: src/email_parser/workflow/batch_optimizer.py lines 17-47
 */
export interface Email {
  subject?: string
  from?: string
  body?: string
}

export class BatchOptimizer {
  /**
   * Estimate token count for a single email
   *
   * Uses rough heuristic: 1 token ≈ 4 characters for English text
   *
   * Python equivalent: estimate_email_tokens (line 17)
   */
  static estimateEmailTokens(email: Email): number {
    const subject = email.subject || ''
    const from = email.from || ''
    const body = email.body || ''

    // Count total characters
    const totalChars = subject.length + from.length + body.length

    // Add overhead for formatting (Email N:\nSubject:...\nFrom:...\nBody:...)
    const formatOverhead = 100

    // Rough conversion: 4 chars per token
    const estimatedTokens = Math.floor((totalChars + formatOverhead) / 4)

    return estimatedTokens
  }

  /**
   * Calculate optimal batch size to fit in context window
   *
   * Strategy:
   * - Reserve 30% for system prompt, taxonomy context, response
   * - Fill remaining 70% with emails
   * - Stop when adding next email would exceed limit
   *
   * Python equivalent: calculate_batch_size (line 50)
   */
  static calculateBatchSize(
    emails: Email[],
    contextWindow: number,
    startIndex: number = 0,
    targetUtilization: number = 0.70,
    minBatchSize: number = 5,
    maxBatchSize: number = 50
  ): number {
    if (startIndex >= emails.length) {
      return 0
    }

    // Handle None context_window (fallback to conservative batch size)
    if (!contextWindow) {
      console.warn('[BatchOptimizer] context_window is undefined, using fallback batch size')
      return Math.min(maxBatchSize, emails.length - startIndex)
    }

    // Calculate available tokens for emails
    // Reserve space for: system prompt (~2K), taxonomy context (~3K), response (~2K)
    const reservedTokens = Math.floor(contextWindow * (1 - targetUtilization))
    const availableTokens = contextWindow - reservedTokens

    console.debug(
      `[BatchOptimizer] context_window=${contextWindow}, reserved=${reservedTokens}, available=${availableTokens}`
    )

    // Accumulate emails until we exceed available tokens
    let cumulativeTokens = 0
    let batchSize = 0

    for (let i = startIndex; i < Math.min(startIndex + maxBatchSize, emails.length); i++) {
      const emailTokens = this.estimateEmailTokens(emails[i])

      if (cumulativeTokens + emailTokens > availableTokens) {
        // Adding this email would exceed limit
        break
      }

      cumulativeTokens += emailTokens
      batchSize++
    }

    // Ensure minimum batch size (unless we're at the end)
    const remainingEmails = emails.length - startIndex
    if (batchSize < minBatchSize && remainingEmails >= minBatchSize) {
      console.warn(
        `[BatchOptimizer] Calculated batch_size=${batchSize} is below minimum=${minBatchSize}. ` +
        `Using minimum (may exceed context window slightly).`
      )
      batchSize = Math.min(minBatchSize, remainingEmails)
    }

    // Handle edge case: no emails fit (single email too large)
    if (batchSize === 0 && remainingEmails > 0) {
      console.warn(
        `[BatchOptimizer] Single email at index ${startIndex} estimated at ${this.estimateEmailTokens(emails[startIndex])} tokens ` +
        `exceeds available space of ${availableTokens} tokens. Processing anyway (may truncate).`
      )
      batchSize = 1
    }

    const utilization = (cumulativeTokens / availableTokens) * 100

    console.info(
      `[BatchOptimizer] Batch size: ${batchSize} emails (${cumulativeTokens.toLocaleString()} tokens / ` +
      `${availableTokens.toLocaleString()} available, ${utilization.toFixed(1)}% utilization)`
    )

    return batchSize
  }
}
