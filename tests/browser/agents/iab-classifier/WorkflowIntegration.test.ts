/**
 * IAB Classifier Workflow Integration Test
 *
 * Tests the full 6-node workflow with all 4 analyzer agents.
 * NO checkpointer - just tests that agents execute correctly.
 */

import { describe, it, expect } from 'vitest'
import { buildWorkflowGraph } from '@browser/agents/iab-classifier'
import { IndexedDBStore } from '@browser/store'

describe('IAB Classifier Workflow Integration', () => {
  it('should execute all 4 analyzer agents successfully', async () => {
    const store = new IndexedDBStore('test-workflow-integration')

    // Build graph WITHOUT checkpointer (null = no persistence)
    const graph = buildWorkflowGraph(store, null)

    const workflowInput = {
      user_id: 'test_user_workflow',
      emails: [{
        id: 'email_workflow_1',
        subject: 'Your fitness tracker and wireless headphones have shipped!',
        from: 'orders@amazon.com',
        summary: `Hi John,

Great news! Your Amazon order has shipped and will arrive tomorrow between 2-6 PM.

Order #12345-67890:
- Fitbit Charge 5 Fitness Tracker (Black) - $149.95
- Sony WH-1000XM5 Wireless Noise Cancelling Headphones - $399.99
- 3-Pack Athletic Moisture-Wicking T-Shirts (Size L) - $34.99

Subtotal: $584.93
Shipping: FREE (Prime)
Total: $584.93

Track your package: [Link]

We hope you enjoy your new fitness tracker and headphones! Perfect for your morning runs and gym sessions.

Thanks for shopping with Amazon Prime!

The Amazon Team`,
      }],
      llm_provider: 'openai',
      llm_model: 'gpt-4o-mini', // Use faster/cheaper model for tests
    }

    try {
      const result = await graph.invoke(workflowInput)

      // Verify workflow executed
      console.log('Workflow result:', {
        demographics_count: result.demographics_results?.length || 0,
        household_count: result.household_results?.length || 0,
        interests_count: result.interests_results?.length || 0,
        purchase_count: result.purchase_results?.length || 0,
        errors: result.errors?.length || 0,
      })

      // At least ONE analyzer should return results
      const totalClassifications = [
        ...(result.demographics_results || []),
        ...(result.household_results || []),
        ...(result.interests_results || []),
        ...(result.purchase_results || []),
      ]

      expect(totalClassifications.length).toBeGreaterThan(0)
      expect(result.errors || []).toHaveLength(0)

      // Verify first classification has required fields
      if (totalClassifications.length > 0) {
        const first = totalClassifications[0]
        expect(first).toHaveProperty('taxonomy_id')
        expect(first).toHaveProperty('value')
        expect(first).toHaveProperty('confidence')
        expect(first).toHaveProperty('reasoning')
      }

      await store.stop()
    } catch (error) {
      await store.stop()
      throw error
    }
  }, 60000) // 60 second timeout for LLM calls
})
