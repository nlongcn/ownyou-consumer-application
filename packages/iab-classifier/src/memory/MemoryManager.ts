/**
 * Memory Manager - LangMem Memory Operations
 *
 * TypeScript port of Python memory/manager.py
 *
 * Handles all memory store operations for IAB Taxonomy consumer profiles.
 * Provides methods for storing, retrieving, updating, and querying memories.
 *
 * Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md - Memory System
 *
 * v13 Architecture Compliance:
 * - Namespace order: [namespace, userId] per Section 8.12
 * - Uses NAMESPACES constants from @ownyou/shared-types
 */

import type { BaseStore } from '@langchain/langgraph'

// v13 Namespace constants (Section 8.12)
// These match @ownyou/shared-types/namespaces.ts
const V13_NAMESPACES = {
  IAB_CLASSIFICATIONS: 'ownyou.iab',
  EPISODIC_MEMORY: 'ownyou.episodic',
  SEMANTIC_MEMORY: 'ownyou.semantic',
} as const

// ============================================================================
// TYPES
// ============================================================================

export interface SemanticMemory {
  memory_id: string
  taxonomy_id: number
  category_path: string
  tier_1: string
  tier_2?: string
  tier_3?: string
  tier_4?: string
  tier_5?: string
  grouping_tier_key?: string
  grouping_value?: string
  value: string
  confidence: number
  evidence_count: number
  supporting_evidence: string[]
  contradicting_evidence: string[]
  first_observed: string
  last_validated: string
  last_updated: string
  days_since_validation?: number
  data_source: string
  source_ids: string[]
  section: string
  reasoning?: string
  purchase_intent_flag?: string
}

export interface EpisodicMemory {
  episode_id: string
  email_id: string
  email_date: string
  email_subject?: string
  email_summary?: string
  taxonomy_selections: number[]
  confidence_contributions: Record<number, number>
  reasoning: string
  processed_at: string
  llm_model: string
}

export interface ProcessedEmailsTracker {
  user_id: string
  processed_email_ids: string[]
  last_updated: string
  total_processed: number
}

interface MemoryIndex {
  semantic: string[]
  episodic: string[]
}

// ============================================================================
// NAMESPACE UTILITIES (v13 compliant - Section 8.12)
// ============================================================================

/**
 * Get v13-compliant namespace tuple for IAB classifications
 *
 * v13 Pattern: [namespace, userId] - namespace FIRST, then userId
 *
 * @param userId User identifier
 * @returns Namespace tuple in v13 format
 */
export function getIABNamespace(userId: string): string[] {
  return [V13_NAMESPACES.IAB_CLASSIFICATIONS, userId]
}

/**
 * Get v13-compliant namespace tuple for semantic memory
 *
 * @param userId User identifier
 * @returns Namespace tuple in v13 format
 */
export function getSemanticNamespace(userId: string): string[] {
  return [V13_NAMESPACES.SEMANTIC_MEMORY, userId]
}

/**
 * Get v13-compliant namespace tuple for episodic memory
 *
 * @param userId User identifier
 * @returns Namespace tuple in v13 format
 */
export function getEpisodicNamespace(userId: string): string[] {
  return [V13_NAMESPACES.EPISODIC_MEMORY, userId]
}

// Legacy functions for backward compatibility (deprecated)
// TODO: Remove after full migration to v13 namespaces

/** @deprecated Use getIABNamespace instead */
export function getUserNamespace(userId: string, collection: string = 'iab_taxonomy_profile'): string[] {
  // v13 compliant: namespace first, then userId
  if (collection === 'iab_taxonomy_profile') {
    return getIABNamespace(userId)
  } else if (collection === 'processed_emails') {
    return [V13_NAMESPACES.EPISODIC_MEMORY, userId] // Processed emails are episodic
  } else if (collection === 'memory_index') {
    return [V13_NAMESPACES.IAB_CLASSIFICATIONS, userId] // Index lives with IAB data
  }
  // Fallback: still v13 compliant order
  return [`ownyou.${collection}`, userId]
}

/** @deprecated Use getEpisodicNamespace instead */
export function getProcessedEmailsNamespace(userId: string): string[] {
  return getEpisodicNamespace(userId)
}

// ============================================================================
// MEMORY ID UTILITIES
// ============================================================================

// Python line 76: def build_semantic_memory_id(section: str, taxonomy_id: int, value: str) -> str:
export function buildSemanticMemoryId(section: string, taxonomyId: number, value: string): string {
  // Python lines 102-105: Slugify value
  let valueSlug = value.toLowerCase().replace(/ /g, '_').replace(/\|/g, '').replace(/-/g, '_')
  // Python line 105: Remove multiple underscores
  valueSlug = valueSlug.split('_').filter(Boolean).join('_')

  // Python line 107: return f"semantic_{section}_{taxonomy_id}_{value_slug}"
  return `semantic_${section}_${taxonomyId}_${valueSlug}`
}

// Python line 110: def build_episodic_memory_id(email_id: str) -> str:
export function buildEpisodicMemoryId(emailId: string): string {
  // Python line 126: return f"episodic_email_{email_id}"
  return `episodic_email_${emailId}`
}

// Python line 129: def build_tracker_memory_id() -> str:
export function buildTrackerMemoryId(): string {
  // Python line 136: return "tracker_processed_emails"
  return 'tracker_processed_emails'
}

// ============================================================================
// MEMORY MANAGER CLASS
// ============================================================================

const logger = {
  debug: (message: string) => console.debug('[MemoryManager]', message),
  info: (message: string) => console.info('[MemoryManager]', message),
  warning: (message: string) => console.warn('[MemoryManager]', message),
  error: (message: string) => console.error('[MemoryManager]', message),
}

// Python line 57: class MemoryManager:
export class MemoryManager {
  private userId: string
  private store: BaseStore
  private namespace: string[]
  private processedNamespace: string[]
  private indexNamespace: string[]

  // Python line 67: def __init__(self, user_id: str, store=None):
  constructor(userId: string, store: BaseStore) {
    // Python line 76: self.user_id = user_id
    this.userId = userId
    // Python line 82: self.store = store
    this.store = store
    // Python line 83: self.namespace = get_user_namespace(user_id)
    this.namespace = getUserNamespace(userId)
    // Python line 84: self.processed_namespace = get_user_namespace(user_id, "processed_emails")
    this.processedNamespace = getUserNamespace(userId, 'processed_emails')
    // Python line 85: self.index_namespace = get_user_namespace(user_id, "memory_index")
    this.indexNamespace = getUserNamespace(userId, 'memory_index')

    // Python line 87: logger.info(f"MemoryManager initialized for user: {user_id}")
    logger.info(`MemoryManager initialized for user: ${userId}`)
  }

  // =========================================================================
  // Memory ID Index Operations (for tracking all memories)
  // =========================================================================

  // Python line 93: def _get_memory_index(self) -> Dict[str, List[str]]:
  private async getMemoryIndex(): Promise<MemoryIndex> {
    try {
      // Python line 103: result = self.store.get(self.index_namespace, "memory_id_index")
      const result = await this.store.get(this.indexNamespace, 'memory_id_index')

      // Python lines 105-106: if result is None or result.value is None: return {"semantic": [], "episodic": []}
      if (result === null || result === undefined || result.value === null || result.value === undefined) {
        return { semantic: [], episodic: [] }
      }

      // Python line 108: return result.value
      return result.value as MemoryIndex

    } catch (e: any) {
      // Python lines 110-112: except Exception as e: logger.error(...)
      logger.error(`Failed to retrieve memory index: ${e}`)
      return { semantic: [], episodic: [] }
    }
  }

  // Python line 114: def _add_to_memory_index(self, memory_id: str, memory_type: str) -> None:
  private async addToMemoryIndex(memoryId: string, memoryType: 'semantic' | 'episodic'): Promise<void> {
    try {
      // Python line 123: index = self._get_memory_index()
      const index = await this.getMemoryIndex()

      // Python lines 125-126: if memory_type not in index: index[memory_type] = []
      if (!(memoryType in index)) {
        index[memoryType] = []
      }

      // Python lines 128-129: if memory_id not in index[memory_type]: index[memory_type].append(memory_id)
      if (!index[memoryType].includes(memoryId)) {
        index[memoryType].push(memoryId)
      }

      // Python line 131: self.store.put(self.index_namespace, "memory_id_index", index)
      await this.store.put(this.indexNamespace, 'memory_id_index', index)

    } catch (e: any) {
      // Python lines 133-134: except Exception as e: logger.error(...)
      logger.error(`Failed to add to memory index: ${e}`)
    }
  }

  // Python line 136: def _remove_from_memory_index(self, memory_id: str, memory_type: str) -> None:
  private async removeFromMemoryIndex(memoryId: string, memoryType: 'semantic' | 'episodic'): Promise<void> {
    try {
      // Python line 145: index = self._get_memory_index()
      const index = await this.getMemoryIndex()

      // Python lines 147-148: if memory_type in index and memory_id in index[memory_type]: index[memory_type].remove(memory_id)
      if (memoryType in index && index[memoryType].includes(memoryId)) {
        index[memoryType] = index[memoryType].filter(id => id !== memoryId)
      }

      // Python line 150: self.store.put(self.index_namespace, "memory_id_index", index)
      await this.store.put(this.indexNamespace, 'memory_id_index', index)

    } catch (e: any) {
      // Python lines 152-153: except Exception as e: logger.error(...)
      logger.error(`Failed to remove from memory index: ${e}`)
    }
  }

  // =========================================================================
  // Semantic Memory Operations (Taxonomy Classifications)
  // =========================================================================

  // Python line 159: def store_semantic_memory(self, memory_id: str, data: Dict[str, Any]) -> None:
  async storeSemanticMemory(memoryId: string, data: Partial<SemanticMemory>): Promise<void> {
    try {
      // Python lines 192-200: Validate with Pydantic and store
      const memory: SemanticMemory = {
        memory_id: memoryId,
        ...data,
      } as SemanticMemory

      // Python lines 195-200: self.store.put(self.namespace, memory_id, memory.model_dump())
      await this.store.put(
        this.namespace,
        memoryId,
        memory
      )

      // Python line 203: self._add_to_memory_index(memory_id, "semantic")
      await this.addToMemoryIndex(memoryId, 'semantic')

      // Python line 205: logger.debug(f"Stored semantic memory: {memory_id}")
      logger.debug(`Stored semantic memory: ${memoryId}`)

    } catch (e: any) {
      // Python lines 207-209: except Exception as e: logger.error(...) raise
      logger.error(`Failed to store semantic memory ${memoryId}: ${e}`)
      throw e
    }
  }

  // Python line 211: def get_semantic_memory(self, memory_id: str) -> Optional[Dict[str, Any]]:
  async getSemanticMemory(memoryId: string): Promise<SemanticMemory | null> {
    try {
      // Python line 227: result = self.store.get(self.namespace, memory_id)
      const result = await this.store.get(this.namespace, memoryId)

      // Python lines 229-231: if result is None or result.value is None: logger.debug(...) return None
      if (result === null || result === undefined || result.value === null || result.value === undefined) {
        logger.debug(`Semantic memory not found: ${memoryId}`)
        return null
      }

      // Python line 233: return result.value
      return result.value as SemanticMemory

    } catch (e: any) {
      // Python lines 235-237: except Exception as e: logger.error(...) return None
      logger.error(`Failed to retrieve semantic memory ${memoryId}: ${e}`)
      return null
    }
  }

  // Python line 239: def update_semantic_memory(self, memory_id: str, updates: Dict[str, Any]) -> bool:
  async updateSemanticMemory(memoryId: string, updates: Partial<SemanticMemory>): Promise<boolean> {
    try {
      // Python line 267: existing = self.get_semantic_memory(memory_id)
      const existing = await this.getSemanticMemory(memoryId)

      // Python lines 269-271: if existing is None: logger.warning(...) return False
      if (existing === null) {
        logger.warning(`Cannot update non-existent memory: ${memoryId}`)
        return false
      }

      // Python line 274: existing.update(updates)
      const updated = { ...existing, ...updates }

      // Python lines 276-278: if "last_updated" not in updates: existing["last_updated"] = datetime.utcnow().isoformat() + "Z"
      if (!('last_updated' in updates)) {
        updated.last_updated = new Date().toISOString()
      }

      // Python line 281: self.store.put(self.namespace, memory_id, existing)
      await this.store.put(this.namespace, memoryId, updated)

      // Python line 283: logger.debug(f"Updated semantic memory: {memory_id}")
      logger.debug(`Updated semantic memory: ${memoryId}`)
      // Python line 284: return True
      return true

    } catch (e: any) {
      // Python lines 286-288: except Exception as e: logger.error(...) return False
      logger.error(`Failed to update semantic memory ${memoryId}: ${e}`)
      return false
    }
  }

  // Python line 290: def delete_semantic_memory(self, memory_id: str) -> bool:
  async deleteSemanticMemory(memoryId: string): Promise<boolean> {
    try {
      // Python line 301: self.store.delete(self.namespace, memory_id)
      await this.store.delete(this.namespace, memoryId)

      // Python line 304: self._remove_from_memory_index(memory_id, "semantic")
      await this.removeFromMemoryIndex(memoryId, 'semantic')

      // Python line 306: logger.debug(f"Deleted semantic memory: {memory_id}")
      logger.debug(`Deleted semantic memory: ${memoryId}`)
      // Python line 307: return True
      return true

    } catch (e: any) {
      // Python lines 309-311: except Exception as e: logger.error(...) return False
      logger.error(`Failed to delete semantic memory ${memoryId}: ${e}`)
      return false
    }
  }

  // =========================================================================
  // Episodic Memory Operations (Evidence Trails)
  // =========================================================================

  // Python line 317: def store_episodic_memory(self, episode_id: str, data: Dict[str, Any]) -> None:
  async storeEpisodicMemory(episodeId: string, data: Partial<EpisodicMemory>): Promise<void> {
    try {
      // Python lines 344-352: Validate with Pydantic and store
      const episode: EpisodicMemory = {
        episode_id: episodeId,
        ...data,
      } as EpisodicMemory

      // Python lines 348-352: self.store.put(self.namespace, episode_id, episode.model_dump())
      await this.store.put(
        this.namespace,
        episodeId,
        episode
      )

      // Python line 355: self._add_to_memory_index(episode_id, "episodic")
      await this.addToMemoryIndex(episodeId, 'episodic')

      // Python line 357: logger.debug(f"Stored episodic memory: {episode_id}")
      logger.debug(`Stored episodic memory: ${episodeId}`)

    } catch (e: any) {
      // Python lines 359-361: except Exception as e: logger.error(...) raise
      logger.error(`Failed to store episodic memory ${episodeId}: ${e}`)
      throw e
    }
  }

  // Python line 363: def get_episodic_memory(self, episode_id: str) -> Optional[Dict[str, Any]]:
  async getEpisodicMemory(episodeId: string): Promise<EpisodicMemory | null> {
    try {
      // Python line 374: result = self.store.get(self.namespace, episode_id)
      const result = await this.store.get(this.namespace, episodeId)

      // Python lines 376-378: if result is None or result.value is None: logger.debug(...) return None
      if (result === null || result === undefined || result.value === null || result.value === undefined) {
        logger.debug(`Episodic memory not found: ${episodeId}`)
        return null
      }

      // Python line 380: return result.value
      return result.value as EpisodicMemory

    } catch (e: any) {
      // Python lines 382-384: except Exception as e: logger.error(...) return None
      logger.error(`Failed to retrieve episodic memory ${episodeId}: ${e}`)
      return null
    }
  }

  // =========================================================================
  // Processed Email Tracking
  // =========================================================================

  // Python line 390: def get_processed_email_ids(self) -> List[str]:
  async getProcessedEmailIds(): Promise<string[]> {
    try {
      // Python line 402: tracker_id = build_tracker_memory_id()
      const trackerId = buildTrackerMemoryId()
      // Python line 403: result = self.store.get(self.processed_namespace, tracker_id)
      const result = await this.store.get(this.processedNamespace, trackerId)

      // Python lines 405-407: if result is None or result.value is None: logger.debug(...) return []
      if (result === null || result === undefined || result.value === null || result.value === undefined) {
        logger.debug('No processed emails tracker found')
        return []
      }

      // Python lines 409-410: tracker = result.value return tracker.get("processed_email_ids", [])
      const tracker = result.value as ProcessedEmailsTracker
      return tracker.processed_email_ids || []

    } catch (e: any) {
      // Python lines 412-414: except Exception as e: logger.error(...) return []
      logger.error(`Failed to retrieve processed email IDs: ${e}`)
      return []
    }
  }

  // Python line 416: def mark_email_as_processed(self, email_id: str) -> None:
  async markEmailAsProcessed(emailId: string): Promise<void> {
    try {
      // Python line 424: tracker_id = build_tracker_memory_id()
      const trackerId = buildTrackerMemoryId()

      // Python line 427: result = self.store.get(self.processed_namespace, tracker_id)
      const result = await this.store.get(this.processedNamespace, trackerId)

      let tracker: ProcessedEmailsTracker

      // Python lines 429-436: if result is None or result.value is None: create new tracker
      if (result === null || result === undefined || result.value === null || result.value === undefined) {
        tracker = {
          user_id: this.userId,
          processed_email_ids: [emailId],
          last_updated: new Date().toISOString(),
          total_processed: 1
        }
      } else {
        // Python lines 437-443: else: update existing tracker
        tracker = result.value as ProcessedEmailsTracker
        if (!tracker.processed_email_ids.includes(emailId)) {
          tracker.processed_email_ids.push(emailId)
          tracker.total_processed = tracker.processed_email_ids.length
          tracker.last_updated = new Date().toISOString()
        }
      }

      // Python line 446: self.store.put(self.processed_namespace, tracker_id, tracker)
      await this.store.put(this.processedNamespace, trackerId, tracker)

      // Python line 448: logger.debug(f"Marked email as processed: {email_id}")
      logger.debug(`Marked email as processed: ${emailId}`)

    } catch (e: any) {
      // Python lines 450-452: except Exception as e: logger.error(...) raise
      logger.error(`Failed to mark email as processed ${emailId}: ${e}`)
      throw e
    }
  }

  // Python line 454: def mark_emails_as_processed(self, email_ids: List[str]) -> None:
  async markEmailsAsProcessed(emailIds: string[]): Promise<void> {
    try {
      // Python line 462: tracker_id = build_tracker_memory_id()
      const trackerId = buildTrackerMemoryId()

      // Python line 465: result = self.store.get(self.processed_namespace, tracker_id)
      const result = await this.store.get(this.processedNamespace, trackerId)

      let tracker: ProcessedEmailsTracker

      // Python lines 467-474: if result is None or result.value is None: create new tracker
      if (result === null || result === undefined || result.value === null || result.value === undefined) {
        tracker = {
          user_id: this.userId,
          processed_email_ids: emailIds,
          last_updated: new Date().toISOString(),
          total_processed: emailIds.length
        }
      } else {
        // Python lines 475-482: else: update existing tracker
        tracker = result.value as ProcessedEmailsTracker
        const existingSet = new Set(tracker.processed_email_ids)
        const newSet = new Set([...existingSet, ...emailIds])
        tracker.processed_email_ids = Array.from(newSet)
        tracker.total_processed = tracker.processed_email_ids.length
        tracker.last_updated = new Date().toISOString()
      }

      // Python line 485: self.store.put(self.processed_namespace, tracker_id, tracker)
      await this.store.put(this.processedNamespace, trackerId, tracker)

      // Python line 487: logger.info(f"Marked {len(email_ids)} emails as processed")
      logger.info(`Marked ${emailIds.length} emails as processed`)

    } catch (e: any) {
      // Python lines 489-491: except Exception as e: logger.error(...) raise
      logger.error(`Failed to mark emails as processed: ${e}`)
      throw e
    }
  }

  // =========================================================================
  // Memory Search and Query Operations
  // =========================================================================

  // Python line 497: def search_memories(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
  async searchMemories(query: string, limit: number = 10): Promise<Array<Record<string, any>>> {
    try {
      // Python lines 515-519: results = self.store.search(self.namespace, query=query, limit=limit)
      const results = await this.store.search(
        this.namespace,
        { query, limit }
      )

      // Python line 521: return [item.value for item in results if item.value is not None]
      return results
        .filter(item => item.value !== null && item.value !== undefined)
        .map(item => item.value as Record<string, any>)

    } catch (e: any) {
      // Python lines 523-525: except Exception as e: logger.error(...) return []
      logger.error(`Memory search failed: ${e}`)
      return []
    }
  }

  // Python line 527: def get_all_semantic_memories(self) -> List[Dict[str, Any]]:
  async getAllSemanticMemories(): Promise<SemanticMemory[]> {
    try {
      // Python line 537: index = self._get_memory_index()
      const index = await this.getMemoryIndex()
      // Python line 538: semantic_ids = index.get("semantic", [])
      const semanticIds = index.semantic || []

      // Python lines 540-544: memories = [] for memory_id in semantic_ids: ...
      const memories: SemanticMemory[] = []
      for (const memoryId of semanticIds) {
        const memory = await this.getSemanticMemory(memoryId)
        if (memory !== null) {
          memories.push(memory)
        }
      }

      // Python line 546: logger.debug(f"Retrieved {len(memories)} semantic memories")
      logger.debug(`Retrieved ${memories.length} semantic memories`)
      // Python line 547: return memories
      return memories

    } catch (e: any) {
      // Python lines 549-551: except Exception as e: logger.error(...) return []
      logger.error(`Failed to retrieve all semantic memories: ${e}`)
      return []
    }
  }

  // Python line 553: def get_all_episodic_memories(self) -> List[Dict[str, Any]]:
  async getAllEpisodicMemories(): Promise<EpisodicMemory[]> {
    try {
      // Python line 561: index = self._get_memory_index()
      const index = await this.getMemoryIndex()
      // Python line 562: episodic_ids = index.get("episodic", [])
      const episodicIds = index.episodic || []

      // Python lines 564-568: memories = [] for episode_id in episodic_ids: ...
      const memories: EpisodicMemory[] = []
      for (const episodeId of episodicIds) {
        const memory = await this.getEpisodicMemory(episodeId)
        if (memory !== null) {
          memories.push(memory)
        }
      }

      // Python line 570: logger.debug(f"Retrieved {len(memories)} episodic memories")
      logger.debug(`Retrieved ${memories.length} episodic memories`)
      // Python line 571: return memories
      return memories

    } catch (e: any) {
      // Python lines 573-575: except Exception as e: logger.error(...) return []
      logger.error(`Failed to retrieve all episodic memories: ${e}`)
      return []
    }
  }

  // Python line 577: def get_memories_by_section(self, section: str) -> List[Dict[str, Any]]:
  async getMemoriesBySection(section: string): Promise<SemanticMemory[]> {
    try {
      // Python line 592: all_memories = self.get_all_semantic_memories()
      const allMemories = await this.getAllSemanticMemories()

      // Python lines 594-598: section_memories = [mem for mem in all_memories if mem.get("section") == section]
      const sectionMemories = allMemories.filter(
        mem => mem.section === section
      )

      // Python line 600: logger.debug(f"Retrieved {len(section_memories)} memories for section: {section}")
      logger.debug(`Retrieved ${sectionMemories.length} memories for section: ${section}`)
      // Python line 601: return section_memories
      return sectionMemories

    } catch (e: any) {
      // Python lines 603-605: except Exception as e: logger.error(...) return []
      logger.error(`Failed to retrieve memories for section ${section}: ${e}`)
      return []
    }
  }

  // Python line 607: def get_high_confidence_memories(self, threshold: float = 0.8) -> List[Dict[str, Any]]:
  async getHighConfidenceMemories(threshold: number = 0.8): Promise<SemanticMemory[]> {
    try {
      // Python line 621: all_memories = self.get_all_semantic_memories()
      const allMemories = await this.getAllSemanticMemories()

      // Python lines 623-626: high_conf = [mem for mem in all_memories if mem.get("confidence", 0.0) >= threshold]
      const highConf = allMemories.filter(
        mem => (mem.confidence || 0.0) >= threshold
      )

      // Python line 628: logger.debug(f"Retrieved {len(high_conf)} high-confidence memories (>={threshold})")
      logger.debug(`Retrieved ${highConf.length} high-confidence memories (>=${threshold})`)
      // Python line 629: return high_conf
      return highConf

    } catch (e: any) {
      // Python lines 631-633: except Exception as e: logger.error(...) return []
      logger.error(`Failed to retrieve high-confidence memories: ${e}`)
      return []
    }
  }

  // Python line 635: def get_stale_memories(self, days_threshold: int = 30) -> List[Dict[str, Any]]:
  async getStaleMemories(daysThreshold: number = 30): Promise<SemanticMemory[]> {
    try {
      // Python line 646: all_memories = self.get_all_semantic_memories()
      const allMemories = await this.getAllSemanticMemories()

      // Python lines 648-651: stale = [mem for mem in all_memories if mem.get("days_since_validation", 0) >= days_threshold]
      const stale = allMemories.filter(
        mem => (mem.days_since_validation || 0) >= daysThreshold
      )

      // Python line 653: logger.debug(f"Retrieved {len(stale)} stale memories (>{days_threshold} days)")
      logger.debug(`Retrieved ${stale.length} stale memories (>${daysThreshold} days)`)
      // Python line 654: return stale
      return stale

    } catch (e: any) {
      // Python lines 656-658: except Exception as e: logger.error(...) return []
      logger.error(`Failed to retrieve stale memories: ${e}`)
      return []
    }
  }

  // Python line 660: def get_evidence_for_taxonomy(self, taxonomy_id: int) -> Dict[str, Any]:
  async getEvidenceForTaxonomy(taxonomyId: number): Promise<{ supporting_evidence: string[], contradicting_evidence: string[] }> {
    try {
      // Python line 679: all_memories = self.get_all_semantic_memories()
      const allMemories = await this.getAllSemanticMemories()

      // Python lines 681-685: taxonomy_memory = next((mem for mem in all_memories if mem.get("taxonomy_id") == taxonomy_id), None)
      const taxonomyMemory = allMemories.find(
        mem => mem.taxonomy_id === taxonomyId
      )

      // Python lines 687-691: if taxonomy_memory is None: return { "supporting_evidence": [], "contradicting_evidence": [] }
      if (taxonomyMemory === undefined) {
        return {
          supporting_evidence: [],
          contradicting_evidence: []
        }
      }

      // Python lines 693-696: return { "supporting_evidence": ..., "contradicting_evidence": ... }
      return {
        supporting_evidence: taxonomyMemory.supporting_evidence || [],
        contradicting_evidence: taxonomyMemory.contradicting_evidence || []
      }

    } catch (e: any) {
      // Python lines 698-703: except Exception as e: logger.error(...) return { ... }
      logger.error(`Failed to retrieve evidence for taxonomy ${taxonomyId}: ${e}`)
      return {
        supporting_evidence: [],
        contradicting_evidence: []
      }
    }
  }
}
