#!/usr/bin/env python3
"""
Memory Manager - LangMem Memory Operations

Handles all memory store operations for IAB Taxonomy consumer profiles.
Provides methods for storing, retrieving, updating, and querying memories.

Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md - Memory System
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from langgraph.store.memory import InMemoryStore
import logging
import os

from .schemas import (
    SemanticMemory,
    EpisodicMemory,
    ProcessedEmailsTracker,
    get_user_namespace,
    build_semantic_memory_id,
    build_episodic_memory_id,
    build_tracker_memory_id,
)

logger = logging.getLogger(__name__)


def create_default_store():
    """
    Create default memory store based on configuration.

    Checks MEMORY_BACKEND environment variable:
    - "sqlite" (default): SQLite file-based storage
    - "inmemory": In-memory storage (for testing)

    Returns:
        Store instance
    """
    backend = os.getenv("MEMORY_BACKEND", "sqlite").lower()

    if backend == "sqlite":
        from .backends import SQLiteStore
        db_path = os.getenv("MEMORY_DATABASE_PATH", "data/email_parser_memory.db")
        logger.info(f"Using SQLite backend: {db_path}")
        return SQLiteStore(db_path)
    elif backend == "inmemory":
        logger.info("Using InMemory backend (data will not persist)")
        return InMemoryStore()
    else:
        logger.warning(f"Unknown backend '{backend}', using SQLite")
        from .backends import SQLiteStore
        return SQLiteStore()


class MemoryManager:
    """
    Manages LangMem memory operations for IAB Taxonomy consumer profiles.

    Handles:
    - Semantic memories (taxonomy classifications with confidence)
    - Episodic memories (evidence trails from emails)
    - Processed email tracking (for incremental runs)
    """

    def __init__(self, user_id: str, store=None):
        """
        Initialize MemoryManager for a specific user.

        Args:
            user_id: Unique user identifier
            store: Optional store instance. If None, creates default store
                  based on MEMORY_BACKEND environment variable.
        """
        self.user_id = user_id

        # Create default store if not provided
        if store is None:
            store = create_default_store()

        self.store = store
        self.namespace = get_user_namespace(user_id)
        self.processed_namespace = get_user_namespace(user_id, "processed_emails")
        self.index_namespace = get_user_namespace(user_id, "memory_index")

        logger.info(f"MemoryManager initialized for user: {user_id}")

    # =========================================================================
    # Memory ID Index Operations (for tracking all memories)
    # =========================================================================

    def _get_memory_index(self) -> Dict[str, List[str]]:
        """
        Get the memory ID index.

        Internal method that maintains an index of all memory IDs by type.

        Returns:
            Dictionary with keys: "semantic", "episodic"
        """
        try:
            result = self.store.get(self.index_namespace, "memory_id_index")

            if result is None or result.value is None:
                return {"semantic": [], "episodic": []}

            return result.value

        except Exception as e:
            logger.error(f"Failed to retrieve memory index: {e}")
            return {"semantic": [], "episodic": []}

    def _add_to_memory_index(self, memory_id: str, memory_type: str) -> None:
        """
        Add a memory ID to the index.

        Args:
            memory_id: Memory identifier
            memory_type: "semantic" or "episodic"
        """
        try:
            index = self._get_memory_index()

            if memory_type not in index:
                index[memory_type] = []

            if memory_id not in index[memory_type]:
                index[memory_type].append(memory_id)

            self.store.put(self.index_namespace, "memory_id_index", index)

        except Exception as e:
            logger.error(f"Failed to add to memory index: {e}")

    def _remove_from_memory_index(self, memory_id: str, memory_type: str) -> None:
        """
        Remove a memory ID from the index.

        Args:
            memory_id: Memory identifier
            memory_type: "semantic" or "episodic"
        """
        try:
            index = self._get_memory_index()

            if memory_type in index and memory_id in index[memory_type]:
                index[memory_type].remove(memory_id)

            self.store.put(self.index_namespace, "memory_id_index", index)

        except Exception as e:
            logger.error(f"Failed to remove from memory index: {e}")

    # =========================================================================
    # Semantic Memory Operations (Taxonomy Classifications)
    # =========================================================================

    def store_semantic_memory(
        self,
        memory_id: str,
        data: Dict[str, Any]
    ) -> None:
        """
        Store a semantic memory (taxonomy classification).

        Args:
            memory_id: Unique memory identifier
            data: Memory data dictionary (should match SemanticMemory schema)

        Example:
            >>> manager.store_semantic_memory(
            ...     "semantic_demographics_5_25-29",
            ...     {
            ...         "taxonomy_id": 5,
            ...         "category_path": "Demographic | Age Range | 25-29",
            ...         "tier_1": "Demographic",
            ...         "tier_2": "Age Range",
            ...         "tier_3": "25-29",
            ...         "value": "25-29",
            ...         "confidence": 0.75,
            ...         "evidence_count": 3,
            ...         "first_observed": "2025-09-30T10:00:00Z",
            ...         "last_validated": "2025-09-30T10:00:00Z",
            ...         "last_updated": "2025-09-30T10:00:00Z",
            ...         "data_source": "email",
            ...         "section": "demographics"
            ...     }
            ... )
        """
        try:
            # Validate with Pydantic (optional but recommended)
            memory = SemanticMemory(memory_id=memory_id, **data)

            # Store in LangMem
            self.store.put(
                self.namespace,
                memory_id,
                memory.model_dump()
            )

            # Add to index
            self._add_to_memory_index(memory_id, "semantic")

            logger.debug(f"Stored semantic memory: {memory_id}")

        except Exception as e:
            logger.error(f"Failed to store semantic memory {memory_id}: {e}")
            raise

    def get_semantic_memory(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a semantic memory by ID.

        Args:
            memory_id: Memory identifier

        Returns:
            Memory data dictionary or None if not found

        Example:
            >>> memory = manager.get_semantic_memory("semantic_demographics_5_25-29")
            >>> if memory:
            ...     print(f"Confidence: {memory['confidence']}")
        """
        try:
            result = self.store.get(self.namespace, memory_id)

            if result is None or result.value is None:
                logger.debug(f"Semantic memory not found: {memory_id}")
                return None

            return result.value

        except Exception as e:
            logger.error(f"Failed to retrieve semantic memory {memory_id}: {e}")
            return None

    def update_semantic_memory(
        self,
        memory_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """
        Update an existing semantic memory.

        Args:
            memory_id: Memory identifier
            updates: Dictionary of fields to update

        Returns:
            True if successful, False otherwise

        Example:
            >>> manager.update_semantic_memory(
            ...     "semantic_demographics_5_25-29",
            ...     {
            ...         "confidence": 0.85,
            ...         "evidence_count": 5,
            ...         "last_validated": "2025-09-30T12:00:00Z",
            ...         "last_updated": "2025-09-30T12:00:00Z"
            ...     }
            ... )
        """
        try:
            # Get existing memory
            existing = self.get_semantic_memory(memory_id)

            if existing is None:
                logger.warning(f"Cannot update non-existent memory: {memory_id}")
                return False

            # Merge updates
            existing.update(updates)

            # Ensure last_updated is set
            if "last_updated" not in updates:
                existing["last_updated"] = datetime.utcnow().isoformat() + "Z"

            # Store updated memory
            self.store.put(self.namespace, memory_id, existing)

            logger.debug(f"Updated semantic memory: {memory_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to update semantic memory {memory_id}: {e}")
            return False

    def delete_semantic_memory(self, memory_id: str) -> bool:
        """
        Delete a semantic memory.

        Args:
            memory_id: Memory identifier

        Returns:
            True if successful, False otherwise
        """
        try:
            self.store.delete(self.namespace, memory_id)

            # Remove from index
            self._remove_from_memory_index(memory_id, "semantic")

            logger.debug(f"Deleted semantic memory: {memory_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete semantic memory {memory_id}: {e}")
            return False

    # =========================================================================
    # Episodic Memory Operations (Evidence Trails)
    # =========================================================================

    def store_episodic_memory(
        self,
        episode_id: str,
        data: Dict[str, Any]
    ) -> None:
        """
        Store an episodic memory (email evidence trail).

        Args:
            episode_id: Unique episode identifier (typically episodic_email_{email_id})
            data: Episode data dictionary (should match EpisodicMemory schema)

        Example:
            >>> manager.store_episodic_memory(
            ...     "episodic_email_19989c11387876ec",
            ...     {
            ...         "email_id": "19989c11387876ec",
            ...         "email_date": "2025-09-27",
            ...         "taxonomy_selections": [5, 342],
            ...         "confidence_contributions": {5: 0.8, 342: 0.9},
            ...         "reasoning": "Crypto newsletter suggests age 25-35...",
            ...         "processed_at": "2025-09-30T10:00:00Z",
            ...         "llm_model": "claude:sonnet-4"
            ...     }
            ... )
        """
        try:
            # Validate with Pydantic
            episode = EpisodicMemory(episode_id=episode_id, **data)

            # Store in LangMem
            self.store.put(
                self.namespace,
                episode_id,
                episode.model_dump()
            )

            # Add to index
            self._add_to_memory_index(episode_id, "episodic")

            logger.debug(f"Stored episodic memory: {episode_id}")

        except Exception as e:
            logger.error(f"Failed to store episodic memory {episode_id}: {e}")
            raise

    def get_episodic_memory(self, episode_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve an episodic memory by ID.

        Args:
            episode_id: Episode identifier

        Returns:
            Episode data dictionary or None if not found
        """
        try:
            result = self.store.get(self.namespace, episode_id)

            if result is None or result.value is None:
                logger.debug(f"Episodic memory not found: {episode_id}")
                return None

            return result.value

        except Exception as e:
            logger.error(f"Failed to retrieve episodic memory {episode_id}: {e}")
            return None

    # =========================================================================
    # Processed Email Tracking
    # =========================================================================

    def get_processed_email_ids(self) -> List[str]:
        """
        Get list of all processed email IDs.

        Returns:
            List of email IDs that have been processed

        Example:
            >>> processed = manager.get_processed_email_ids()
            >>> new_emails = [e for e in all_emails if e['id'] not in processed]
        """
        try:
            tracker_id = build_tracker_memory_id()
            result = self.store.get(self.processed_namespace, tracker_id)

            if result is None or result.value is None:
                logger.debug("No processed emails tracker found")
                return []

            tracker = result.value
            return tracker.get("processed_email_ids", [])

        except Exception as e:
            logger.error(f"Failed to retrieve processed email IDs: {e}")
            return []

    def mark_email_as_processed(self, email_id: str) -> None:
        """
        Mark a single email as processed.

        Args:
            email_id: Email ID to mark as processed
        """
        try:
            tracker_id = build_tracker_memory_id()

            # Get existing tracker
            result = self.store.get(self.processed_namespace, tracker_id)

            if result is None or result.value is None:
                # Create new tracker
                tracker = {
                    "user_id": self.user_id,
                    "processed_email_ids": [email_id],
                    "last_updated": datetime.utcnow().isoformat() + "Z",
                    "total_processed": 1
                }
            else:
                # Update existing tracker
                tracker = result.value
                if email_id not in tracker["processed_email_ids"]:
                    tracker["processed_email_ids"].append(email_id)
                    tracker["total_processed"] = len(tracker["processed_email_ids"])
                    tracker["last_updated"] = datetime.utcnow().isoformat() + "Z"

            # Store updated tracker
            self.store.put(self.processed_namespace, tracker_id, tracker)

            logger.debug(f"Marked email as processed: {email_id}")

        except Exception as e:
            logger.error(f"Failed to mark email as processed {email_id}: {e}")
            raise

    def mark_emails_as_processed(self, email_ids: List[str]) -> None:
        """
        Mark multiple emails as processed (batch operation).

        Args:
            email_ids: List of email IDs to mark as processed
        """
        try:
            tracker_id = build_tracker_memory_id()

            # Get existing tracker
            result = self.store.get(self.processed_namespace, tracker_id)

            if result is None or result.value is None:
                # Create new tracker
                tracker = {
                    "user_id": self.user_id,
                    "processed_email_ids": email_ids,
                    "last_updated": datetime.utcnow().isoformat() + "Z",
                    "total_processed": len(email_ids)
                }
            else:
                # Update existing tracker
                tracker = result.value
                existing_set = set(tracker["processed_email_ids"])
                new_set = existing_set.union(set(email_ids))
                tracker["processed_email_ids"] = list(new_set)
                tracker["total_processed"] = len(tracker["processed_email_ids"])
                tracker["last_updated"] = datetime.utcnow().isoformat() + "Z"

            # Store updated tracker
            self.store.put(self.processed_namespace, tracker_id, tracker)

            logger.info(f"Marked {len(email_ids)} emails as processed")

        except Exception as e:
            logger.error(f"Failed to mark emails as processed: {e}")
            raise

    # =========================================================================
    # Memory Search and Query Operations
    # =========================================================================

    def search_memories(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search memories using semantic similarity.

        Note: Requires embeddings to be enabled in the store.

        Args:
            query: Search query string
            limit: Maximum number of results

        Returns:
            List of matching memory dictionaries
        """
        try:
            results = self.store.search(
                self.namespace,
                query=query,
                limit=limit
            )

            return [item.value for item in results if item.value is not None]

        except Exception as e:
            logger.error(f"Memory search failed: {e}")
            return []

    def get_all_semantic_memories(self) -> List[Dict[str, Any]]:
        """
        Get all semantic memories for this user.

        Uses memory ID index to retrieve all stored memories.

        Returns:
            List of all semantic memory dictionaries
        """
        try:
            index = self._get_memory_index()
            semantic_ids = index.get("semantic", [])

            memories = []
            for memory_id in semantic_ids:
                memory = self.get_semantic_memory(memory_id)
                if memory is not None:
                    memories.append(memory)

            logger.debug(f"Retrieved {len(memories)} semantic memories")
            return memories

        except Exception as e:
            logger.error(f"Failed to retrieve all semantic memories: {e}")
            return []

    def get_all_episodic_memories(self) -> List[Dict[str, Any]]:
        """
        Get all episodic memories for this user.

        Returns:
            List of all episodic memory dictionaries
        """
        try:
            index = self._get_memory_index()
            episodic_ids = index.get("episodic", [])

            memories = []
            for episode_id in episodic_ids:
                memory = self.get_episodic_memory(episode_id)
                if memory is not None:
                    memories.append(memory)

            logger.debug(f"Retrieved {len(memories)} episodic memories")
            return memories

        except Exception as e:
            logger.error(f"Failed to retrieve all episodic memories: {e}")
            return []

    def get_memories_by_section(self, section: str) -> List[Dict[str, Any]]:
        """
        Get all memories for a specific taxonomy section.

        Args:
            section: Section name (demographics, interests, purchase_intent, etc.)

        Returns:
            List of memory dictionaries for that section

        Example:
            >>> demographics = manager.get_memories_by_section("demographics")
            >>> interests = manager.get_memories_by_section("interests")
        """
        try:
            all_memories = self.get_all_semantic_memories()

            # Filter by section
            section_memories = [
                mem for mem in all_memories
                if mem.get("section") == section
            ]

            logger.debug(f"Retrieved {len(section_memories)} memories for section: {section}")
            return section_memories

        except Exception as e:
            logger.error(f"Failed to retrieve memories for section {section}: {e}")
            return []

    def get_high_confidence_memories(
        self,
        threshold: float = 0.8
    ) -> List[Dict[str, Any]]:
        """
        Get all memories with confidence above threshold.

        Args:
            threshold: Minimum confidence score (default: 0.8)

        Returns:
            List of high-confidence memory dictionaries
        """
        try:
            all_memories = self.get_all_semantic_memories()

            high_conf = [
                mem for mem in all_memories
                if mem.get("confidence", 0.0) >= threshold
            ]

            logger.debug(f"Retrieved {len(high_conf)} high-confidence memories (>={threshold})")
            return high_conf

        except Exception as e:
            logger.error(f"Failed to retrieve high-confidence memories: {e}")
            return []

    def get_stale_memories(self, days_threshold: int = 30) -> List[Dict[str, Any]]:
        """
        Get memories that haven't been validated recently.

        Args:
            days_threshold: Days since last validation (default: 30)

        Returns:
            List of stale memory dictionaries needing validation
        """
        try:
            all_memories = self.get_all_semantic_memories()

            stale = [
                mem for mem in all_memories
                if mem.get("days_since_validation", 0) >= days_threshold
            ]

            logger.debug(f"Retrieved {len(stale)} stale memories (>{days_threshold} days)")
            return stale

        except Exception as e:
            logger.error(f"Failed to retrieve stale memories: {e}")
            return []

    def get_evidence_for_taxonomy(
        self,
        taxonomy_id: int
    ) -> Dict[str, Any]:
        """
        Get all evidence (supporting and contradicting) for a taxonomy classification.

        Args:
            taxonomy_id: IAB Taxonomy ID

        Returns:
            Dictionary with supporting_evidence and contradicting_evidence lists

        Example:
            >>> evidence = manager.get_evidence_for_taxonomy(5)
            >>> print(f"Supporting: {len(evidence['supporting_evidence'])} emails")
            >>> print(f"Contradicting: {len(evidence['contradicting_evidence'])} emails")
        """
        try:
            all_memories = self.get_all_semantic_memories()

            # Find memory for this taxonomy_id
            taxonomy_memory = next(
                (mem for mem in all_memories if mem.get("taxonomy_id") == taxonomy_id),
                None
            )

            if taxonomy_memory is None:
                return {
                    "supporting_evidence": [],
                    "contradicting_evidence": []
                }

            return {
                "supporting_evidence": taxonomy_memory.get("supporting_evidence", []),
                "contradicting_evidence": taxonomy_memory.get("contradicting_evidence", [])
            }

        except Exception as e:
            logger.error(f"Failed to retrieve evidence for taxonomy {taxonomy_id}: {e}")
            return {
                "supporting_evidence": [],
                "contradicting_evidence": []
            }