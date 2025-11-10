/**
 * Server-side API Route for IAB Classification
 *
 * Runs the TypeScript IAB classifier workflow on the server side (Node.js environment)
 * where LangGraph and Node.js APIs (async_hooks) are available.
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildWorkflowGraph, WorkflowState } from '@browser/agents/iab-classifier'
import { getStore } from '@/lib/shared-store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, text, source = 'manual_input', llm_provider = 'openai', llm_model = 'gpt-4o-mini' } = body

    if (!user_id || !text) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: user_id and text' },
        { status: 400 }
      )
    }

    // Get shared in-memory store for this user
    const store = getStore(user_id)

    // Build the workflow graph
    const graph = buildWorkflowGraph(store, null)

    // Prepare input for the workflow
    const workflowInput: Partial<typeof WorkflowState.State> = {
      user_id,
      emails: [{
        id: `${source}_${Date.now()}`,
        subject: '',
        from: '',
        body: text,
        summary: text.substring(0, 500),
      }],
      llm_provider,
      llm_model,
      total_emails: 1,
      current_email_index: 0,
    }

    // Run the classification
    const result = await graph.invoke(workflowInput)

    // Extract classifications from all 4 analyzers
    const allClassifications = [
      ...(result.demographics_results || []).map((c: any) => ({ ...c, section: 'demographics' })),
      ...(result.household_results || []).map((c: any) => ({ ...c, section: 'household' })),
      ...(result.interests_results || []).map((c: any) => ({ ...c, section: 'interests' })),
      ...(result.purchase_results || []).map((c: any) => ({ ...c, section: 'purchase_intent' })),
    ]

    if (allClassifications.length === 0) {
      return NextResponse.json({
        success: true,
        classification: null,
        message: 'No classifications generated',
        all_classifications: [],
      })
    }

    // Get the highest confidence classification
    const topClassification = allClassifications.reduce((prev, current) =>
      (current.confidence > prev.confidence) ? current : prev
    )

    return NextResponse.json({
      success: true,
      classification: {
        category: topClassification.value,
        confidence: topClassification.confidence,
        reasoning: topClassification.reasoning,
        section: topClassification.section,
        taxonomy_id: topClassification.taxonomy_id,
      },
      all_classifications: allClassifications,
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
