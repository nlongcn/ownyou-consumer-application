/**
 * Purchase Intent ReAct Agent for IAB Taxonomy Classification.
 *
 * Uses ReAct pattern (Reason-Act-Observe) with taxonomy search tools
 * to extract and validate purchase intent classifications from emails.
 *
 * Integrates with existing AnalyzerLLMClient infrastructure.
 *
 * 1:1 Port of: src/email_parser/agents/purchase_agent.py (309 lines)
 */

import {
  PURCHASE_AGENT_SYSTEM_PROMPT,
  PURCHASE_AGENT_USER_PROMPT,
  PURCHASE_EVIDENCE_GUIDELINES,
} from '../llm/prompts'
import { getCachedTaxonomyContext } from '../llm/taxonomyContext'
import {
  evaluate_evidence_quality_batch,
  adjust_confidence_with_evidence_quality,
  should_block_classification,
} from '../llm/evidenceJudge'
import { validateClassification } from '../analyzers/tools'
import type { AnalyzerLLMClient } from '../llm/client'

/**
 * Extract purchase intent classifications using ReAct-style agent with tools.
 *
 * This implements a simplified ReAct pattern compatible with AnalyzerLLMClient.
 * The agent can use tools (search, validate) and reflect on validation failures.
 *
 * Python lines 23-275
 *
 * @param emails - List of email dicts with 'subject', 'sender', 'body'
 * @param llm_client - AnalyzerLLMClient instance
 * @param max_iterations - Max reflection loops (default: 1)
 * @returns Classification result with iterations and tool_calls tracked
 *
 * @example
 * import { AnalyzerLLMClient } from '../llm/client'
 * const llm_client = new AnalyzerLLMClient({ provider: "openai" })
 * const emails = [{subject: "...", body: "..."}]
 * const result = await extract_purchase_with_agent({ emails, llm_client })
 */
export async function extract_purchase_with_agent(params: {               // Python line 23
  emails: Record<string, any>[]
  llm_client: AnalyzerLLMClient
  max_iterations?: number
}): Promise<Record<string, any>> {
  const { emails, llm_client, max_iterations = 1 } = params                    // Python line 26

  // Get taxonomy context for prompt                                            // Python line 56
  const taxonomy_context = getCachedTaxonomyContext('purchase')                // Python line 57

  // Format emails for prompt and create email_number → email_id mapping        // Python line 59
  const email_number_to_id: Record<number, string> = {}  // Map email numbers (1,2,3...) to actual email IDs // Python line 60
  const email_text_parts: string[] = []                                        // Python line 61

  const emails_batch = emails.slice(0, 50)  // Process up to 50 emails per batch // Python line 63
  for (let i = 0; i < emails_batch.length; i++) {                              // Python line 63
    const email = emails_batch[i]
    const email_number = i + 1                                                 // Python line 64
    const email_id = email.id || `unknown_${i}`                                // Python line 65
    email_number_to_id[email_number] = email_id                                // Python line 66

    // Handle NaN values from pandas CSV (float type, not string)              // Python line 68
    let summary_content = email.summary || ''                                  // Python line 69
    let subject = email.subject || 'N/A'                                       // Python line 70
    let sender = email.from || 'N/A'                                           // Python line 71

    // Convert pandas NaN (float) to empty string                              // Python line 73
    if (typeof summary_content !== 'string') {                                 // Python line 74
      summary_content = summary_content === null || summary_content === undefined || Number.isNaN(Number(summary_content)) ? '' : String(summary_content) // Python line 75
    }
    if (typeof subject !== 'string') {                                         // Python line 76
      subject = subject === null || subject === undefined || Number.isNaN(Number(subject)) ? 'N/A' : String(subject) // Python line 77
    }
    if (typeof sender !== 'string') {                                          // Python line 78
      sender = sender === null || sender === undefined || Number.isNaN(Number(sender)) ? 'N/A' : String(sender) // Python line 79
    }

    console.info(`Email ${email_number}: subject=${subject}, sender=${sender}, summary_len=${summary_content.length}`) // Python line 81
    if (!summary_content) {                                                    // Python line 82
      console.warn(`Email ${email_number} (${email_id}) has empty summary field!`) // Python line 83
    }

    email_text_parts.push(                                                     // Python line 85
      `Email ${email_number}:\n` +                                             // Python line 86
        `Subject: ${subject}\n` +                                              // Python line 87
        `From: ${sender}\n` +                                                  // Python line 88
        `Summary: ${summary_content.slice(0, 500)}...`                         // Python line 89
    )
  }

  const email_text = email_text_parts.join('\n\n')                             // Python line 92

  // Build initial prompt with taxonomy context                                // Python line 94
  const system_prompt_with_taxonomy = `${PURCHASE_AGENT_SYSTEM_PROMPT}

## Available Taxonomy Entries

${taxonomy_context}

IMPORTANT:
- Select the taxonomy_id from the list above (the number after "ID")
- For the "value" field, use ONLY the FINAL tier value (rightmost part after last "|")
- Example: For "ID 1200: Purchase Intent | Consumer Electronics | Smartphones", use taxonomy_id=1200 and value="Smartphones"
- AVOID category entries (short paths with 2-3 tiers) - choose the most specific entry (4+ tiers when available)
- Do NOT include the full tier path in the value field`                       // Python line 106

  let user_prompt = PURCHASE_AGENT_USER_PROMPT.replace('{email_batch}', email_text).replace('{batch_size}', String(emails_batch.length)) // Python line 108

  // Track agent execution                                                     // Python line 113
  let tool_calls = 0                                                           // Python line 114
  let iterations = 0                                                           // Python line 115
  let classifications: Record<string, any>[] = []                              // Python line 116

  try {                                                                        // Python line 118
    for (let iteration = 0; iteration < max_iterations; iteration++) {         // Python line 119
      iterations++                                                             // Python line 120
      console.info(`Purchase agent iteration ${iteration + 1}/${max_iterations}`) // Python line 121

      // Call LLM (analyze_email returns parsed JSON with "classifications" key) // Python line 123
      // max_tokens auto-calculated from model's context window                // Python line 124
      const response = await llm_client.analyze_email({                        // Python line 125
        prompt: `${system_prompt_with_taxonomy}\n\n${user_prompt}`,            // Python line 126
        temperature: 0.1,                                                      // Python line 127
      })

      // Extract classifications directly from parsed response                 // Python line 130
      const parsed_classifications = response.classifications || []            // Python line 131

      // ===== ENHANCED LOGGING: Raw LLM Response =====                        // Python line 133
      console.info(`📝 Purchase LLM Response: ${parsed_classifications.length} classifications returned`) // Python line 134
      for (let i = 0; i < parsed_classifications.length; i++) {                // Python line 135
        const c = parsed_classifications[i]
        console.info(                                                          // Python line 136
          `  [${i + 1}] ID=${c.taxonomy_id}, value='${c.value}', ` +
            `confidence=${(c.confidence || 0).toFixed(2)}, emails=${JSON.stringify(c.email_numbers || [])}`
        )
      }

      if (parsed_classifications.length === 0) {                               // Python line 141
        console.warn('No classifications found in agent output')               // Python line 142
        break                                                                  // Python line 143
      }

      // Validate each classification (taxonomy validation only)               // Python line 145
      let all_valid = true                                                     // Python line 146
      const taxonomy_valid_classifications: Record<string, any>[] = []         // Python line 147

      for (const classification of parsed_classifications) {                   // Python line 149
        const taxonomy_id = classification.taxonomy_id                         // Python line 150
        const value = classification.value                                     // Python line 151

        if (!taxonomy_id || !value) {                                          // Python line 153
          continue                                                             // Python line 154
        }

        // Validate using tool                                                 // Python line 156
        tool_calls++                                                           // Python line 157
        const validation_result_json = validateClassification(taxonomy_id, value) // Python line 158
        const validation_result = JSON.parse(validation_result_json.result || '{}') // Python line 158

        if (validation_result.valid) {                                         // Python line 165
          // Ensure purchase_intent_flag is present                            // Python line 166
          if (!classification.purchase_intent_flag) {                          // Python line 167
            classification.purchase_intent_flag = 'PIPR_LOW'  // Default       // Python line 168
          }

          // Taxonomy validation passed - add to batch for evidence judge      // Python line 170
          taxonomy_valid_classifications.push(classification)                  // Python line 171
        } else {                                                               // Python line 172
          // Validation failed - agent needs to reflect                        // Python line 173
          all_valid = false                                                    // Python line 174
          const expected_value = validation_result.expected_value || ''        // Python line 175
          console.info(                                                        // Python line 176
            `Validation failed: taxonomy_id=${taxonomy_id}, ` +
              `provided='${value}', expected='${expected_value}'`
          )

          // Update prompt for reflection                                      // Python line 181
          user_prompt +=                                                       // Python line 182
            `\n\nREFLECTION: Classification ${taxonomy_id}=${value} is INVALID. ` +
              `Expected value: '${expected_value}'. ` +
              `Please search again and use the correct taxonomy_id for '${expected_value}'.`
          break  // Trigger reflection loop                                    // Python line 187
        }
      }

      // ===== BATCH EVIDENCE QUALITY VALIDATION =====                         // Python line 189
      // Use parallel LLM-as-Judge for all taxonomy-valid classifications      // Python line 190
      let validated_classifications: Record<string, any>[] = []
      if (taxonomy_valid_classifications.length > 0) {                         // Python line 191
        // Evaluate all classifications in parallel                            // Python line 199
        // Pass actual batch size to distinguish true hallucinations from context truncation // Python line 200
        const actual_batch_size = emails_batch.length                          // Python line 201
        const evidence_evals = await evaluate_evidence_quality_batch({         // Python line 202
          classifications: taxonomy_valid_classifications,                     // Python line 203
          email_context: email_text,                                           // Python line 204
          section_guidelines: PURCHASE_EVIDENCE_GUIDELINES,                    // Python line 205
          llm_client,                                                          // Python line 206
          max_workers: 5,                                                      // Python line 207
          actual_batch_size,                                                   // Python line 208
        })

        // Process results                                                     // Python line 211
        for (let i = 0; i < taxonomy_valid_classifications.length; i++) {      // Python line 213
          let classification = taxonomy_valid_classifications[i]
          const evidence_eval = evidence_evals[i]

          // Adjust confidence based on evidence quality                       // Python line 214
          classification = adjust_confidence_with_evidence_quality(            // Python line 215
            classification,
            evidence_eval
          )

          // ===== ENHANCED LOGGING: Evidence Judge Decision =====             // Python line 219
          const will_block = should_block_classification(evidence_eval.quality_score) // Python line 220
          console.info(                                                        // Python line 221
            `🔍 Evidence Judge: '${classification.value}' → ` +
              `quality=${evidence_eval.quality_score.toFixed(2)}, ` +
              `type=${evidence_eval.evidence_type || 'N/A'}, ` +
              `decision=${will_block ? 'BLOCK' : 'PASS'}`
          )

          // Block completely inappropriate inferences                         // Python line 228
          if (will_block) {                                                    // Python line 229
            console.warn(                                                      // Python line 230
              `Blocked inappropriate purchase intent inference: ${classification.value} ` +
                `(quality_score=${evidence_eval.quality_score.toFixed(2)}, ` +
                `issue=${evidence_eval.issue || 'N/A'})`
            )
            continue  // Skip this classification                              // Python line 235
          }

          // Map email_numbers array to email_ids for provenance tracking      // Python line 237
          let email_numbers = classification.email_numbers || []               // Python line 238

          // Backward compatibility: check for old single email_number field   // Python line 240
          if (email_numbers.length === 0) {                                    // Python line 241
            const email_number = classification.email_number                   // Python line 242
            if (email_number) {                                                // Python line 243
              email_numbers = [email_number]                                   // Python line 244
            }
          }

          if (email_numbers.length > 0 && email_numbers.every((n: number) => n in email_number_to_id)) { // Python line 246
            classification.email_ids = email_numbers.map((n: number) => email_number_to_id[n]) // Python line 247
          } else {                                                             // Python line 248
            console.warn(`Classification missing email_numbers or invalid: ${JSON.stringify(classification)}`) // Python line 249
            classification.email_ids = []                                      // Python line 250
          }

          validated_classifications.push(classification)                       // Python line 252
        }
      }

      if (all_valid && validated_classifications.length > 0) {                 // Python line 256
        // All classifications validated - we're done                          // Python line 257
        classifications = validated_classifications                            // Python line 258
        console.info(`Agent converged with ${classifications.length} validated classifications`) // Python line 259
        break                                                                  // Python line 260
      }
    }

    return {                                                                   // Python line 262
      classifications,                                                         // Python line 263
      iterations,                                                              // Python line 264
      tool_calls,                                                              // Python line 265
    }

  } catch (error) {                                                            // Python line 268
    console.error(`Purchase agent error: ${error}`, error)                     // Python line 269
    return {                                                                   // Python line 270
      classifications: [],                                                     // Python line 271
      iterations,                                                              // Python line 272
      tool_calls,                                                              // Python line 273
      error: String(error),                                                    // Python line 274
    }
  }
}
