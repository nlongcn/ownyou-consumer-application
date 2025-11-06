"""
Phase 1 Data Models - Complete schema for all card types.

This module defines Pydantic models for ALL mission card types, even those
not implemented until later phases. This enables clean contracts and parallel
development across Phase 2-7.
"""

from src.models.complete_schema import (
    MissionCard,
    ShoppingCardData,
    UtilityCardData,
    ServicesCardData,
    TravelCardData,
    EventCardData,
    RestaurantCardData,
    RecipeCardData,
    ContentCardData,
    HealthCardData,
)

__all__ = [
    "MissionCard",
    "ShoppingCardData",
    "UtilityCardData",
    "ServicesCardData",
    "TravelCardData",
    "EventCardData",
    "RestaurantCardData",
    "RecipeCardData",
    "ContentCardData",
    "HealthCardData",
]
