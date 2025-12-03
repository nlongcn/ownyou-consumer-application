/**
 * Validation Pipeline End-to-End Test
 *
 * Tests the complete validation pipeline implementation:
 * 1. Evidence Judge (LLM-as-Judge) - quality scoring and confidence adjustment
 * 2. Taxonomy Validation - ID validation and tier data population
 * 3. Enhanced Logging - audit trail and debugging visibility
 *
 * This test verifies that the TypeScript implementation matches the Python
 * validation pipeline behavior from src/email_parser/workflow/nodes/analyzers.py
 */

import { test, expect } from '@playwright/test'

const TEST_TEXT = `I just bought a new crib and baby formula from Target. My wife and I are expecting our first child next month. We've been looking at preschools in the area and planning for maternity leave.`

test.describe('Validation Pipeline', () => {
  test('should run complete validation pipeline with evidence judge, taxonomy validation, and enhanced logging', async ({ page }) => {
    // Navigate to analyze page
    await page.goto('http://localhost:3001/analyze')

    // Switch to Manual Text mode
    await page.getByRole('button', { name: '✍️ Manual Text' }).click()

    // Enter test text
    await page.getByRole('textbox', { name: 'Enter email text, transaction' }).fill(TEST_TEXT)

    // Set up console log collection
    const consoleLogs: string[] = []
    const consoleWarnings: string[] = []
    const consoleErrors: string[] = []

    page.on('console', msg => {
      const text = msg.text()
      if (msg.type() === 'log') consoleLogs.push(text)
      if (msg.type() === 'warning') consoleWarnings.push(text)
      if (msg.type() === 'error') consoleErrors.push(text)
    })

    // Click Run IAB Classification
    await page.getByRole('button', { name: 'Run IAB Classification' }).click()

    // Wait for classification to complete (look for success message)
    await page.waitForSelector('text=✅ Classification Successful', { timeout: 120000 })

    // === VALIDATION 1: Evidence Judge Logs ===
    const evidenceJudgeLogs = consoleLogs.filter(log =>
      log.includes('Evidence Judge') ||
      log.includes('Parallel evidence judge') ||
      log.includes('Evidence judge:')
    )

    expect(evidenceJudgeLogs.length).toBeGreaterThan(0)
    console.log(`✅ Evidence Judge executed: ${evidenceJudgeLogs.length} log entries`)

    // Check for quality score evaluation
    const qualityScoreLogs = consoleLogs.filter(log => log.includes('quality='))
    expect(qualityScoreLogs.length).toBeGreaterThan(0)
    console.log(`✅ Quality scores evaluated: ${qualityScoreLogs.length} classifications`)

    // Check for evidence types (explicit, contextual, weak)
    const evidenceTypeLogs = consoleLogs.filter(log =>
      log.includes('type=explicit') ||
      log.includes('type=contextual') ||
      log.includes('type=weak')
    )
    expect(evidenceTypeLogs.length).toBeGreaterThan(0)
    console.log(`✅ Evidence types identified: ${evidenceTypeLogs.length} classifications`)

    // === VALIDATION 2: Confidence Adjustment ===
    const confidenceAdjustmentLogs = consoleWarnings.filter(log =>
      log.includes('Evidence quality concern') &&
      log.includes('confidence adjusted')
    )

    // We expect at least one confidence adjustment for weak evidence (e.g., age inference)
    expect(confidenceAdjustmentLogs.length).toBeGreaterThan(0)
    console.log(`✅ Confidence adjustments applied: ${confidenceAdjustmentLogs.length}`)

    // === VALIDATION 3: Pipeline Statistics Logging ===
    const pipelineStatsLogs = consoleLogs.filter(log =>
      log.includes('Validation Pipeline:') ||
      log.includes('LLM returned:') ||
      log.includes('After evidence judge:') ||
      log.includes('After taxonomy validation:')
    )

    expect(pipelineStatsLogs.length).toBeGreaterThan(0)
    console.log(`✅ Pipeline statistics logged: ${pipelineStatsLogs.length} entries`)

    // === VALIDATION 4: Agent Completion Logs ===
    const completionLogs = consoleLogs.filter(log =>
      log.includes('agent complete:') &&
      log.includes('Provenance tracked:')
    )

    // Should have 4 completion logs (demographics, household, interests, purchase)
    expect(completionLogs.length).toBe(4)
    console.log(`✅ All 4 analyzers completed: ${completionLogs.length}`)

    // === VALIDATION 5: Memory Persistence ===
    const memoryLogs = consoleLogs.filter(log =>
      log.includes('Creating NEW semantic memory:') ||
      log.includes('Stored semantic memory:') ||
      log.includes('Stored episodic memory:')
    )

    expect(memoryLogs.length).toBeGreaterThan(0)
    console.log(`✅ Memory persistence: ${memoryLogs.length} memory operations`)

    // === VALIDATION 6: Check for Critical Errors ===
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon.ico') && // Ignore favicon 404
      !err.includes('DevTools') // Ignore DevTools messages
    )

    expect(criticalErrors.length).toBe(0)
    console.log(`✅ No critical errors: ${criticalErrors.length}`)

    // === VALIDATION 7: Check UI Result ===
    const successMessage = await page.textContent('text=✅ Classification Successful')
    expect(successMessage).toBeTruthy()

    // Check that category is displayed
    const categoryText = await page.textContent('text=Category')
    expect(categoryText).toBeTruthy()

    // Check that confidence is displayed
    const confidenceText = await page.textContent('text=Confidence')
    expect(confidenceText).toBeTruthy()

    console.log('✅ UI shows classification results')

    // === VALIDATION 8: Specific Evidence Judge Behavior ===
    // Look for "Male" classification with explicit evidence
    const maleExplicitLog = consoleLogs.find(log =>
      log.includes('Male') && log.includes('explicit') && log.includes('quality=1.00')
    )
    expect(maleExplicitLog).toBeTruthy()
    console.log('✅ Explicit evidence detected (Male classification)')

    // Look for weak evidence warning (age inference)
    const weakEvidenceWarning = consoleWarnings.find(log =>
      log.includes('Evidence quality concern') && log.includes('weak')
    )
    expect(weakEvidenceWarning).toBeTruthy()
    console.log('✅ Weak evidence flagged with warning')

    // === FINAL SUMMARY ===
    console.log('\n=== VALIDATION PIPELINE TEST SUMMARY ===')
    console.log(`Total console logs: ${consoleLogs.length}`)
    console.log(`Total warnings: ${consoleWarnings.length}`)
    console.log(`Total errors (non-critical): ${consoleErrors.length}`)
    console.log(`Evidence judge evaluations: ${qualityScoreLogs.length}`)
    console.log(`Confidence adjustments: ${confidenceAdjustmentLogs.length}`)
    console.log(`Memory operations: ${memoryLogs.length}`)
    console.log(`Analyzers completed: ${completionLogs.length}/4`)
    console.log('Status: ✅ ALL VALIDATIONS PASSED')
  })

  test('should block classifications with invalid taxonomy IDs', async () => {
    // This test would require mocking the LLM to return invalid taxonomy IDs
    // Skipping for now as it requires test infrastructure setup
    test.skip()
  })

  test('should block classifications with quality score < 0.3', async () => {
    // This test would require mocking the evidence judge to return low quality scores
    // Skipping for now as it requires test infrastructure setup
    test.skip()
  })
})
