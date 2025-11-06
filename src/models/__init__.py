"""
Phase 1 Data Models - Complete schema for all card types and system models.

This module defines Pydantic models for:
- ALL mission card types (even those not implemented until later phases)
- All system models (user profiles, wallet, notifications, data connections)

This enables clean contracts and parallel development across Phase 2-7.
"""

from src.models.complete_schema import (
    # Mission Card Models
    MissionCard,
    # Card Data Models - Savings Category
    ShoppingCardData,
    UtilityCardData,
    ServicesCardData,
    # Card Data Models - Ikigai Category
    TravelCardData,
    EventCardData,
    RestaurantCardData,
    RecipeCardData,
    ContentCardData,
    # Card Data Models - Health Category
    HealthCardData,
    # System Models
    UserProfile,
    WalletTransaction,
    Notification,
    DataSourceConnection,
)

__all__ = [
    # Mission Card Models
    "MissionCard",
    # Card Data Models - Savings Category
    "ShoppingCardData",
    "UtilityCardData",
    "ServicesCardData",
    # Card Data Models - Ikigai Category
    "TravelCardData",
    "EventCardData",
    "RestaurantCardData",
    "RecipeCardData",
    "ContentCardData",
    # Card Data Models - Health Category
    "HealthCardData",
    # System Models
    "UserProfile",
    "WalletTransaction",
    "Notification",
    "DataSourceConnection",
]
