"""
Memory System Module - LangMem-based persistent storage

Implements memory management for IAB Taxonomy consumer profiles:
- Semantic memories: Facts about user (taxonomy classifications)
- Episodic memories: Evidence trails from emails
- Confidence scoring and evolution
- Evidence reconciliation

Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md
"""

from .store import initialize_memory_store
from .manager import MemoryManager
from .confidence import (
    update_confidence,
    apply_temporal_decay,
    calculate_days_since_validation,
    should_mark_for_review,
    recalibrate_confidence_with_decay,
    combine_evidence_updates,
    initialize_confidence,
)
from .reconciliation import (
    classify_evidence_type,
    reconcile_evidence,
    reconcile_batch_evidence,
    get_conflicting_classifications,
    resolve_contradiction,
)

__all__ = [
    'initialize_memory_store',
    'MemoryManager',
    'update_confidence',
    'apply_temporal_decay',
    'calculate_days_since_validation',
    'should_mark_for_review',
    'recalibrate_confidence_with_decay',
    'combine_evidence_updates',
    'initialize_confidence',
    'classify_evidence_type',
    'reconcile_evidence',
    'reconcile_batch_evidence',
    'get_conflicting_classifications',
    'resolve_contradiction',
]