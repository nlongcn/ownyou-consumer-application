/**
 * Demographics ReAct Agent for IAB Taxonomy Classification.
 *
 * Uses ReAct pattern (Reason-Act-Observe) with taxonomy search tools
 * to extract and validate demographic classifications from emails.
 *
 * Integrates with existing AnalyzerLLMClient infrastructure.
 *
 * 1:1 Port of: src/email_parser/agents/demographics_agent.py (310 lines)
 */

import {
  DEMOGRAPHICS_AGENT_SYSTEM_PROMPT,
  DEMOGRAPHICS_AGENT_USER_PROMPT,
  DEMOGRAPHICS_EVIDENCE_GUIDELINES,
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
 * Extract demographic classifications using ReAct-style agent with tools.
 *
 * This implements a simplified ReAct pattern compatible with AnalyzerLLMClient.
 * The agent can use tools (search, validate) and reflect on validation failures.
 *
 * Python lines 24-276
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
 * const result = await extract_demographics_with_agent({ emails, llm_client })
 */
export async function extract_demographics_with_agent(params: {               // Python line 24
  emails: Record<string, any>[]
  llm_client: AnalyzerLLMClient
  max_iterations?: number
}): Promise<Record<string, any>> {
  const { emails, llm_client, max_iterations = 1 } = params                    // Python line 27

  // Get taxonomy context for prompt                                            // Python line 60
  const taxonomy_context = getCachedTaxonomyContext('demographics')            // Python line 61

  // Format emails for prompt and create email_number → email_id mapping        // Python line 63
  const email_number_to_id: Record<number, string> = {}  // Map email numbers (1,2,3...) to actual email IDs // Python line 64
  const email_text_parts: string[] = []                                        // Python line 65

  const emails_batch = emails.slice(0, 50)  // Process up to 50 emails per batch // Python line 67
  for (let i = 0; i < emails_batch.length; i++) {                              // Python line 67
    const email = emails_batch[i]
    const email_number = i + 1                                                 // Python line 68
    const email_id = email.id || `unknown_${i}`                                // Python line 69
    email_number_to_id[email_number] = email_id                                // Python line 70

    // Handle NaN values from pandas CSV (float type, not string)              // Python line 72
    let summary_content = email.summary || ''                                  // Python line 73
    let subject = email.subject || 'N/A'                                       // Python line 74
    let sender = email.from || 'N/A'                                           // Python line 75

    // Convert pandas NaN (float) to empty string                              // Python line 77
    if (typeof summary_content !== 'string') {                                 // Python line 78
      summary_content = summary_content === null || summary_content === undefined || Number.isNaN(Number(summary_content)) ? '' : String(summary_content) // Python line 79
    }
    if (typeof subject !== 'string') {                                         // Python line 80
      subject = subject === null || subject === undefined || Number.isNaN(Number(subject)) ? 'N/A' : String(subject) // Python line 81
    }
    if (typeof sender !== 'string') {                                          // Python line 82
      sender = sender === null || sender === undefined || Number.isNaN(Number(sender)) ? 'N/A' : String(sender) // Python line 83
    }

    console.info(`Email ${email_number}: subject=${subject}, sender=${sender}, summary_len=${summary_content.length}`) // Python line 85
    if (!summary_content) {                                                    // Python line 86
      console.warn(`Email ${email_number} (${email_id}) has empty summary field!`) // Python line 87
    }

    email_text_parts.push(                                                     // Python line 89
      `Email ${email_number}:\n` +                                             // Python line 90
        `Subject: ${subject}\n` +                                              // Python line 91
        `From: ${sender}\n` +                                                  // Python line 92
        `Summary: ${summary_content.slice(0, 500)}...`                         // Python line 93
    )
  }

  const email_text = email_text_parts.join('\n\n')                             // Python line 96

  // Build initial prompt with taxonomy context                                // Python line 98
  const system_prompt_with_taxonomy = `${DEMOGRAPHICS_AGENT_SYSTEM_PROMPT}

## Available Taxonomy Entries

${taxonomy_context}

IMPORTANT:
- Select the taxonomy_id from the list above (the number after "ID")
- For the "value" field, use ONLY the FINAL tier value (rightmost part after last "|")
- Example: For "ID 49: Demographic | Gender | Female", use taxonomy_id=49 and value="Female"
- AVOID category entries (short paths with 2-3 tiers) - choose the most specific entry (4+ tiers when available)
- For "Employed", choose "ID 42: ... | Employment Status | Employed" NOT "ID 39: ... | Employment Status"
- Do NOT include the full tier path in the value field`                       // Python line 111

  let user_prompt = DEMOGRAPHICS_AGENT_USER_PROMPT.replace('{email_batch}', email_text).replace('{batch_size}', String(emails_batch.length)) // Python line 113

  // Track agent execution                                                     // Python line 118
  let tool_calls = 0                                                           // Python line 119
  let iterations = 0                                                           // Python line 120
  let classifications: Record<string, any>[] = []                              // Python line 121

  try {                                                                        // Python line 123
    for (let iteration = 0; iteration < max_iterations; iteration++) {         // Python line 124
      iterations++                                                             // Python line 125
      console.info(`Demographics agent iteration ${iteration + 1}/${max_iterations}`) // Python line 126

      // Call LLM (analyze_email returns parsed JSON with "classifications" key) // Python line 128
      // max_tokens auto-calculated from model's context window                // Python line 129
      const response = await llm_client.analyze_email({                        // Python line 130
        prompt: `${system_prompt_with_taxonomy}\n\n${user_prompt}`,            // Python line 131
        temperature: 0.1,                                                      // Python line 132
      })

      // Extract classifications directly from parsed response                 // Python line 135
      const parsed_classifications = response.classifications || []            // Python line 136

      // ===== ENHANCED LOGGING: Raw LLM Response =====                        // Python line 138
      console.info(`📝 Demographics LLM Response: ${parsed_classifications.length} classifications returned`) // Python line 139
      for (let i = 0; i < parsed_classifications.length; i++) {                // Python line 140
        const c = parsed_classifications[i]
        console.info(                                                          // Python line 141
          `  [${i + 1}] ID=${c.taxonomy_id}, value='${c.value}', ` +
            `confidence=${(c.confidence || 0).toFixed(2)}, emails=${JSON.stringify(c.email_numbers || [])}`
        )
      }

      if (parsed_classifications.length === 0) {                               // Python line 146
        console.warn('No classifications found in agent output')               // Python line 147
        break                                                                  // Python line 148
      }

      // Validate each classification (taxonomy validation only)               // Python line 150
      let all_valid = true                                                     // Python line 151
      const taxonomy_valid_classifications: Record<string, any>[] = []         // Python line 152

      for (const classification of parsed_classifications) {                   // Python line 154
        const taxonomy_id = classification.taxonomy_id                         // Python line 155
        const value = classification.value                                     // Python line 156

        if (!taxonomy_id || !value) {                                          // Python line 158
          continue                                                             // Python line 159
        }

        // Validate using tool                                                 // Python line 161
        tool_calls++                                                           // Python line 162
        const validation_result_json = validateClassification(taxonomy_id, value) // Python line 163
        const validation_result = JSON.parse(validation_result_json.result || '{}') // Python line 163

        if (validation_result.valid) {                                         // Python line 170
          // Taxonomy validation passed - add to batch for evidence judge      // Python line 171
          taxonomy_valid_classifications.push(classification)                  // Python line 172
        } else {                                                               // Python line 173
          // Validation failed - agent needs to reflect                        // Python line 174
          all_valid = false                                                    // Python line 175
          const expected_value = validation_result.expected_value || ''        // Python line 176
          console.info(                                                        // Python line 177
            `Validation failed: taxonomy_id=${taxonomy_id}, ` +
              `provided='${value}', expected='${expected_value}'`
          )

          // Update prompt for reflection                                      // Python line 182
          user_prompt +=                                                       // Python line 183
            `\n\nREFLECTION: Classification ${taxonomy_id}=${value} is INVALID. ` +
              `Expected value: '${expected_value}'. ` +
              `Please search again and use the correct taxonomy_id for '${expected_value}'.`
          break  // Trigger reflection loop                                    // Python line 188
        }
      }

      // ===== BATCH EVIDENCE QUALITY VALIDATION =====                         // Python line 190
      // Use parallel LLM-as-Judge for all taxonomy-valid classifications      // Python line 191
      let validated_classifications: Record<string, any>[] = []
      if (taxonomy_valid_classifications.length > 0) {                         // Python line 192
        // Evaluate all classifications in parallel                            // Python line 200
        // Pass actual batch size to distinguish true hallucinations from context truncation // Python line 201
        const actual_batch_size = emails_batch.length                          // Python line 202
        const evidence_evals = await evaluate_evidence_quality_batch({         // Python line 203
          classifications: taxonomy_valid_classifications,                     // Python line 204
          email_context: email_text,                                           // Python line 205
          section_guidelines: DEMOGRAPHICS_EVIDENCE_GUIDELINES,                // Python line 206
          llm_client,                                                          // Python line 207
          max_workers: 5,                                                      // Python line 208
          actual_batch_size,                                                   // Python line 209
        })

        // Process results                                                     // Python line 212
        for (let i = 0; i < taxonomy_valid_classifications.length; i++) {      // Python line 214
          let classification = taxonomy_valid_classifications[i]
          const evidence_eval = evidence_evals[i]

          // Adjust confidence based on evidence quality                       // Python line 216
          classification = adjust_confidence_with_evidence_quality(            // Python line 216
            classification,
            evidence_eval
          )

          // ===== ENHANCED LOGGING: Evidence Judge Decision =====             // Python line 220
          const will_block = should_block_classification(evidence_eval.quality_score) // Python line 221
          console.info(                                                        // Python line 222
            `🔍 Evidence Judge: '${classification.value}' → ` +
              `quality=${evidence_eval.quality_score.toFixed(2)}, ` +
              `type=${evidence_eval.evidence_type || 'N/A'}, ` +
              `decision=${will_block ? 'BLOCK' : 'PASS'}`
          )

          // Block completely inappropriate inferences                         // Python line 229
          if (will_block) {                                                    // Python line 230
            console.warn(                                                      // Python line 231
              `Blocked inappropriate demographics inference: ${classification.value} ` +
                `(quality_score=${evidence_eval.quality_score.toFixed(2)}, ` +
                `issue=${evidence_eval.issue || 'N/A'})`
            )
            continue  // Skip this classification                              // Python line 236
          }

          // Map email_numbers array to email_ids for provenance tracking      // Python line 238
          let email_numbers = classification.email_numbers || []               // Python line 239

          // Backward compatibility: check for old single email_number field   // Python line 241
          if (email_numbers.length === 0) {                                    // Python line 242
            const email_number = classification.email_number                   // Python line 243
            if (email_number) {                                                // Python line 244
              email_numbers = [email_number]                                   // Python line 245
            }
          }

          if (email_numbers.length > 0 && email_numbers.every((n: number) => n in email_number_to_id)) { // Python line 247
            classification.email_ids = email_numbers.map((n: number) => email_number_to_id[n]) // Python line 248
          } else {                                                             // Python line 249
            console.warn(`Classification missing email_numbers or invalid: ${JSON.stringify(classification)}`) // Python line 250
            classification.email_ids = []                                      // Python line 251
          }

          validated_classifications.push(classification)                       // Python line 253
        }
      }

      if (all_valid && validated_classifications.length > 0) {                 // Python line 257
        // All classifications validated - we're done                          // Python line 258
        classifications = validated_classifications                            // Python line 259
        console.info(`Agent converged with ${classifications.length} validated classifications`) // Python line 260
        break                                                                  // Python line 261
      }
    }

    return {                                                                   // Python line 263
      classifications,                                                         // Python line 264
      iterations,                                                              // Python line 265
      tool_calls,                                                              // Python line 266
    }

  } catch (error) {                                                            // Python line 269
    console.error(`Demographics agent error: ${error}`, error)                 // Python line 270
    return {                                                                   // Python line 271
      classifications: [],                                                     // Python line 272
      iterations,                                                              // Python line 273
      tool_calls,                                                              // Python line 274
      error: String(error),                                                    // Python line 275
    }
  }
}
