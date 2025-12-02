/**
 * Abstract Base Class and Interfaces for LLM Clients
 *
 * TypeScript port of Python llm_clients/base.py (ALL 352 lines)
 *
 * Provides a unified interface for different LLM providers (Ollama, OpenAI, Claude, Google).
 *
 * MIGRATION NOTE: This is an EXACT 1:1 translation of the Python implementation.
 * FULL PORT - All 95 elements ported per mandate "Always Full Port, No Compromises".
 *
 * Elements ported: 95/95 (enum + interfaces + abstract class + all methods + factory + utilities)
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Supported LLM providers
 *
 * Python source: base.py:14-19 (class LLMProvider(Enum))
 */
export enum LLMProvider {
  // Python line 16: OLLAMA = "ollama"
  OLLAMA = 'ollama',

  // Python line 17: OPENAI = "openai"
  OPENAI = 'openai',

  // Python line 18: CLAUDE = "claude"
  CLAUDE = 'claude',

  // Python line 19: GOOGLE = "google"
  GOOGLE = 'google',

  // Added Nov 2025: Zero-data-retention providers
  GROQ = 'groq',
  DEEPINFRA = 'deepinfra',
}

// ============================================================================
// INTERFACES (Python @dataclass equivalents)
// ============================================================================

/**
 * Represents a message in the conversation
 *
 * Python source: base.py:22-26 (@dataclass LLMMessage)
 */
export interface LLMMessage {
  // Python line 25: role: str  # "system", "user", "assistant"
  role: string // "system", "user", "assistant"

  // Python line 26: content: str
  content: string
}

/**
 * Represents a request to an LLM
 *
 * Python source: base.py:29-37 (@dataclass LLMRequest)
 */
export interface LLMRequest {
  // Python line 32: messages: List[LLMMessage]
  messages: Array<LLMMessage>

  // Python line 33: model: Optional[str] = None
  model?: string

  // Python line 34: max_tokens: Optional[int] = None
  max_tokens?: number

  // Python line 35: temperature: Optional[float] = None
  temperature?: number

  // Python line 36: system_prompt: Optional[str] = None
  system_prompt?: string

  // Python line 37: json_mode: Optional[bool] = None
  json_mode?: boolean
}

/**
 * Represents a response from an LLM
 *
 * Python source: base.py:40-48 (@dataclass LLMResponse)
 */
export interface LLMResponse {
  // Python line 43: content: str
  content: string

  // Python line 44: model: str
  model: string

  // Python line 45: usage: Dict[str, Any]
  usage: Record<string, any>

  // Python line 46: metadata: Dict[str, Any]
  metadata: Record<string, any>

  // Python line 47: success: bool
  success: boolean

  // Python line 48: error: Optional[str] = None
  // Browser: Can be string or error object
  error?: string | Record<string, any>

  // Optional: Cost estimation for the request
  cost?: number

  // Optional: Finish reason (e.g., "stop", "length", "content_filter")
  finish_reason?: string
}

// ============================================================================
// LOGGER PLACEHOLDER
// ============================================================================

/**
 * Logger interface placeholder
 * TODO: Implement proper logging system
 */
export interface Logger {
  error: (message: string, context?: any) => void
  warning: (message: string, context?: any) => void
  info: (message: string, context?: any) => void
  debug: (message: string, context?: any) => void
}

/**
 * Create logger for a class
 * Python equivalent: get_logger(f"{__name__}.{class_name}")
 */
function createLogger(className: string): Logger {
  const prefix = `[${className}]`
  return {
    error: (message: string, context?: any) => console.error(prefix, message, context || ''),
    warning: (message: string, context?: any) => console.warn(prefix, message, context || ''),
    info: (message: string, context?: any) => console.info(prefix, message, context || ''),
    debug: (message: string, context?: any) => console.debug(prefix, message, context || ''),
  }
}

// ============================================================================
// ABSTRACT BASE CLASS
// ============================================================================

/**
 * Abstract base class for LLM clients
 *
 * Python source: base.py:51-128 (class BaseLLMClient(ABC))
 */
export abstract class BaseLLMClient {
  // Python line 56: self.config = config
  protected config: Record<string, any>

  // Python line 59: self.logger = get_logger(...)
  protected logger: Logger

  /**
   * Initialize the LLM client with configuration
   *
   * Python source: base.py:54-59 (def __init__)
   *
   * @param config - Configuration dictionary
   */
  constructor(config: Record<string, any>) {
    // Python line 56: self.config = config
    this.config = config

    // Python line 59: self.logger = get_logger(f"{__name__}.{self.__class__.__name__}")
    this.logger = createLogger(this.constructor.name)
  }

  // ==========================================================================
  // ABSTRACT METHODS
  // ==========================================================================

  /**
   * Get the provider type
   *
   * Python source: base.py:61-64 (@abstractmethod def get_provider)
   */
  abstract getProvider(): LLMProvider

  /**
   * Check if the LLM service is available
   *
   * Python source: base.py:66-69 (@abstractmethod def is_available)
   * Browser adaptation: Returns Promise for async API calls
   */
  abstract isAvailable(): Promise<boolean>

  /**
   * Generate a response from the LLM
   *
   * Python source: base.py:71-74 (@abstractmethod def generate)
   * Browser adaptation: Returns Promise for async API calls
   */
  abstract generate(request: LLMRequest): Promise<LLMResponse>

  /**
   * Get list of supported models
   *
   * Python source: base.py:76-79 (@abstractmethod def get_supported_models)
   * Browser: Returns Promise (API calls are async)
   */
  abstract getSupportedModels(): Promise<Array<string>>

  /**
   * Estimate the cost of a request (if applicable)
   *
   * Python source: base.py:81-84 (@abstractmethod def estimate_cost)
   * Browser: Returns Promise (may need async operations)
   */
  abstract estimateCost(request: LLMRequest): Promise<number | undefined>

  // ==========================================================================
  // CONCRETE METHODS
  // ==========================================================================

  /**
   * Validate the request and return list of errors
   *
   * Python source: base.py:86-106 (def validate_request)
   *
   * @param request - LLM request to validate
   * @returns Array of error messages (empty if valid)
   */
  validateRequest(request: LLMRequest): Array<string> {
    // Python line 88: errors = []
    const errors: Array<string> = []

    // Python line 90: if not request.messages:
    if (!request.messages) {
      // Python line 91: errors.append("At least one message is required")
      errors.push('At least one message is required')
    }

    // Python lines 93-99: for i, message in enumerate(request.messages):
    for (let i = 0; i < request.messages.length; i++) {
      const message = request.messages[i]

      // Python line 94: if not message.role:
      if (!message.role) {
        // Python line 95: errors.append(f"Message {i}: role is required")
        errors.push(`Message ${i}: role is required`)
      }

      // Python line 96: if message.role not in ["system", "user", "assistant"]:
      if (!['system', 'user', 'assistant'].includes(message.role)) {
        // Python line 97: errors.append(f"Message {i}: invalid role '{message.role}'")
        errors.push(`Message ${i}: invalid role '${message.role}'`)
      }

      // Python line 98: if not message.content:
      if (!message.content) {
        // Python line 99: errors.append(f"Message {i}: content is required")
        errors.push(`Message ${i}: content is required`)
      }
    }

    // Python line 102: system_messages = [msg for msg in request.messages if msg.role == "system"]
    const systemMessages = request.messages.filter(
      (msg) => msg.role === 'system'
    )

    // Python line 103: if request.system_prompt and system_messages:
    if (request.system_prompt && systemMessages.length > 0) {
      // Python line 104: errors.append("Cannot have both system_prompt and system messages")
      errors.push('Cannot have both system_prompt and system messages')
    }

    // Python line 106: return errors
    return errors
  }

  /**
   * Prepare messages for the specific provider
   *
   * Python source: base.py:108-117 (def prepare_messages)
   *
   * @param request - LLM request
   * @returns Array of messages with system prompt prepended if provided
   */
  prepareMessages(request: LLMRequest): Array<LLMMessage> {
    // Python line 110: messages = request.messages.copy()
    const messages = [...request.messages]

    // Python line 113: if request.system_prompt:
    if (request.system_prompt) {
      // Python line 114: system_message = LLMMessage(role="system", content=request.system_prompt)
      const systemMessage: LLMMessage = {
        role: 'system',
        content: request.system_prompt,
      }

      // Python line 115: messages.insert(0, system_message)
      messages.unshift(systemMessage)
    }

    // Python line 117: return messages
    return messages
  }

  /**
   * Create an error response
   *
   * Python source: base.py:119-128 (def create_error_response)
   *
   * @param error - Error message
   * @param model - Model name (default: "unknown")
   * @returns LLMResponse with error
   */
  createErrorResponse(error: string, model: string = 'unknown'): LLMResponse {
    // Python lines 121-128: return LLMResponse(...)
    return {
      // Python line 122: content="",
      content: '',

      // Python line 123: model=model,
      model,

      // Python line 124: usage={},
      usage: {},

      // Python line 125: metadata={"error": error},
      metadata: { error },

      // Python line 126: success=False,
      success: false,

      // Python line 127: error=error
      error,
    }
  }

  /**
   * Analyze email content and extract structured information
   *
   * Python source: base.py:130-220 (def analyze_email)
   *
   * @param email_content - Raw email content to analyze
   * @param model - Specific model to use for analysis (required)
   * @returns Dictionary with extracted information
   */
  async analyzeEmail(email_content: string, model: string): Promise<Record<string, any>> {
    // Python lines 140-159: system_prompt = """..."""
    const system_prompt = `You are an email analysis AI that returns ONLY JSON responses.

CRITICAL RULES:
1. Do NOT show your thinking process
2. Do NOT include explanations
3. Do NOT use <think> tags
4. Return ONLY the JSON object
5. No text before or after the JSON

Your task: Extract email information into this exact JSON format:
{
  "summary": "Brief summary of email content",
  "products": "Product1, Product2" or "",
  "category": "Purchase|Newsletter|Spam|Personal Communication|Invoice|Shipment Related|Insurance|Bank Related|Car|House Related|Other",
  "sentiment": "positive|negative|neutral",
  "key_topics": "topic1, topic2, topic3",
  "action_required": "Yes|No"
}

REMEMBER: Output ONLY the JSON object. No thinking, no explanations, no extra text.`

    // Python lines 161-164: user_prompt = f"""..."""
    const user_prompt = `EMAIL CONTENT:
${email_content}

RESPOND WITH ONLY THE JSON OBJECT (no thinking, no explanations, no other text):`

    try {
      // Python lines 167-172: request = create_simple_request(...)
      const request = createSimpleRequest(
        user_prompt,
        system_prompt,
        model, // Python line 170: model=model  # Use exact model name specified - no fallback
        undefined,
        0.1 // Python line 171: temperature=0.1  # Low temperature for consistent extraction
      )

      // Python line 174: response = self.generate(request)
      const response = await this.generate(request)

      // Python line 176: if response.success:
      if (response.success) {
        // Python line 178: import json
        // TypeScript equivalent: JSON.parse()

        try {
          // Python line 180: content = response.content
          let content = response.content

          // Python lines 183-186: Clean up reasoning model artifacts (DeepSeek-R1, etc.)
          // if '<think>' in content:
          if (content.includes('<think>')) {
            // Python line 186: content = re.sub(r'<think>.*?</think>\s*', '', content, flags=re.DOTALL)
            content = content.replace(/<think>.*?<\/think>\s*/gs, '')
          }

          // Python lines 189-191: Look for JSON object in the cleaned content
          // json_match = re.search(r'\{[^{}]*"summary"[^{}]*?\}', content, re.DOTALL)
          const jsonMatch = content.match(/\{[^{}]*"summary"[^{}]*?\}/s)
          if (jsonMatch) {
            // if json_match: content = json_match.group(0)
            content = jsonMatch[0]
          }

          // Python line 193: analysis = json.loads(content)
          const analysis = JSON.parse(content)

          // Python lines 196-201: Helper function to parse comma-separated strings into lists
          // def parse_comma_list(value):
          const parseCommaList = (value: any): Array<string> => {
            // if isinstance(value, list): return value
            if (Array.isArray(value)) {
              return value
            }
            // if isinstance(value, str) and value.strip():
            if (typeof value === 'string' && value.trim()) {
              // return [item.strip() for item in value.split(',') if item.strip()]
              return value
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item)
            }
            // return []
            return []
          }

          // Python lines 203-210: return { ... }
          return {
            // Python line 204: 'summary': analysis.get('summary', ''),
            summary: analysis.summary || '',

            // Python line 205: 'products': parse_comma_list(analysis.get('products', '')),
            products: parseCommaList(analysis.products || ''),

            // Python line 206: 'category': analysis.get('category', 'Other'),
            category: analysis.category || 'Other',

            // Python line 207: 'sentiment': analysis.get('sentiment', 'neutral'),
            sentiment: analysis.sentiment || 'neutral',

            // Python line 208: 'key_topics': parse_comma_list(analysis.get('key_topics', '')),
            key_topics: parseCommaList(analysis.key_topics || ''),

            // Python line 209: 'action_required': analysis.get('action_required', 'No')
            action_required: analysis.action_required || 'No',
          }
        } catch (error) {
          // Python lines 211-213: except (json.JSONDecodeError, AttributeError):
          //                        return self._parse_plain_text_analysis(response.content)
          return this._parsePlainTextAnalysis(response.content)
        }
      } else {
        // Python lines 215-216: else: self.logger.error(...) return self._get_default_analysis()
        this.logger.error(`LLM analysis failed: ${response.error}`)
        return this._getDefaultAnalysis()
      }
    } catch (error) {
      // Python lines 218-220: except Exception as e: ... return self._get_default_analysis()
      this.logger.error(`Email analysis error: ${error}`)
      return this._getDefaultAnalysis()
    }
  }

  /**
   * Parse plain text LLM response as fallback
   *
   * Python source: base.py:222-260 (def _parse_plain_text_analysis)
   *
   * @param content - Plain text content to parse
   * @returns Parsed analysis dictionary
   */
  private _parsePlainTextAnalysis(content: string): Record<string, any> {
    // Python line 224: analysis = self._get_default_analysis()
    const analysis = this._getDefaultAnalysis()

    // Python line 227: content_lower = content.lower()
    const content_lower = content.toLowerCase()

    // Python lines 230-249: Extract category based on keywords
    // if any(word in content_lower for word in ['purchase', 'order', 'buy', 'payment']):
    if (
      ['purchase', 'order', 'buy', 'payment'].some((word) =>
        content_lower.includes(word)
      )
    ) {
      // Python line 231: analysis['category'] = 'Purchase'
      analysis.category = 'Purchase'
    } else if (
      ['invoice', 'bill', 'payment due'].some((word) =>
        content_lower.includes(word)
      )
    ) {
      // Python line 233: analysis['category'] = 'Invoice'
      analysis.category = 'Invoice'
    } else if (
      ['shipping', 'delivered', 'shipment'].some((word) =>
        content_lower.includes(word)
      )
    ) {
      // Python line 235: analysis['category'] = 'Shipment Related'
      analysis.category = 'Shipment Related'
    } else if (
      ['insurance', 'policy', 'claim'].some((word) =>
        content_lower.includes(word)
      )
    ) {
      // Python line 237: analysis['category'] = 'Insurance'
      analysis.category = 'Insurance'
    } else if (
      ['bank', 'account', 'balance'].some((word) =>
        content_lower.includes(word)
      )
    ) {
      // Python line 239: analysis['category'] = 'Bank Related'
      analysis.category = 'Bank Related'
    } else if (
      ['car', 'vehicle', 'auto'].some((word) => content_lower.includes(word))
    ) {
      // Python line 241: analysis['category'] = 'Car'
      analysis.category = 'Car'
    } else if (
      ['house', 'home', 'mortgage', 'real estate'].some((word) =>
        content_lower.includes(word)
      )
    ) {
      // Python line 243: analysis['category'] = 'House Related'
      analysis.category = 'House Related'
    } else if (
      content_lower.includes('unsubscribe') ||
      ['lottery', 'win money', 'guaranteed returns'].some((word) =>
        content_lower.includes(word)
      )
    ) {
      // Python line 245: analysis['category'] = 'Spam'
      analysis.category = 'Spam'
    } else if (['newsletter'].some((word) => content_lower.includes(word))) {
      // Python line 247: analysis['category'] = 'Newsletter'
      analysis.category = 'Newsletter'
    } else if (
      ['blog', 'news', 'update'].some((word) => content_lower.includes(word))
    ) {
      // Python line 249: analysis['category'] = 'News/Blog/Spam'
      analysis.category = 'News/Blog/Spam'
    }

    // Python lines 252-255: Extract sentiment
    // if any(word in content_lower for word in ['thank', 'great', 'excellent', 'happy']):
    if (
      ['thank', 'great', 'excellent', 'happy'].some((word) =>
        content_lower.includes(word)
      )
    ) {
      // Python line 253: analysis['sentiment'] = 'positive'
      analysis.sentiment = 'positive'
    } else if (
      ['problem', 'issue', 'error', 'cancel'].some((word) =>
        content_lower.includes(word)
      )
    ) {
      // Python line 255: analysis['sentiment'] = 'negative'
      analysis.sentiment = 'negative'
    }

    // Python line 258: analysis['summary'] = content[:100] + "..." if len(content) > 100 else content
    analysis.summary =
      content.length > 100 ? content.substring(0, 100) + '...' : content

    // Python line 260: return analysis
    return analysis
  }

  /**
   * Get default analysis structure
   *
   * Python source: base.py:262-271 (def _get_default_analysis)
   *
   * @returns Default analysis dictionary
   */
  private _getDefaultAnalysis(): Record<string, any> {
    // Python lines 264-271: return { ... }
    return {
      // Python line 265: 'summary': 'Unable to analyze email content',
      summary: 'Unable to analyze email content',

      // Python line 266: 'products': [],
      products: [],

      // Python line 267: 'category': 'Other',
      category: 'Other',

      // Python line 268: 'sentiment': 'neutral',
      sentiment: 'neutral',

      // Python line 269: 'key_topics': [],
      key_topics: [],

      // Python line 270: 'action_required': 'No'
      action_required: 'No',
    }
  }
}

// ============================================================================
// FACTORY CLASS
// ============================================================================

/**
 * Factory for creating LLM clients
 *
 * Python source: base.py:274-299 (class LLMClientFactory)
 */
export class LLMClientFactory {
  /**
   * Create an LLM client for the specified provider
   *
   * Python source: base.py:278-299 (@staticmethod def create_client)
   *
   * @param provider - Provider type (string or enum)
   * @param config - Configuration dictionary
   * @returns LLM client instance
   */
  static createClient(
    provider: string | LLMProvider,
    config: Record<string, any>
  ): BaseLLMClient {
    // Python lines 280-284: if isinstance(provider, str): ...
    if (typeof provider === 'string') {
      try {
        // Python line 282: provider = LLMProvider(provider.lower())
        // TypeScript: Use enum key lookup
        const providerUpper = provider.toUpperCase()
        if (!(providerUpper in LLMProvider)) {
          throw new Error(`Unsupported LLM provider: ${provider}`)
        }
        provider = LLMProvider[providerUpper as keyof typeof LLMProvider]
      } catch (error) {
        // Python line 284: raise ValueError(f"Unsupported LLM provider: {provider}")
        throw new Error(`Unsupported LLM provider: ${provider}`)
      }
    }

    // Python lines 286-299: if provider == LLMProvider.OLLAMA: ...
    if (provider === LLMProvider.OLLAMA) {
      // Python lines 287-288: from .ollama_client import OllamaClient
      //                        return OllamaClient(config)
      const { OllamaClient } = require('./ollamaClient')
      return new OllamaClient(config)
    } else if (provider === LLMProvider.OPENAI) {
      // Python lines 290-291: from .openai_client import OpenAIClient
      //                        return OpenAIClient(config)
      const { OpenAIClient } = require('./openaiClient')
      return new OpenAIClient(config)
    } else if (provider === LLMProvider.CLAUDE) {
      // Python lines 293-294: from .claude_client import ClaudeClient
      //                        return ClaudeClient(config)
      const { ClaudeClient } = require('./claudeClient')
      return new ClaudeClient(config)
    } else if (provider === LLMProvider.GOOGLE) {
      // Python lines 296-297: from .google_client import GoogleClient
      //                        return GoogleClient(config)
      const { GoogleClient } = require('./googleClient')
      return new GoogleClient(config)
    } else if (provider === LLMProvider.GROQ) {
      // Added Nov 2025: Groq - fastest inference with ZDR
      const { GroqClient } = require('./groqClient')
      return new GroqClient(config)
    } else if (provider === LLMProvider.DEEPINFRA) {
      // Added Nov 2025: DeepInfra - best price with ZDR default
      const { DeepInfraClient } = require('./deepinfraClient')
      return new DeepInfraClient(config)
    } else {
      // Python line 299: raise ValueError(f"Unsupported LLM provider: {provider}")
      throw new Error(`Unsupported LLM provider: ${provider}`)
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a simple LLM request with a user message
 *
 * Python source: base.py:304-322 (def create_simple_request)
 *
 * @param user_message - User message content
 * @param system_prompt - Optional system prompt
 * @param model - Optional model name
 * @param max_tokens - Optional max tokens
 * @param temperature - Optional temperature
 * @param json_mode - Optional JSON mode flag
 * @returns LLMRequest object
 */
export function createSimpleRequest(
  user_message: string,
  system_prompt?: string,
  model?: string,
  max_tokens?: number,
  temperature?: number,
  json_mode?: boolean
): LLMRequest {
  // Python line 313: messages = [LLMMessage(role="user", content=user_message)]
  const messages: Array<LLMMessage> = [
    {
      role: 'user',
      content: user_message,
    },
  ]

  // Python lines 315-322: return LLMRequest(...)
  return {
    messages,
    model,
    max_tokens,
    temperature,
    system_prompt,
    json_mode,
  }
}

/**
 * Create an LLM request from a conversation
 *
 * Python source: base.py:325-352 (def create_conversation_request)
 *
 * @param conversation - List of [role, content] tuples
 * @param system_prompt - Optional system prompt
 * @param model - Optional model name
 * @param max_tokens - Optional max tokens
 * @param temperature - Optional temperature
 * @returns LLMRequest object
 */
export function createConversationRequest(
  conversation: Array<[string, string]>,
  system_prompt?: string,
  model?: string,
  max_tokens?: number,
  temperature?: number
): LLMRequest {
  // Python line 344: messages = [LLMMessage(role=role, content=content) for role, content in conversation]
  const messages: Array<LLMMessage> = conversation.map(([role, content]) => ({
    role,
    content,
  }))

  // Python lines 346-352: return LLMRequest(...)
  return {
    messages,
    model,
    max_tokens,
    temperature,
    system_prompt,
  }
}
