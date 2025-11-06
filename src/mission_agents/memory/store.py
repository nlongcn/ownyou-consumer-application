#!/usr/bin/env python3
"""
Mission Agent Store

LangGraph Store wrapper providing typed access to all OwnYou namespaces.
Single source of truth for all mission agent memory.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import os

from langgraph.store.memory import InMemoryStore
from .config import StoreConfig

logger = logging.getLogger(__name__)


class MissionStore:
    """
    Wrapper around LangGraph Store providing typed access to OwnYou namespaces.

    This class provides convenience methods for reading and writing to all
    defined Store namespaces, following the single-source-of-truth architecture.

    Example:
        >>> config = StoreConfig()
        >>> store = MissionStore(config=config)
        >>> store.put_iab_classification(
        ...     user_id="user_123",
        ...     taxonomy_id=123,
        ...     classification={...}
        ... )
        >>> classifications = store.get_all_iab_classifications("user_123")
    """

    def __init__(self, config: Optional[StoreConfig] = None):
        """
        Initialize Mission Store.

        Args:
            config: Store configuration (uses defaults if not provided)
        """
        self.config = config or StoreConfig()
        self.store = self._initialize_store()

        logger.info(
            f"MissionStore initialized with {self.config.storage_type} backend"
        )

    def _initialize_store(self):
        """Initialize LangGraph Store based on configuration."""

        if self.config.storage_type == "inmemory":
            # InMemoryStore for development/testing
            if self.config.enable_semantic_search:
                store = InMemoryStore(
                    index={
                        "dims": self.config.embed_dims,
                        "embed": self.config.embed_model,
                    }
                )
                logger.info(
                    f"InMemoryStore initialized with embeddings "
                    f"({self.config.embed_model})"
                )
            else:
                store = InMemoryStore()
                logger.info("InMemoryStore initialized without embeddings")

            return store

        elif self.config.storage_type == "postgres":
            # PostgreSQL for production (Phase 7)
            if not self.config.postgres_connection_string:
                raise ValueError(
                    "postgres_connection_string required for postgres storage"
                )

            # Note: PostgreSQL support requires async implementation
            # For Phase 1, document this pathway for Phase 7
            raise NotImplementedError(
                "PostgreSQL store will be implemented in Phase 7. "
                "Use InMemoryStore for Phase 1-6 development."
            )

        else:
            raise ValueError(
                f"Invalid storage_type: {self.config.storage_type}. "
                f"Must be 'inmemory' or 'postgres'"
            )

    def _get_namespace(self, memory_type: str, **kwargs) -> tuple:
        """
        Get formatted namespace tuple for a memory type.

        Args:
            memory_type: Type of memory (e.g., "iab_classifications")
            **kwargs: Partition keys (e.g., user_id, taxonomy_id)

        Returns:
            Formatted namespace tuple

        Raises:
            ValueError: If memory_type not found or missing required keys
        """
        namespace = self.config.format_namespace(memory_type, **kwargs)
        if namespace is None:
            raise ValueError(f"Unknown memory type: {memory_type}")
        return namespace

    # ==========================================================================
    # IAB SYSTEM METHODS
    # ==========================================================================

    def put_iab_classification(
        self,
        user_id: str,
        taxonomy_id: int,
        classification: Dict[str, Any]
    ) -> None:
        """Store IAB classification for a user."""
        namespace = self._get_namespace("iab_classifications", user_id=user_id)
        key = f"taxonomy_{taxonomy_id}"
        self.store.put(namespace, key, classification)

    def get_iab_classification(
        self,
        user_id: str,
        taxonomy_id: int
    ) -> Optional[Dict[str, Any]]:
        """Retrieve specific IAB classification."""
        namespace = self._get_namespace("iab_classifications", user_id=user_id)
        key = f"taxonomy_{taxonomy_id}"
        item = self.store.get(namespace, key)
        return item.value if item else None

    def get_all_iab_classifications(
        self,
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Retrieve all IAB classifications for a user."""
        namespace = self._get_namespace("iab_classifications", user_id=user_id)
        items = self.store.search(namespace)
        return [item.value for item in items]

    def put_iab_evidence(
        self,
        user_id: str,
        taxonomy_id: int,
        evidence_id: str,
        evidence: Dict[str, Any]
    ) -> None:
        """Store evidence for IAB classification."""
        namespace = self._get_namespace(
            "iab_evidence",
            user_id=user_id,
            taxonomy_id=str(taxonomy_id)
        )
        self.store.put(namespace, evidence_id, evidence)

    def get_iab_evidence(
        self,
        user_id: str,
        taxonomy_id: int
    ) -> List[Dict[str, Any]]:
        """Retrieve all evidence for a taxonomy."""
        namespace = self._get_namespace(
            "iab_evidence",
            user_id=user_id,
            taxonomy_id=str(taxonomy_id)
        )
        items = self.store.search(namespace)
        return [item.value for item in items]

    # ==========================================================================
    # USER PROFILE METHODS
    # ==========================================================================

    def put_user_profile(self, user_id: str, profile: Dict[str, Any]) -> None:
        """Store user profile."""
        namespace = self._get_namespace("user_profile", user_id=user_id)
        self.store.put(namespace, "profile", profile)

    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve user profile."""
        namespace = self._get_namespace("user_profile", user_id=user_id)
        item = self.store.get(namespace, "profile")
        return item.value if item else None

    def put_demographics(self, user_id: str, demographics: Dict[str, Any]) -> None:
        """Store demographics."""
        namespace = self._get_namespace("demographics", user_id=user_id)
        self.store.put(namespace, "data", demographics)

    def get_demographics(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve demographics."""
        namespace = self._get_namespace("demographics", user_id=user_id)
        item = self.store.get(namespace, "data")
        return item.value if item else None

    def put_household(self, user_id: str, household: Dict[str, Any]) -> None:
        """Store household information."""
        namespace = self._get_namespace("household", user_id=user_id)
        self.store.put(namespace, "data", household)

    def get_household(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve household information."""
        namespace = self._get_namespace("household", user_id=user_id)
        item = self.store.get(namespace, "data")
        return item.value if item else None

    # ==========================================================================
    # IKIGAI METHODS
    # ==========================================================================

    def put_ikigai_profile(self, user_id: str, ikigai: Dict[str, Any]) -> None:
        """Store Ikigai profile."""
        namespace = self._get_namespace("ikigai_profile", user_id=user_id)
        self.store.put(namespace, "profile", ikigai)

    def get_ikigai_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve Ikigai profile."""
        namespace = self._get_namespace("ikigai_profile", user_id=user_id)
        item = self.store.get(namespace, "profile")
        return item.value if item else None

    def put_ikigai_interests(
        self,
        user_id: str,
        interest_type: str,
        interests: Dict[str, Any]
    ) -> None:
        """Store Ikigai interest details."""
        namespace = self._get_namespace(
            "ikigai_interests",
            user_id=user_id,
            interest_type=interest_type
        )
        self.store.put(namespace, "data", interests)

    def get_ikigai_interests(
        self,
        user_id: str,
        interest_type: str
    ) -> Optional[Dict[str, Any]]:
        """Retrieve Ikigai interest details."""
        namespace = self._get_namespace(
            "ikigai_interests",
            user_id=user_id,
            interest_type=interest_type
        )
        item = self.store.get(namespace, "data")
        return item.value if item else None

    # ==========================================================================
    # SHOPPING & FINANCIAL METHODS
    # ==========================================================================

    def put_shopping_list(self, user_id: str, shopping_list: Dict[str, Any]) -> None:
        """Store shopping list."""
        namespace = self._get_namespace("shopping_list", user_id=user_id)
        self.store.put(namespace, "list", shopping_list)

    def get_shopping_list(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve shopping list."""
        namespace = self._get_namespace("shopping_list", user_id=user_id)
        item = self.store.get(namespace, "list")
        return item.value if item else None

    def put_shopping_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> None:
        """Store shopping preferences."""
        namespace = self._get_namespace("shopping_preferences", user_id=user_id)
        self.store.put(namespace, "preferences", preferences)

    def get_shopping_preferences(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve shopping preferences."""
        namespace = self._get_namespace("shopping_preferences", user_id=user_id)
        item = self.store.get(namespace, "preferences")
        return item.value if item else None

    def put_shopping_history(
        self,
        user_id: str,
        history: Dict[str, Any]
    ) -> None:
        """Store shopping history."""
        namespace = self._get_namespace("shopping_history", user_id=user_id)
        self.store.put(namespace, "history", history)

    def get_shopping_history(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve shopping history."""
        namespace = self._get_namespace("shopping_history", user_id=user_id)
        item = self.store.get(namespace, "history")
        return item.value if item else None

    def put_financial_profile(
        self,
        user_id: str,
        profile: Dict[str, Any]
    ) -> None:
        """Store financial profile."""
        namespace = self._get_namespace("financial_profile", user_id=user_id)
        self.store.put(namespace, "profile", profile)

    def get_financial_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve financial profile."""
        namespace = self._get_namespace("financial_profile", user_id=user_id)
        item = self.store.get(namespace, "profile")
        return item.value if item else None

    def put_utility_bills(self, user_id: str, bills: Dict[str, Any]) -> None:
        """Store utility bills."""
        namespace = self._get_namespace("utility_bills", user_id=user_id)
        self.store.put(namespace, "bills", bills)

    def get_utility_bills(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve utility bills."""
        namespace = self._get_namespace("utility_bills", user_id=user_id)
        item = self.store.get(namespace, "bills")
        return item.value if item else None

    def put_subscriptions(self, user_id: str, subscriptions: Dict[str, Any]) -> None:
        """Store subscriptions."""
        namespace = self._get_namespace("subscriptions", user_id=user_id)
        self.store.put(namespace, "subscriptions", subscriptions)

    def get_subscriptions(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve subscriptions."""
        namespace = self._get_namespace("subscriptions", user_id=user_id)
        item = self.store.get(namespace, "subscriptions")
        return item.value if item else None

    # ==========================================================================
    # TRAVEL & DINING METHODS
    # ==========================================================================

    def put_travel_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> None:
        """Store travel preferences."""
        namespace = self._get_namespace("travel_preferences", user_id=user_id)
        self.store.put(namespace, "preferences", preferences)

    def get_travel_preferences(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve travel preferences."""
        namespace = self._get_namespace("travel_preferences", user_id=user_id)
        item = self.store.get(namespace, "preferences")
        return item.value if item else None

    def put_past_trips(self, user_id: str, trips: Dict[str, Any]) -> None:
        """Store past trips."""
        namespace = self._get_namespace("past_trips", user_id=user_id)
        self.store.put(namespace, "trips", trips)

    def get_past_trips(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve past trips."""
        namespace = self._get_namespace("past_trips", user_id=user_id)
        item = self.store.get(namespace, "trips")
        return item.value if item else None

    def put_dining_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> None:
        """Store dining preferences."""
        namespace = self._get_namespace("dining_preferences", user_id=user_id)
        self.store.put(namespace, "preferences", preferences)

    def get_dining_preferences(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve dining preferences."""
        namespace = self._get_namespace("dining_preferences", user_id=user_id)
        item = self.store.get(namespace, "preferences")
        return item.value if item else None

    def put_restaurant_history(
        self,
        user_id: str,
        history: Dict[str, Any]
    ) -> None:
        """Store restaurant history."""
        namespace = self._get_namespace("restaurant_history", user_id=user_id)
        self.store.put(namespace, "history", history)

    def get_restaurant_history(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve restaurant history."""
        namespace = self._get_namespace("restaurant_history", user_id=user_id)
        item = self.store.get(namespace, "history")
        return item.value if item else None

    # ==========================================================================
    # EVENTS & CONTENT METHODS
    # ==========================================================================

    def put_event_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> None:
        """Store event preferences."""
        namespace = self._get_namespace("event_preferences", user_id=user_id)
        self.store.put(namespace, "preferences", preferences)

    def get_event_preferences(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve event preferences."""
        namespace = self._get_namespace("event_preferences", user_id=user_id)
        item = self.store.get(namespace, "preferences")
        return item.value if item else None

    def put_attended_events(self, user_id: str, events: Dict[str, Any]) -> None:
        """Store attended events."""
        namespace = self._get_namespace("attended_events", user_id=user_id)
        self.store.put(namespace, "events", events)

    def get_attended_events(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve attended events."""
        namespace = self._get_namespace("attended_events", user_id=user_id)
        item = self.store.get(namespace, "events")
        return item.value if item else None

    def put_content_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> None:
        """Store content preferences."""
        namespace = self._get_namespace("content_preferences", user_id=user_id)
        self.store.put(namespace, "preferences", preferences)

    def get_content_preferences(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve content preferences."""
        namespace = self._get_namespace("content_preferences", user_id=user_id)
        item = self.store.get(namespace, "preferences")
        return item.value if item else None

    # ==========================================================================
    # HEALTH METHODS
    # ==========================================================================

    def put_health_profile(self, user_id: str, profile: Dict[str, Any]) -> None:
        """Store health profile."""
        namespace = self._get_namespace("health_profile", user_id=user_id)
        self.store.put(namespace, "profile", profile)

    def get_health_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve health profile."""
        namespace = self._get_namespace("health_profile", user_id=user_id)
        item = self.store.get(namespace, "profile")
        return item.value if item else None

    def put_fitness_goals(self, user_id: str, goals: Dict[str, Any]) -> None:
        """Store fitness goals."""
        namespace = self._get_namespace("fitness_goals", user_id=user_id)
        self.store.put(namespace, "goals", goals)

    def get_fitness_goals(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve fitness goals."""
        namespace = self._get_namespace("fitness_goals", user_id=user_id)
        item = self.store.get(namespace, "goals")
        return item.value if item else None

    # ==========================================================================
    # MISSION STATE METHODS
    # ==========================================================================

    def put_mission_learnings(
        self,
        mission_type: str,
        learnings: Dict[str, Any]
    ) -> None:
        """Store mission learnings (cross-user patterns)."""
        namespace = self._get_namespace("mission_learnings", mission_type=mission_type)
        self.store.put(namespace, "learnings", learnings)

    def get_mission_learnings(self, mission_type: str) -> Optional[Dict[str, Any]]:
        """Retrieve mission learnings."""
        namespace = self._get_namespace("mission_learnings", mission_type=mission_type)
        item = self.store.get(namespace, "learnings")
        return item.value if item else None

    def put_completed_missions(
        self,
        user_id: str,
        missions: Dict[str, Any]
    ) -> None:
        """Store completed missions."""
        namespace = self._get_namespace("completed_missions", user_id=user_id)
        self.store.put(namespace, "missions", missions)

    def get_completed_missions(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve completed missions."""
        namespace = self._get_namespace("completed_missions", user_id=user_id)
        item = self.store.get(namespace, "missions")
        return item.value if item else None

    def put_mission_feedback(
        self,
        user_id: str,
        mission_id: str,
        feedback: Dict[str, Any]
    ) -> None:
        """Store mission feedback."""
        namespace = self._get_namespace(
            "mission_feedback",
            user_id=user_id,
            mission_id=mission_id
        )
        self.store.put(namespace, "feedback", feedback)

    def get_mission_feedback(
        self,
        user_id: str,
        mission_id: str
    ) -> Optional[Dict[str, Any]]:
        """Retrieve mission feedback."""
        namespace = self._get_namespace(
            "mission_feedback",
            user_id=user_id,
            mission_id=mission_id
        )
        item = self.store.get(namespace, "feedback")
        return item.value if item else None

    # ==========================================================================
    # EPISODIC MEMORY METHODS
    # ==========================================================================

    def put_email_events(self, user_id: str, events: Dict[str, Any]) -> None:
        """Store email events."""
        namespace = self._get_namespace("email_events", user_id=user_id)
        self.store.put(namespace, "events", events)

    def get_email_events(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve email events."""
        namespace = self._get_namespace("email_events", user_id=user_id)
        item = self.store.get(namespace, "events")
        return item.value if item else None

    def put_calendar_events(self, user_id: str, events: Dict[str, Any]) -> None:
        """Store calendar events."""
        namespace = self._get_namespace("calendar_events", user_id=user_id)
        self.store.put(namespace, "events", events)

    def get_calendar_events(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve calendar events."""
        namespace = self._get_namespace("calendar_events", user_id=user_id)
        item = self.store.get(namespace, "events")
        return item.value if item else None

    def put_financial_transactions(
        self,
        user_id: str,
        transactions: Dict[str, Any]
    ) -> None:
        """Store financial transactions."""
        namespace = self._get_namespace("financial_transactions", user_id=user_id)
        self.store.put(namespace, "transactions", transactions)

    def get_financial_transactions(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve financial transactions."""
        namespace = self._get_namespace("financial_transactions", user_id=user_id)
        item = self.store.get(namespace, "transactions")
        return item.value if item else None

    def put_location_history(self, user_id: str, history: Dict[str, Any]) -> None:
        """Store location history."""
        namespace = self._get_namespace("location_history", user_id=user_id)
        self.store.put(namespace, "history", history)

    def get_location_history(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve location history."""
        namespace = self._get_namespace("location_history", user_id=user_id)
        item = self.store.get(namespace, "history")
        return item.value if item else None

    def put_browsing_history(self, user_id: str, history: Dict[str, Any]) -> None:
        """Store browsing history."""
        namespace = self._get_namespace("browsing_history", user_id=user_id)
        self.store.put(namespace, "history", history)

    def get_browsing_history(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve browsing history."""
        namespace = self._get_namespace("browsing_history", user_id=user_id)
        item = self.store.get(namespace, "history")
        return item.value if item else None

    def put_photo_events(self, user_id: str, events: Dict[str, Any]) -> None:
        """Store photo events."""
        namespace = self._get_namespace("photo_events", user_id=user_id)
        self.store.put(namespace, "events", events)

    def get_photo_events(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve photo events."""
        namespace = self._get_namespace("photo_events", user_id=user_id)
        item = self.store.get(namespace, "events")
        return item.value if item else None

    def put_social_events(self, user_id: str, events: Dict[str, Any]) -> None:
        """Store social events."""
        namespace = self._get_namespace("social_events", user_id=user_id)
        self.store.put(namespace, "events", events)

    def get_social_events(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve social events."""
        namespace = self._get_namespace("social_events", user_id=user_id)
        item = self.store.get(namespace, "events")
        return item.value if item else None

    def put_health_events(self, user_id: str, events: Dict[str, Any]) -> None:
        """Store health events."""
        namespace = self._get_namespace("health_events", user_id=user_id)
        self.store.put(namespace, "events", events)

    def get_health_events(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve health events."""
        namespace = self._get_namespace("health_events", user_id=user_id)
        item = self.store.get(namespace, "events")
        return item.value if item else None

    # ==========================================================================
    # UTILITY METHODS
    # ==========================================================================

    def delete_namespace(self, namespace: tuple) -> None:
        """
        Delete all items in a namespace (GDPR compliance).

        Args:
            namespace: Namespace tuple to delete

        Example:
            >>> store = MissionStore()
            >>> namespace = ("ownyou.iab_classifications", "user_123")
            >>> store.delete_namespace(namespace)
        """
        # LangGraph Store doesn't have bulk delete
        # Implement by listing all keys and deleting individually
        items = self.store.search(namespace)
        for item in items:
            self.store.delete(namespace, item.key)

    def list_all_namespaces_for_user(self, user_id: str) -> List[str]:
        """
        List all namespace types that have data for a user.

        Args:
            user_id: User identifier

        Returns:
            List of memory type names that have data

        Example:
            >>> store = MissionStore()
            >>> namespaces = store.list_all_namespaces_for_user("user_123")
            >>> print(namespaces)
            ['iab_classifications', 'shopping_preferences', 'ikigai_profile']
        """
        found_namespaces = []

        # Check each single-user namespace
        for memory_type in self.config.list_all_memory_types():
            # Skip cross-user namespaces
            if memory_type == "mission_learnings":
                continue

            try:
                # Try to get namespace for this user
                namespace = self.config.format_namespace(memory_type, user_id=user_id)
                if namespace:
                    items = self.store.search(namespace)
                    if items:
                        found_namespaces.append(memory_type)
            except Exception:
                # Missing required keys or invalid namespace
                continue

        return found_namespaces


# ==============================================================================
# CONVENIENCE FUNCTIONS
# ==============================================================================


def initialize_mission_store(
    storage_type: str = "inmemory",
    enable_semantic_search: bool = False,
    postgres_connection_string: Optional[str] = None
) -> MissionStore:
    """
    Initialize Mission Store with configuration.

    Args:
        storage_type: "inmemory" or "postgres"
        enable_semantic_search: Enable embeddings for semantic search
        postgres_connection_string: PostgreSQL connection (if postgres)

    Returns:
        Initialized MissionStore instance

    Example:
        >>> store = initialize_mission_store(storage_type="inmemory")
    """
    config = StoreConfig(
        storage_type=storage_type,
        enable_semantic_search=enable_semantic_search,
        postgres_connection_string=postgres_connection_string
    )
    return MissionStore(config=config)
