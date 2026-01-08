#!/usr/bin/env python3
"""
Workflow Tracking Integration

Tracks workflow runs and classification changes for dashboard visualization.
Populates tracking tables (classification_history, analysis_runs, cost_tracking).
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def _get_tracking_queries():
    """
    Import local tracking queries module.

    Returns:
        tracking_queries module or None if unavailable
    """
    try:
        from . import tracking_queries
        return tracking_queries
    except Exception as e:
        logger.warning(f"Tracking queries unavailable: {e}")
        return None


class WorkflowTracker:
    """
    Tracks workflow execution for dashboard analytics.

    Records:
    - Analysis run metadata (emails processed, duration, cost)
    - Classification confidence snapshots (for evolution tracking)
    """

    def __init__(self, user_id: str, enabled: bool = True):
        """
        Initialize workflow tracker.

        Args:
            user_id: User identifier
            enabled: Whether tracking is enabled (default: True)
        """
        self.user_id = user_id
        self.enabled = enabled
        self.queries = _get_tracking_queries() if enabled else None

        # Run metadata
        self.run_start_time = None
        self.emails_processed = 0
        self.classifications_added = 0
        self.classifications_updated = 0
        self.total_cost = 0.0

        if self.enabled and self.queries:
            logger.info(f"Workflow tracking enabled for user: {user_id}")
        else:
            logger.info(f"Workflow tracking disabled")

    def start_run(self) -> None:
        """Start tracking a new analysis run."""
        self.run_start_time = datetime.utcnow()
        self.emails_processed = 0
        self.classifications_added = 0
        self.classifications_updated = 0
        self.total_cost = 0.0

        logger.debug("Started workflow tracking")

    def record_email_processed(self) -> None:
        """Increment email processed counter."""
        self.emails_processed += 1

    def record_classification_change(
        self,
        taxonomy_id: int,
        confidence: float,
        evidence_count: int,
        is_new: bool = False
    ) -> None:
        """
        Record a classification change and save snapshot.

        Args:
            taxonomy_id: IAB Taxonomy ID
            confidence: Current confidence score
            evidence_count: Number of evidence items
            is_new: Whether this is a new classification (vs. update)
        """
        if not self.enabled or not self.queries:
            return

        try:
            # Increment counters
            if is_new:
                self.classifications_added += 1
            else:
                self.classifications_updated += 1

            # Save confidence snapshot for timeline tracking
            snapshot_date = datetime.utcnow().isoformat()
            self.queries.save_classification_snapshot(
                user_id=self.user_id,
                taxonomy_id=taxonomy_id,
                confidence=confidence,
                evidence_count=evidence_count,
                snapshot_date=snapshot_date
            )

            logger.debug(
                f"Saved classification snapshot: tax_id={taxonomy_id}, "
                f"conf={confidence:.2f}, evidence={evidence_count}"
            )

        except Exception as e:
            logger.error(f"Failed to record classification change: {e}")

    def record_cost(
        self,
        provider: str,
        cost: float,
        model_name: Optional[str] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None
    ) -> None:
        """
        Record LLM API cost.

        Args:
            provider: LLM provider (openai, claude, ollama)
            cost: Cost in USD
            model_name: Optional model name
            input_tokens: Optional input token count
            output_tokens: Optional output token count
        """
        if not self.enabled or not self.queries:
            return

        try:
            self.total_cost += cost

            run_date = datetime.utcnow().isoformat()

            self.queries.save_cost_record(
                user_id=self.user_id,
                run_date=run_date,
                provider=provider,
                total_cost=cost,
                email_count=self.emails_processed,
                model_name=model_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens
            )

            logger.debug(f"Saved cost record: provider={provider}, cost=${cost:.4f}")

        except Exception as e:
            logger.error(f"Failed to record cost: {e}")

    def end_run(self, status: str = "completed") -> None:
        """
        Finalize and save analysis run record.

        Args:
            status: Run status (completed, failed, etc.)
        """
        if not self.enabled or not self.queries or not self.run_start_time:
            return

        try:
            # Calculate duration
            end_time = datetime.utcnow()
            duration = (end_time - self.run_start_time).total_seconds()

            run_date = end_time.isoformat()

            # Save analysis run record
            self.queries.save_analysis_run(
                user_id=self.user_id,
                run_date=run_date,
                emails_processed=self.emails_processed,
                classifications_added=self.classifications_added,
                classifications_updated=self.classifications_updated,
                total_cost=self.total_cost if self.total_cost > 0 else None,
                duration_seconds=duration,
                status=status
            )

            logger.info(
                f"Workflow run completed: {self.emails_processed} emails, "
                f"{self.classifications_added} added, {self.classifications_updated} updated, "
                f"cost=${self.total_cost:.4f}, duration={duration:.1f}s"
            )

        except Exception as e:
            logger.error(f"Failed to save analysis run: {e}")


def track_classification_snapshots(
    user_id: str,
    semantic_memories: List[Dict[str, Any]],
    tracker: Optional[WorkflowTracker] = None
) -> None:
    """
    Save classification snapshots for all semantic memories.

    Helper function for batch snapshot creation (e.g., after reconciliation).

    Args:
        user_id: User identifier
        semantic_memories: List of semantic memory dictionaries
        tracker: Optional tracker instance (will create if None)
    """
    if tracker is None:
        tracker = WorkflowTracker(user_id)

    if not tracker.enabled or not tracker.queries:
        logger.debug("Tracking disabled, skipping snapshots")
        return

    for memory in semantic_memories:
        taxonomy_id = memory.get("taxonomy_id")
        confidence = memory.get("confidence", 0.0)
        evidence_count = memory.get("evidence_count", 0)

        if taxonomy_id is None:
            continue

        # Determine if this is a new classification
        # (this is a simplified check - in practice, check if memory was just created)
        is_new = evidence_count == 1

        tracker.record_classification_change(
            taxonomy_id=taxonomy_id,
            confidence=confidence,
            evidence_count=evidence_count,
            is_new=is_new
        )
