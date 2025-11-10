/**
 * Confidence Scoring Utilities
 *
 * 1:1 Port of Python confidence.py from:
 * src/email_parser/memory/confidence.py
 *
 * Implements:
 * - Temporal decay for confidence scores
 * - Confidence updates based on evidence type
 * - Initial confidence initialization
 */

// Evidence type definitions (Python line 24)
export type EvidenceType = 'confirming' | 'contradicting' | 'neutral'

/**
 * Update confidence score based on new evidence
 *
 * Python source: confidence.py:27-104 (update_confidence)
 *
 * @param current_confidence Current confidence score [0.0, 1.0]
 * @param new_evidence_strength Strength of new evidence [0.0, 1.0]
 * @param evidence_type Type of evidence
 * @returns Updated confidence score [0.0, 1.0]
 *
 * @example
 * ```typescript
 * // Confirming evidence increases confidence
 * updateConfidence(0.75, 0.8, 'confirming') // => 0.81
 *
 * // Contradicting evidence decreases confidence
 * updateConfidence(0.75, 0.6, 'contradicting') // => 0.525
 * ```
 */
export function updateConfidence(
  current_confidence: number,
  new_evidence_strength: number,
  evidence_type: EvidenceType
): number {
  // Python lines 60-68: Validate inputs
  if (current_confidence < 0.0 || current_confidence > 1.0) {
    throw new Error(
      `current_confidence must be in [0.0, 1.0], got ${current_confidence}`
    )
  }

  if (new_evidence_strength < 0.0 || new_evidence_strength > 1.0) {
    throw new Error(
      `new_evidence_strength must be in [0.0, 1.0], got ${new_evidence_strength}`
    )
  }

  let new_confidence: number

  // Python lines 70-96: Update based on evidence type
  if (evidence_type === 'confirming') {
    // Python lines 72-79: Bayesian-style update
    // Formula: new = current + (1 - current) * strength * 0.3
    new_confidence = current_confidence + (1 - current_confidence) * new_evidence_strength * 0.3

    console.debug(
      `Confirming evidence: ${current_confidence.toFixed(3)} → ${new_confidence.toFixed(3)} ` +
      `(strength=${new_evidence_strength.toFixed(2)})`
    )

  } else if (evidence_type === 'contradicting') {
    // Python lines 81-90: Reduction formula
    // Formula: new = current * (1 - strength * 0.5)
    new_confidence = current_confidence * (1 - new_evidence_strength * 0.5)

    console.debug(
      `Contradicting evidence: ${current_confidence.toFixed(3)} → ${new_confidence.toFixed(3)} ` +
      `(strength=${new_evidence_strength.toFixed(2)})`
    )

  } else if (evidence_type === 'neutral') {
    // Python lines 92-96: No change
    new_confidence = current_confidence

    console.debug(`Neutral evidence: confidence unchanged at ${current_confidence.toFixed(3)}`)

  } else {
    throw new Error(`Invalid evidence_type: ${evidence_type}`)
  }

  // Python lines 101-102: Ensure bounds [0.0, 1.0]
  new_confidence = Math.max(0.0, Math.min(1.0, new_confidence))

  return new_confidence
}

/**
 * Initialize confidence for first-time classification
 *
 * Python source: confidence.py:297-320 (initialize_confidence)
 *
 * First classification starts with evidence strength directly,
 * no need for Bayesian update formula.
 *
 * @param evidence_strength Initial evidence strength [0.0, 1.0]
 * @returns Initial confidence score [0.0, 1.0]
 *
 * @example
 * ```typescript
 * initializeConfidence(0.75) // => 0.75
 * ```
 */
export function initializeConfidence(evidence_strength: number): number {
  // Python lines 314-317: Validate input
  if (evidence_strength < 0.0 || evidence_strength > 1.0) {
    throw new Error(
      `evidence_strength must be in [0.0, 1.0], got ${evidence_strength}`
    )
  }

  // Python line 319: Return evidence strength directly
  return evidence_strength
}

/**
 * Apply temporal decay to confidence score
 *
 * Python source: confidence.py:107-166 (apply_temporal_decay)
 *
 * Confidence decays at 1% per week without validation.
 * This ensures classifications become less certain over time
 * if not reinforced by new evidence.
 *
 * @param confidence Current confidence score [0.0, 1.0]
 * @param days_since_last_validation Days since last validation
 * @returns Confidence after temporal decay [0.0, 1.0]
 *
 * @example
 * ```typescript
 * // No decay for recent validation (same day)
 * applyTemporalDecay(0.85, 0) // => 0.85
 *
 * // 1% decay after 1 week
 * applyTemporalDecay(0.85, 7) // => 0.8415
 *
 * // ~4% decay after 1 month
 * applyTemporalDecay(0.85, 30) // => 0.814
 * ```
 */
export function applyTemporalDecay(
  confidence: number,
  days_since_last_validation: number
): number {
  // Python lines 142-148: Validate inputs
  if (confidence < 0.0 || confidence > 1.0) {
    throw new Error(`confidence must be in [0.0, 1.0], got ${confidence}`)
  }

  if (days_since_last_validation < 0) {
    throw new Error(
      `days_since_last_validation must be >= 0, got ${days_since_last_validation}`
    )
  }

  // Python lines 150-156: Calculate and apply decay
  // Formula: decay_rate = 0.01 * (days / 7)
  const weeks = days_since_last_validation / 7.0
  const decay_rate = 0.01 * weeks

  // Apply decay: new = current * (1 - decay_rate)
  let new_confidence = confidence * (1 - decay_rate)

  // Python lines 158-159: Ensure non-negative
  new_confidence = Math.max(0.0, new_confidence)

  // Python lines 161-164: Debug logging
  console.debug(
    `Temporal decay: ${confidence.toFixed(3)} → ${new_confidence.toFixed(3)} ` +
    `(${days_since_last_validation} days, decay_rate=${decay_rate.toFixed(4)})`
  )

  return new_confidence
}

/**
 * Calculate days since last validation
 *
 * Python source: confidence.py:169-191 (calculate_days_since_validation)
 *
 * @param last_validated ISO 8601 timestamp string
 * @returns Number of days since validation
 *
 * @example
 * ```typescript
 * calculateDaysSinceValidation("2025-09-23T10:00:00Z")
 * // => 7 (if today is 2025-09-30)
 * ```
 */
export function calculateDaysSinceValidation(last_validated: string): number {
  try {
    // Python lines 184-187: Parse timestamp and calculate delta
    // Python: datetime.fromisoformat(last_validated.replace("Z", "+00:00"))
    const last_validated_dt = new Date(last_validated)
    const now = new Date()

    // Python: delta = now - last_validated_dt
    const delta_ms = now.getTime() - last_validated_dt.getTime()
    const delta_days = Math.floor(delta_ms / (1000 * 60 * 60 * 24))

    // Python: return max(0, delta.days)
    return Math.max(0, delta_days)

  } catch (error) {
    // Python lines 189-191: Error handling
    console.error(`Failed to parse last_validated timestamp '${last_validated}': ${error}`)
    return 0
  }
}
