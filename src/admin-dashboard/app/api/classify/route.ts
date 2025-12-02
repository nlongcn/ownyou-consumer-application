/**
 * Server-side API Route for IAB Classification
 *
 * Runs the TypeScript IAB classifier workflow on the server side (Node.js environment)
 * where LangGraph and Node.js APIs (async_hooks) are available.
 *
 * CRITICAL: This route uses SERVER-SIDE environment variables for API keys.
 * The workflow needs llm_config to make LLM API calls.
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildWorkflowGraph, WorkflowState } from '@ownyou/iab-classifier'
import { getStore } from '@/lib/shared-store'

/**
 * Get API key for the specified provider from environment variables
 */
function getApiKeyForProvider(provider: string): string | undefined {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY
    case 'claude':
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY
    case 'google':
    case 'gemini':
      return process.env.GOOGLE_API_KEY
    case 'groq':
      return process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY
    case 'deepinfra':
      return process.env.DEEPINFRA_API_KEY || process.env.NEXT_PUBLIC_DEEPINFRA_API_KEY
    default:
      console.warn(`[Classify API] Unknown provider: ${provider}`)
      return undefined
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, text, emails, source = 'manual_input', llm_provider = 'openai', llm_model = 'gpt-4o-mini' } = body

    console.log(`[Classify API] Request received: provider=${llm_provider}, model=${llm_model}, emails=${emails?.length || 0}`)

    // Support both single text (legacy) and batch emails (new)
    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: user_id' },
        { status: 400 }
      )
    }

    if (!text && (!emails || emails.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: either text or emails array' },
        { status: 400 }
      )
    }

    // Get API key for the selected provider from server environment
    const apiKey = getApiKeyForProvider(llm_provider)
    if (!apiKey) {
      console.error(`[Classify API] No API key found for provider: ${llm_provider}`)
      return NextResponse.json(
        {
          success: false,
          error: `No API key configured for ${llm_provider}. Set the appropriate environment variable.`,
        },
        { status: 400 }
      )
    }
    console.log(`[Classify API] Using API key for ${llm_provider} (key exists: ${!!apiKey})`)

    // Get shared in-memory store for this user
    const store = getStore(user_id)

    // Build the workflow graph
    const graph = buildWorkflowGraph(store, null, user_id)

    // Prepare emails array (support both single text and batch emails)
    let emailsArray
    if (emails && emails.length > 0) {
      // BATCH MODE: Multiple emails provided
      // Python source: Uses pre-summarized emails from Stage 2 (concurrent LLM summarization)
      // If summary is not provided, workflow will use raw body (fallback for skipSummarization=true)
      emailsArray = emails.map((email: any, idx: number) => ({
        id: email.id || `${source}_${Date.now()}_${idx}`,
        subject: email.subject || '',
        from: email.from || '',
        body: email.body || '',
        summary: email.summary || (email.body || '').substring(0, 500), // Use LLM summary if provided, else substring
      }))
    } else {
      // LEGACY MODE: Single text provided
      emailsArray = [{
        id: `${source}_${Date.now()}`,
        subject: '',
        from: '',
        body: text,
        summary: text.substring(0, 500),
      }]
    }

    // Prepare input for the workflow with llm_config containing API key
    // CRITICAL: The workflow needs llm_config.api_key to make LLM calls
    const workflowInput: Partial<typeof WorkflowState.State> = {
      user_id,
      emails: emailsArray,
      llm_provider,
      llm_model,
      llm_config: {
        api_key: apiKey,
        model: llm_model,
        temperature: 0.1,
      },
      total_emails: emailsArray.length,
      current_batch_start: 0,
      batch_size: emailsArray.length,
    }

    console.log(`[Classify API] Workflow input prepared:`, {
      user_id,
      llm_provider,
      llm_model,
      total_emails: emailsArray.length,
      batch_size: emailsArray.length,
      has_llm_config: !!workflowInput.llm_config,
      has_api_key: !!workflowInput.llm_config?.api_key,
    })

    // Run the classification (batch processing - all emails in single LLM call)
    console.log(`[Classify API] Processing ${emailsArray.length} emails in batch with ${llm_provider}:${llm_model}`)
    const startTime = Date.now()
    const result = await graph.invoke(workflowInput)
    const endTime = Date.now()

    console.log(`[Classify API] Workflow completed in ${endTime - startTime}ms`)
    console.log(`[Classify API] Results:`, {
      demographics_count: result.demographics_results?.length || 0,
      household_count: result.household_results?.length || 0,
      interests_count: result.interests_results?.length || 0,
      purchase_count: result.purchase_results?.length || 0,
      errors: result.errors || [],
    })

    // Extract classifications from all 4 analyzers
    const allClassifications = [
      ...(result.demographics_results || []).map((c: any) => ({ ...c, section: 'demographics' })),
      ...(result.household_results || []).map((c: any) => ({ ...c, section: 'household' })),
      ...(result.interests_results || []).map((c: any) => ({ ...c, section: 'interests' })),
      ...(result.purchase_results || []).map((c: any) => ({ ...c, section: 'purchase_intent' })),
    ]

    if (allClassifications.length === 0) {
      // BUGFIX: Frontend expects per_email_classifications even when empty
      const emptyClassificationsPerEmail = emailsArray.map((email: any) => ({
        email_id: email.id,
        classification: null,
        all_classifications: [],
      }))

      return NextResponse.json({
        success: true,
        classification: null,
        message: 'No classifications generated',
        all_classifications: [],
        emails_processed: emailsArray.length,
        per_email_classifications: emptyClassificationsPerEmail,
      })
    }

    // Get the highest confidence classification (for legacy single-email mode)
    const topClassification = allClassifications.reduce((prev, current) =>
      (current.confidence > prev.confidence) ? current : prev
    )

    // For batch mode, return classifications grouped by email
    const classificationsPerEmail = emailsArray.map((email: any) => {
      const emailClassifications = allClassifications.filter((c: any) => {
        // Classifications have email_ids array from batch processing
        if (c.email_ids && Array.isArray(c.email_ids)) {
          return c.email_ids.includes(email.id)
        }
        // Fallback to singular email_id for compatibility
        return c.email_id === email.id
      })

      const topForEmail = emailClassifications.length > 0
        ? emailClassifications.reduce((prev, current) =>
            (current.confidence > prev.confidence) ? current : prev
          )
        : null

      return {
        email_id: email.id,
        classification: topForEmail ? {
          category: topForEmail.value,
          confidence: topForEmail.confidence,
          reasoning: topForEmail.reasoning,
          section: topForEmail.section,
          taxonomy_id: topForEmail.taxonomy_id,
        } : null,
        all_classifications: emailClassifications,
      }
    })

    return NextResponse.json({
      success: true,
      // Legacy single-email response
      classification: {
        category: topClassification.value,
        confidence: topClassification.confidence,
        reasoning: topClassification.reasoning,
        section: topClassification.section,
        taxonomy_id: topClassification.taxonomy_id,
      },
      all_classifications: allClassifications,
      // New batch response
      emails_processed: emailsArray.length,
      per_email_classifications: classificationsPerEmail,
    })

  } catch (error: any) {
    console.error('Classification error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
