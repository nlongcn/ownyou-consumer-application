/**
 * Evidence Quality Judge
 *
 * Uses LLM-as-Judge pattern to evaluate if classification reasoning
 * provides appropriate evidence per IAB Taxonomy guidelines.
 *
 * This prevents inappropriate inferences (e.g., age from products, gender from interests)
 * by validating evidence quality BEFORE confidence enters Bayesian tracking.
 *
 * 1:1 Port of: src/email_parser/workflow/nodes/evidence_judge.py (366 lines)
 */

import { JUDGE_SYSTEM_PROMPT } from './prompts'
import type { AnalyzerLLMClient } from './client'

// Evidence quality scale                                                        // Python line 21
export const QUALITY_EXPLICIT = 1.0      // Direct statement (stated age, title Mr./Ms.) // Python line 22
export const QUALITY_CONTEXTUAL = 0.7    // Strong inference (graduation year → age) // Python line 23
export const QUALITY_WEAK = 0.4          // Indirect signal (barely supports) // Python line 24
export const QUALITY_INAPPROPRIATE = 0.0 // Wrong evidence type (products → age) // Python line 25

/**
 * Evidence evaluation result.
 *
 * Python lines 46-51
 */
export interface EvidenceEvaluation {                                            // Python line 46
  is_valid: boolean                                                              // Python line 47
  quality_score: number  // 0.0-1.0                                              // Python line 48
  evidence_type: string                                                          // Python line 49
  issue: string                                                                  // Python line 50
}

/**
 * Use LLM to judge if reasoning is appropriate evidence for classification.
 *
 * Python lines 28-181
 *
 * @param classification - Agent's classification dict with reasoning
 * @param email_context - Email content (for context in judgment)
 * @param section_guidelines - Section-specific evidence rules (from prompts)
 * @param llm_client - AnalyzerLLMClient instance
 * @param actual_batch_size - Actual number of emails in batch (for hallucination detection)
 * @returns Evidence evaluation result
 *
 * @example
 * const eval = await evaluate_evidence_quality({
 *   classification: {value: "Male", reasoning: "Marital status mentioned"},
 *   email_context: "...",
 *   section_guidelines: DEMOGRAPHICS_EVIDENCE_GUIDELINES,
 *   llm_client: client
 * })
 * console.log(eval.quality_score) // => 0.0 (Inappropriate evidence)
 */
export async function evaluate_evidence_quality(params: {                        // Python line 28
  classification: Record<string, any>
  email_context: string
  section_guidelines: string
  llm_client: AnalyzerLLMClient
  actual_batch_size?: number | null
}): Promise<EvidenceEvaluation> {
  const { classification, email_context, section_guidelines, llm_client, actual_batch_size = null } = params // Python line 33

  // Pre-check: Detect if reasoning cites emails beyond actual batch size (true hallucination) // Python line 63
  const reasoning = classification.reasoning || ''                               // Python line 65
  const email_numbers = classification.email_numbers || []                       // Python line 66

  // Check if any cited email numbers exceed the actual batch size              // Python line 68
  if (actual_batch_size && email_numbers.length > 0) {                           // Python line 69
    const max_cited = Math.max(...email_numbers)                                 // Python line 70
    if (max_cited > actual_batch_size) {                                         // Python line 71
      return {                                                                   // Python line 72
        is_valid: false,                                                         // Python line 73
        quality_score: 0.0,                                                      // Python line 74
        evidence_type: 'inappropriate',                                          // Python line 75
        issue: `HALLUCINATION: Reasoning cites Email ${max_cited} but batch only contains ${actual_batch_size} emails. This email does not exist in the provided data.`, // Python line 76
      }
    }
  }

  // Also check reasoning text for email citations beyond batch size             // Python line 79
  if (actual_batch_size) {                                                       // Python line 80
    const email_refs = reasoning.matchAll(/\bEmail\s+(\d+)\b/gi)                 // Python line 81
    for (const match of email_refs) {                                            // Python line 82
      const email_num = parseInt(match[1], 10)                                   // Python line 83
      if (email_num > actual_batch_size) {                                       // Python line 84
        return {                                                                 // Python line 85
          is_valid: false,                                                       // Python line 86
          quality_score: 0.0,                                                    // Python line 87
          evidence_type: 'inappropriate',                                        // Python line 88
          issue: `HALLUCINATION: Reasoning cites 'Email ${email_num}' but batch only contains ${actual_batch_size} emails. This email does not exist in the provided data.`, // Python line 89
        }
      }
    }
  }

  // Build judge prompt with batch size info                                     // Python line 92
  const batch_info = actual_batch_size                                           // Python line 93
    ? `\n\nNOTE: The agent analyzed a batch of ${actual_batch_size} emails. Email references in reasoning should not exceed this number.`
    : ''

  const user_prompt = `## Section Evidence Guidelines:                           // Python line 95
${section_guidelines}

## Classification to Evaluate:
- Taxonomy Value: ${classification.value || 'N/A'}
- Confidence: ${classification.confidence || 0.0}
- Reasoning: ${classification.reasoning || ''}

## Email Context (first 2000 chars of batch):
${email_context.slice(0, 2000)}...
${batch_info}

## Your Task:
Evaluate if the reasoning provides VALID evidence per the guidelines above.

Focus on:
1. Is this the correct TYPE of evidence for this classification?
2. How strong is the evidence? (explicit, contextual, weak, or inappropriate)
3. Cite specific guideline violations if invalid
4. NOTE: If the reasoning cites emails beyond the snippet shown above but within the batch size (${actual_batch_size} emails), do NOT flag as hallucination - focus on evidence TYPE quality instead

Return ONLY JSON (no markdown):
{
  "is_valid": true/false,
  "quality_score": 0.0-1.0,
  "evidence_type": "explicit|contextual|weak|inappropriate",
  "issue": "explanation if invalid"
}`

  try {                                                                          // Python line 124
    // Build full prompt                                                         // Python line 125
    const full_prompt = `${JUDGE_SYSTEM_PROMPT}\n\n${user_prompt}`               // Python line 126

    // DEBUG: Log the prompt being sent (helps diagnose empty responses)         // Python line 128
    console.debug(                                                               // Python line 129
      `🔍 Evidence judge prompt for ${classification.value || 'unknown'}: ` +
        `length=${full_prompt.length} chars, ` +
        `email_context_length=${email_context.length} chars`
    )

    // Call judge LLM using call_json (doesn't enforce "classifications" structure) // Python line 135
    // Uses default max_tokens from call_json (automatically calculated from model context window) // Python line 136
    const response = await llm_client.call_json({                                // Python line 137
      prompt: full_prompt,                                                       // Python line 138
      temperature: 0.1,                                                          // Python line 139
    })

    // Parse response                                                            // Python line 142
    const is_valid = response.is_valid ?? false                                  // Python line 143
    let quality_score = parseFloat(String(response.quality_score ?? 0.0))        // Python line 144
    const evidence_type = response.evidence_type || 'unknown'                    // Python line 145
    const issue = response.issue || ''                                           // Python line 146

    // Validate quality_score bounds                                             // Python line 148
    quality_score = Math.max(0.0, Math.min(1.0, quality_score))                  // Python line 149

    // Map evidence type to score if LLM didn't provide score                    // Python line 151
    if (quality_score === 0.0 && ['explicit', 'contextual', 'weak'].includes(evidence_type)) { // Python line 152
      const quality_map: Record<string, number> = {                              // Python line 153
        explicit: QUALITY_EXPLICIT,                                              // Python line 154
        contextual: QUALITY_CONTEXTUAL,                                          // Python line 155
        weak: QUALITY_WEAK,                                                      // Python line 156
        inappropriate: QUALITY_INAPPROPRIATE,                                    // Python line 157
      }
      quality_score = quality_map[evidence_type] || 0.0                          // Python line 159
    }

    console.debug(                                                               // Python line 161
      `Evidence judge: ${classification.value} → ` +
        `${evidence_type} (quality=${quality_score.toFixed(2)})`
    )

    return {                                                                     // Python line 166
      is_valid,                                                                  // Python line 167
      quality_score,                                                             // Python line 168
      evidence_type,                                                             // Python line 169
      issue,                                                                     // Python line 170
    }

  } catch (error) {                                                              // Python line 173
    console.error(`Evidence judge error: ${error}`, error)                       // Python line 174
    // Default to neutral (don't block) on error                                 // Python line 175
    return {                                                                     // Python line 176
      is_valid: true,                                                            // Python line 177
      quality_score: 0.7,  // Neutral default                                   // Python line 178
      evidence_type: 'unknown',                                                  // Python line 179
      issue: `Judge error: ${String(error)}`,                                    // Python line 180
    }
  }
}

/**
 * Evaluate evidence quality for multiple classifications in parallel.
 *
 * This is a performance optimization that runs evidence judge in parallel
 * instead of sequentially, reducing overall processing time significantly.
 *
 * Python lines 184-265
 *
 * @param classifications - List of classification dicts to evaluate
 * @param email_context - Email content (for context in judgment)
 * @param section_guidelines - Section-specific evidence rules (from prompts)
 * @param llm_client - AnalyzerLLMClient instance
 * @param max_workers - Max parallel requests (default: 5, ignored in browser - uses Promise.all)
 * @param actual_batch_size - Actual number of emails in batch (for hallucination detection)
 * @returns List of evidence evaluation dicts (same order as input classifications)
 *
 * @example
 * const classifications = [
 *   {value: "Male", reasoning: "..."},
 *   {value: "35-44", reasoning: "..."}
 * ]
 * const results = await evaluate_evidence_quality_batch({
 *   classifications,
 *   email_context,
 *   section_guidelines: guidelines,
 *   llm_client: client,
 *   actual_batch_size: 20
 * })
 * console.assert(results.length === classifications.length)
 */
export async function evaluate_evidence_quality_batch(params: {                  // Python line 184
  classifications: Record<string, any>[]
  email_context: string
  section_guidelines: string
  llm_client: AnalyzerLLMClient
  max_workers?: number                                                           // Python line 188 (unused in browser - kept for API compatibility)
  actual_batch_size?: number | null
}): Promise<EvidenceEvaluation[]> {
  const { classifications, email_context, section_guidelines, llm_client, max_workers: _max_workers = 5, actual_batch_size = null } = params // Python line 188-190

  if (!classifications || classifications.length === 0) {                        // Python line 220
    return []                                                                    // Python line 221
  }

  // Single classification - use direct call (no parallelism overhead)           // Python line 223
  if (classifications.length === 1) {                                            // Python line 224
    return [await evaluate_evidence_quality({                                    // Python line 225
      classification: classifications[0],
      email_context,
      section_guidelines,
      llm_client,
      actual_batch_size,
    })]
  }

  // Multiple classifications - parallel evaluation                              // Python line 229
  console.info(`⚡ Parallel evidence judge: evaluating ${classifications.length} classifications`) // Python line 230

  /**
   * Wrapper to evaluate single classification with index tracking.
   * Python lines 234-249
   */
  const evaluate_single = async (                                                // Python line 234
    index: number,
    classification: Record<string, any>
  ): Promise<[number, EvidenceEvaluation]> => {
    try {                                                                        // Python line 236
      const result = await evaluate_evidence_quality({                           // Python line 237
        classification,
        email_context,
        section_guidelines,
        llm_client,
        actual_batch_size,
      })
      return [index, result]                                                     // Python line 240
    } catch (error) {                                                            // Python line 241
      console.error(`Parallel evidence judge error for classification ${index}: ${error}`) // Python line 242
      // Return neutral evaluation on error                                      // Python line 243
      return [index, {                                                           // Python line 244
        is_valid: true,                                                          // Python line 245
        quality_score: 0.7,                                                      // Python line 246
        evidence_type: 'unknown',                                                // Python line 247
        issue: `Evaluation error: ${String(error)}`,                             // Python line 248
      }]
    }
  }

  // Execute in parallel with Promise.all (browser equivalent of ThreadPoolExecutor) // Python line 251
  // Python line 252-262: ThreadPoolExecutor pattern
  const promises = classifications.map((classification, i) =>                    // Python line 254
    evaluate_single(i, classification)
  )

  const results_with_indices = await Promise.all(promises)                       // Python line 260

  // Sort by index to preserve order                                             // Python line 261
  const results = new Array<EvidenceEvaluation>(classifications.length)          // Python line 232
  for (const [index, result] of results_with_indices) {                          // Python line 260
    results[index] = result                                                      // Python line 262
  }

  console.info(`✅ Parallel evidence judge complete: ${results.length} evaluations`) // Python line 264
  return results                                                                 // Python line 265
}

/**
 * Adjust classification confidence based on evidence quality.
 *
 * Formula: adjusted_confidence = original_confidence × quality_score
 *
 * This ensures inappropriate evidence → low confidence → minimal Bayesian impact.
 *
 * Python lines 268-330
 *
 * @param classification - Original classification dict
 * @param evidence_evaluation - Result from evaluate_evidence_quality()
 * @returns Updated classification dict with adjusted confidence
 *
 * @example
 * const classification = {value: "Male", confidence: 0.9, reasoning: "..."}
 * const evaluation = {quality_score: 0.0, evidence_type: "inappropriate"}
 * const result = adjust_confidence_with_evidence_quality(classification, evaluation)
 * console.log(result.confidence) // => 0.0 (Blocked)
 */
export function adjust_confidence_with_evidence_quality(                         // Python line 268
  classification: Record<string, any>,
  evidence_evaluation: EvidenceEvaluation
): Record<string, any> {
  const original_conf = classification.confidence || 0.0                         // Python line 293
  const quality_score = evidence_evaluation.quality_score ?? 1.0                 // Python line 294
  const evidence_type = evidence_evaluation.evidence_type || 'unknown'           // Python line 295

  // Adjust confidence with less harsh penalties for contextual/weak evidence    // Python line 297
  // - Explicit (1.0): No penalty                                                // Python line 298
  // - Contextual (0.7): Reduce penalty from 0.7x to 0.85x multiplier            // Python line 299
  // - Weak (0.4): Reduce penalty from 0.4x to 0.65x multiplier                  // Python line 300
  // - Inappropriate (0.0): Full block                                           // Python line 301
  let adjusted_conf: number
  if (evidence_type === 'contextual' && quality_score >= 0.6 && quality_score <= 0.8) { // Python line 302
    // Less harsh penalty for contextual evidence                                // Python line 303
    adjusted_conf = original_conf * Math.min(0.85, quality_score + 0.15)         // Python line 304
  } else if (evidence_type === 'weak' && quality_score >= 0.3 && quality_score <= 0.5) { // Python line 305
    // Less harsh penalty for weak evidence                                      // Python line 306
    adjusted_conf = original_conf * Math.min(0.65, quality_score + 0.25)         // Python line 307
  } else {                                                                       // Python line 308
    // Standard penalty for explicit/inappropriate evidence                      // Python line 309
    adjusted_conf = original_conf * quality_score                                // Python line 310
  }

  // Log significant adjustments                                                 // Python line 312
  if (adjusted_conf < original_conf * 0.8) {                                     // Python line 313
    console.warn(                                                                // Python line 314
      `Evidence quality concern: ${classification.value} ` +
        `confidence adjusted ${original_conf.toFixed(2)} → ${adjusted_conf.toFixed(2)} ` +
        `(evidence_type=${evidence_evaluation.evidence_type}, ` +
        `issue=${evidence_evaluation.issue || 'N/A'})`
    )
  }

  // Update classification                                                       // Python line 321
  classification.confidence = adjusted_conf                                      // Python line 322
  classification.original_confidence = original_conf                             // Python line 323
  classification.evidence_quality = quality_score                                // Python line 324
  classification.evidence_type = evidence_evaluation.evidence_type               // Python line 325

  if (evidence_evaluation.issue) {                                               // Python line 327
    classification.evidence_issue = evidence_evaluation.issue                    // Python line 328
  }

  return classification                                                          // Python line 330
}

/**
 * Determine if classification should be blocked entirely.
 *
 * Classifications with quality_score below threshold are completely inappropriate
 * and should not enter memory at all.
 *
 * Python lines 333-353
 *
 * @param quality_score - Evidence quality score [0.0, 1.0]
 * @param threshold - Minimum quality to allow (default: 0.15)
 * @returns True if should block, False if should allow
 *
 * @example
 * console.log(should_block_classification(0.0))  // => true (Inappropriate)
 * console.log(should_block_classification(0.4))  // => false (Weak but allowed)
 */
export function should_block_classification(                                     // Python line 333
  quality_score: number,
  threshold: number = 0.15
): boolean {
  return quality_score < threshold                                               // Python line 353
}
