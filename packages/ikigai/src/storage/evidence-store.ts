/**
 * Evidence Store - v13 Section 2.3
 *
 * Stores IkigaiEvidence chains for transparency and debugging.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.3
 */

import type { IkigaiEvidence } from '../types';
import type { MemoryStore } from './profile-store';

const EVIDENCE_PREFIX = 'evidence:';

/**
 * Store evidence chains - v13 Section 2.3
 *
 * Evidence links Ikigai signals back to source data.
 */
export async function storeEvidence(
  userId: string,
  evidence: IkigaiEvidence[],
  store: MemoryStore
): Promise<void> {
  // Store each evidence item individually for easy querying
  for (const item of evidence) {
    const key = `${EVIDENCE_PREFIX}${item.dimension}:${Date.now()}:${Math.random().toString(36).substring(7)}`;

    await store.put(
      ['ownyou.ikigai_evidence', userId],
      key,
      {
        ...item,
        storedAt: Date.now(),
      }
    );
  }

  // Also store a summary of the latest evidence batch
  await store.put(
    ['ownyou.ikigai_evidence', userId],
    'latest_batch',
    {
      count: evidence.length,
      dimensions: [...new Set(evidence.map((e) => e.dimension))],
      storedAt: Date.now(),
    }
  );
}

/**
 * Get evidence by dimension
 */
export async function getEvidenceByDimension(
  userId: string,
  dimension: 'experiences' | 'relationships' | 'interests' | 'giving',
  store: MemoryStore,
  limit: number = 50
): Promise<IkigaiEvidence[]> {
  try {
    const allEvidence = await store.list(
      ['ownyou.ikigai_evidence', userId],
      { prefix: `${EVIDENCE_PREFIX}${dimension}:` }
    );

    return allEvidence
      .slice(0, limit)
      .map((item) => item.value as unknown as IkigaiEvidence);
  } catch {
    return [];
  }
}

/**
 * Get all recent evidence
 */
export async function getRecentEvidence(
  userId: string,
  store: MemoryStore,
  limit: number = 100
): Promise<IkigaiEvidence[]> {
  try {
    const allEvidence = await store.list(
      ['ownyou.ikigai_evidence', userId],
      { prefix: EVIDENCE_PREFIX }
    );

    // Sort by extractedAt descending and limit
    return allEvidence
      .map((item) => item.value as unknown as IkigaiEvidence)
      .sort((a, b) => (b.extractedAt || 0) - (a.extractedAt || 0))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get evidence summary (for debugging/transparency)
 */
export async function getEvidenceSummary(
  userId: string,
  store: MemoryStore
): Promise<{
  totalCount: number;
  byDimension: Record<string, number>;
  lastBatchAt: number | null;
}> {
  try {
    const latestBatch = await store.get(
      ['ownyou.ikigai_evidence', userId],
      'latest_batch'
    );

    const allEvidence = await store.list(
      ['ownyou.ikigai_evidence', userId],
      { prefix: EVIDENCE_PREFIX }
    );

    const byDimension: Record<string, number> = {
      experiences: 0,
      relationships: 0,
      interests: 0,
      giving: 0,
    };

    for (const item of allEvidence) {
      const evidence = item.value as unknown as IkigaiEvidence;
      if (evidence.dimension && byDimension[evidence.dimension] !== undefined) {
        byDimension[evidence.dimension]++;
      }
    }

    return {
      totalCount: allEvidence.length,
      byDimension,
      lastBatchAt: latestBatch?.value.storedAt as number | null,
    };
  } catch {
    return {
      totalCount: 0,
      byDimension: {
        experiences: 0,
        relationships: 0,
        interests: 0,
        giving: 0,
      },
      lastBatchAt: null,
    };
  }
}
