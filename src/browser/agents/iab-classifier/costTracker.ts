/**
 * Cost Tracker for LLM API Usage
 *
 * TypeScript port of Python cost_tracker.py (lines 1-230)
 *
 * Tracks token usage and calculates costs across different LLM providers.
 *
 * MIGRATION NOTE: This is an EXACT 1:1 translation of the Python implementation.
 * Every type, method, and logic step has been verified against the Python source.
 */

// ============================================================================
// INTERFACES (Python @dataclass equivalents)
// ============================================================================

/**
 * Record of a single LLM API call
 *
 * Python source: cost_tracker.py:12-20 (@dataclass LLMCall)
 */
export interface LLMCall {
  // Python line 15: provider: str
  provider: string

  // Python line 16: model: str
  model: string

  // Python line 17: prompt_tokens: int
  prompt_tokens: number

  // Python line 18: completion_tokens: int
  completion_tokens: number

  // Python line 19: cost_usd: float
  cost_usd: number

  // Python line 20: timestamp: str = field(default_factory=lambda: datetime.now().isoformat() + "Z")
  timestamp: string
}

/**
 * Statistics for a single LLM provider
 *
 * Python source: cost_tracker.py:23-30 (@dataclass ProviderStats)
 */
export interface ProviderStats {
  // Python line 26: provider: str
  provider: string

  // Python line 27: calls: int = 0
  calls: number

  // Python line 28: prompt_tokens: int = 0
  prompt_tokens: number

  // Python line 29: completion_tokens: int = 0
  completion_tokens: number

  // Python line 30: total_cost_usd: float = 0.0
  total_cost_usd: number
}

/**
 * Create LLMCall with default timestamp
 *
 * Python equivalent: LLMCall(...) with default_factory for timestamp
 *
 * @param provider - LLM provider name
 * @param model - Model name
 * @param prompt_tokens - Input tokens
 * @param completion_tokens - Output tokens
 * @param cost_usd - Cost in USD
 * @returns LLMCall object
 */
function createLLMCall(
  provider: string,
  model: string,
  prompt_tokens: number,
  completion_tokens: number,
  cost_usd: number
): LLMCall {
  return {
    provider,
    model,
    prompt_tokens,
    completion_tokens,
    cost_usd,
    // Python line 20: datetime.now().isoformat() + "Z"
    timestamp: new Date().toISOString(),
  }
}

/**
 * Create ProviderStats with default values
 *
 * Python equivalent: ProviderStats(provider=provider) with field defaults
 *
 * @param provider - Provider name
 * @returns ProviderStats object with zero-initialized counters
 */
function createProviderStats(provider: string): ProviderStats {
  return {
    // Python line 26: provider: str
    provider,
    // Python line 27: calls: int = 0
    calls: 0,
    // Python line 28: prompt_tokens: int = 0
    prompt_tokens: 0,
    // Python line 29: completion_tokens: int = 0
    completion_tokens: 0,
    // Python line 30: total_cost_usd: float = 0.0
    total_cost_usd: 0.0,
  }
}

// ============================================================================
// TYPE DEFINITIONS FOR PRICING DATA
// ============================================================================

/**
 * Pricing for a single model (per 1M tokens)
 */
type ModelPricing = {
  input_per_1m: number
  output_per_1m: number
}

/**
 * Pricing for all models of a provider
 */
type ProviderPricing = {
  [modelName: string]: ModelPricing
}

/**
 * Complete pricing data structure
 */
type PricingData = {
  [providerName: string]: ProviderPricing
}

// ============================================================================
// COST TRACKER CLASS
// ============================================================================

/**
 * Track LLM API costs across multiple providers
 *
 * Python source: cost_tracker.py:33-230 (class CostTracker)
 *
 * Pricing as of 2025-10-01 (per 1M tokens):
 * - OpenAI gpt-4o-mini: $0.15 input, $0.60 output
 * - OpenAI gpt-4o: $2.50 input, $10.00 output
 * - Claude Sonnet 4: $3.00 input, $15.00 output
 * - Claude Sonnet 3.5: $3.00 input, $15.00 output
 * - Ollama: Free (local)
 */
export class CostTracker {
  // Python lines 45-80: PRICING = { ... }
  static readonly PRICING: PricingData = {
    openai: {
      'gpt-4o-mini': {
        input_per_1m: 0.15,
        output_per_1m: 0.6,
      },
      'gpt-4o': {
        input_per_1m: 2.5,
        output_per_1m: 10.0,
      },
      'gpt-4': {
        input_per_1m: 30.0,
        output_per_1m: 60.0,
      },
    },
    claude: {
      'claude-sonnet-4': {
        input_per_1m: 3.0,
        output_per_1m: 15.0,
      },
      'claude-3-5-sonnet-20241022': {
        input_per_1m: 3.0,
        output_per_1m: 15.0,
      },
      'claude-3-5-sonnet': {
        input_per_1m: 3.0,
        output_per_1m: 15.0,
      },
    },
    ollama: {
      default: {
        input_per_1m: 0.0,
        output_per_1m: 0.0,
      },
    },
  }

  // Python line 84: self.calls: list[LLMCall] = []
  private calls: Array<LLMCall>

  // Python line 85: self.provider_stats: Dict[str, ProviderStats] = {}
  private provider_stats: Record<string, ProviderStats>

  // Python line 86: self.session_start = datetime.now().isoformat() + "Z"
  private session_start: string

  /**
   * Initialize cost tracker
   *
   * Python source: cost_tracker.py:82-86 (def __init__)
   */
  constructor() {
    // Python line 84: self.calls: list[LLMCall] = []
    this.calls = []

    // Python line 85: self.provider_stats: Dict[str, ProviderStats] = {}
    this.provider_stats = {}

    // Python line 86: self.session_start = datetime.now().isoformat() + "Z"
    this.session_start = new Date().toISOString()
  }

  /**
   * Track a single LLM API call and calculate cost
   *
   * Python source: cost_tracker.py:88-155 (def track_call)
   *
   * @param provider - LLM provider name (openai, claude, ollama)
   * @param model - Model name (gpt-4o-mini, claude-sonnet-4, etc.)
   * @param prompt_tokens - Number of input tokens
   * @param completion_tokens - Number of output tokens
   * @returns Cost in USD for this call
   */
  trackCall(
    provider: string,
    model: string,
    prompt_tokens: number,
    completion_tokens: number
  ): number {
    // Python lines 108-109: Normalize inputs
    // provider_lower = provider.lower()
    const providerLower = provider.toLowerCase()
    // model_lower = model.lower()
    const modelLower = model.toLowerCase()

    // Python line 112: if provider_lower in self.PRICING:
    let totalCost = 0.0
    if (providerLower in CostTracker.PRICING) {
      // Python line 113: pricing = None
      let pricing: ModelPricing | null = null

      // Python lines 114-116: Exact match
      // if model_lower in self.PRICING[provider_lower]:
      const providerPricing = CostTracker.PRICING[providerLower]
      if (modelLower in providerPricing) {
        // pricing = self.PRICING[provider_lower][model_lower]
        pricing = providerPricing[modelLower]
      }
      // Python lines 118-122: Fuzzy match
      else {
        // for known_model in self.PRICING[provider_lower]:
        for (const knownModel of Object.keys(providerPricing)) {
          // if known_model in model_lower or known_model == "default":
          if (modelLower.includes(knownModel) || knownModel === 'default') {
            // pricing = self.PRICING[provider_lower][known_model]
            pricing = providerPricing[knownModel]
            // break
            break
          }
        }
      }

      // Python lines 124-133: Calculate cost or default to 0
      if (pricing) {
        // Python line 125: input_cost = (prompt_tokens / 1_000_000) * pricing["input_per_1m"]
        const inputCost = (prompt_tokens / 1_000_000) * pricing.input_per_1m
        // Python line 126: output_cost = (completion_tokens / 1_000_000) * pricing["output_per_1m"]
        const outputCost =
          (completion_tokens / 1_000_000) * pricing.output_per_1m
        // Python line 127: total_cost = input_cost + output_cost
        totalCost = inputCost + outputCost
      } else {
        // Python lines 129-130: Unknown model - assume free
        totalCost = 0.0
      }
    } else {
      // Python lines 132-133: Unknown provider - assume free
      totalCost = 0.0
    }

    // Python lines 136-142: Record call
    // call = LLMCall(
    //     provider=provider,
    //     model=model,
    //     prompt_tokens=prompt_tokens,
    //     completion_tokens=completion_tokens,
    //     cost_usd=total_cost
    // )
    const call = createLLMCall(
      provider,
      model,
      prompt_tokens,
      completion_tokens,
      totalCost
    )

    // Python line 143: self.calls.append(call)
    this.calls.push(call)

    // Python lines 146-147: Update provider stats
    // if provider not in self.provider_stats:
    if (!(provider in this.provider_stats)) {
      // self.provider_stats[provider] = ProviderStats(provider=provider)
      this.provider_stats[provider] = createProviderStats(provider)
    }

    // Python line 149: stats = self.provider_stats[provider]
    const stats = this.provider_stats[provider]

    // Python line 150: stats.calls += 1
    stats.calls += 1
    // Python line 151: stats.prompt_tokens += prompt_tokens
    stats.prompt_tokens += prompt_tokens
    // Python line 152: stats.completion_tokens += completion_tokens
    stats.completion_tokens += completion_tokens
    // Python line 153: stats.total_cost_usd += total_cost
    stats.total_cost_usd += totalCost

    // Python line 155: return total_cost
    return totalCost
  }

  /**
   * Get total cost across all providers
   *
   * Python source: cost_tracker.py:157-159 (def get_total_cost)
   *
   * @returns Total cost in USD
   */
  getTotalCost(): number {
    // Python line 159: return sum(stats.total_cost_usd for stats in self.provider_stats.values())
    return Object.values(this.provider_stats).reduce(
      (sum, stats) => sum + stats.total_cost_usd,
      0
    )
  }

  /**
   * Get total tokens (input + output) across all providers
   *
   * Python source: cost_tracker.py:161-166 (def get_total_tokens)
   *
   * @returns Total token count
   */
  getTotalTokens(): number {
    // Python lines 163-166:
    // return sum(
    //     stats.prompt_tokens + stats.completion_tokens
    //     for stats in self.provider_stats.values()
    // )
    return Object.values(this.provider_stats).reduce(
      (sum, stats) => sum + stats.prompt_tokens + stats.completion_tokens,
      0
    )
  }

  /**
   * Get formatted cost summary
   *
   * Python source: cost_tracker.py:168-201 (def get_summary)
   *
   * @param emails_processed - Number of emails processed (for per-email cost)
   * @returns Formatted summary string
   */
  getSummary(emails_processed?: number): string {
    // Python line 178: total_cost = self.get_total_cost()
    const totalCost = this.getTotalCost()
    // Python line 179: total_tokens = self.get_total_tokens()
    const totalTokens = this.getTotalTokens()
    // Python line 180: total_calls = len(self.calls)
    const totalCalls = this.calls.length

    // Python line 182: lines = []
    const lines: Array<string> = []

    // Python line 183: lines.append("=== LLM COST SUMMARY ===")
    lines.push('=== LLM COST SUMMARY ===')
    // Python line 184: lines.append(f"Total Calls: {total_calls}")
    lines.push(`Total Calls: ${totalCalls}`)
    // Python line 185: lines.append(f"Total Tokens: {total_tokens:,}")
    lines.push(`Total Tokens: ${totalTokens.toLocaleString()}`)
    // Python line 186: lines.append(f"Total Cost: ${total_cost:.4f} USD")
    lines.push(`Total Cost: $${totalCost.toFixed(4)} USD`)

    // Python line 188: if emails_processed and emails_processed > 0:
    if (emails_processed && emails_processed > 0) {
      // Python line 189: cost_per_email = total_cost / emails_processed
      const costPerEmail = totalCost / emails_processed
      // Python line 190: lines.append(f"Cost per Email: ${cost_per_email:.4f} USD")
      lines.push(`Cost per Email: $${costPerEmail.toFixed(4)} USD`)
    }

    // Python line 192: if len(self.provider_stats) > 1:
    if (Object.keys(this.provider_stats).length > 1) {
      // Python lines 193-194: lines.append("")
      lines.push('')
      // lines.append("=== BY PROVIDER ===")
      lines.push('=== BY PROVIDER ===')

      // Python line 195: for provider, stats in sorted(self.provider_stats.items()):
      for (const [provider, stats] of Object.entries(
        this.provider_stats
      ).sort()) {
        // Python line 196: lines.append(f"{provider}:")
        lines.push(`${provider}:`)
        // Python line 197: lines.append(f"  Calls: {stats.calls}")
        lines.push(`  Calls: ${stats.calls}`)
        // Python line 198: lines.append(f"  Tokens: {stats.prompt_tokens + stats.completion_tokens:,}")
        lines.push(
          `  Tokens: ${(stats.prompt_tokens + stats.completion_tokens).toLocaleString()}`
        )
        // Python line 199: lines.append(f"  Cost: ${stats.total_cost_usd:.4f} USD")
        lines.push(`  Cost: $${stats.total_cost_usd.toFixed(4)} USD`)
      }
    }

    // Python line 201: return "\n".join(lines)
    return lines.join('\n')
  }

  /**
   * Get statistics as dictionary (for JSON export)
   *
   * Python source: cost_tracker.py:203-230 (def get_stats_dict)
   *
   * @returns Statistics object
   */
  getStatsDict(): Record<string, any> {
    // Python lines 205-230: return { ... }
    return {
      // Python line 206: "session_start": self.session_start,
      session_start: this.session_start,

      // Python line 207: "total_calls": len(self.calls),
      total_calls: this.calls.length,

      // Python line 208: "total_tokens": self.get_total_tokens(),
      total_tokens: this.getTotalTokens(),

      // Python line 209: "total_cost_usd": self.get_total_cost(),
      total_cost_usd: this.getTotalCost(),

      // Python lines 210-218: "providers": { ... }
      providers: Object.fromEntries(
        Object.entries(this.provider_stats).map(([provider, stats]) => [
          provider,
          {
            // Python line 212: "calls": stats.calls,
            calls: stats.calls,
            // Python line 213: "prompt_tokens": stats.prompt_tokens,
            prompt_tokens: stats.prompt_tokens,
            // Python line 214: "completion_tokens": stats.completion_tokens,
            completion_tokens: stats.completion_tokens,
            // Python line 215: "total_cost_usd": stats.total_cost_usd
            total_cost_usd: stats.total_cost_usd,
          },
        ])
      ),

      // Python lines 219-229: "calls": [ ... ]
      calls: this.calls.map((call) => ({
        // Python line 221: "provider": call.provider,
        provider: call.provider,
        // Python line 222: "model": call.model,
        model: call.model,
        // Python line 223: "prompt_tokens": call.prompt_tokens,
        prompt_tokens: call.prompt_tokens,
        // Python line 224: "completion_tokens": call.completion_tokens,
        completion_tokens: call.completion_tokens,
        // Python line 225: "cost_usd": call.cost_usd,
        cost_usd: call.cost_usd,
        // Python line 226: "timestamp": call.timestamp
        timestamp: call.timestamp,
      })),
    }
  }
}
