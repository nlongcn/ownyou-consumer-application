"""
Complete Phase 1 Data Models for all mission card types.

This module defines Pydantic models for EVERY card type that will exist in the
OwnYou Consumer Application, even those not implemented until Phase 3+.

Card Categories:
- Savings: Shopping, Utility, Services
- Ikigai: Travel, Event, Restaurant, Recipe, Content
- Health: Diagnostic, Fitness

All models use Pydantic BaseModel for validation and serialization.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field


# ==============================================================================
# BASE MISSION CARD MODEL
# ==============================================================================

class MissionCard(BaseModel):
    """
    Base model for all mission cards in the OwnYou system.

    Every mission card (regardless of type) contains these common fields.
    The card_data field contains type-specific data using one of the CardData models.

    Fields:
        mission_id: Unique identifier for this mission
        user_id: User identifier who owns this mission
        thread_id: LangGraph thread ID for persistent conversation
        card_type: Type of card (shopping, travel, restaurant, etc.)
        category: High-level category (savings, ikigai, health)
        state: Current mission state (pending, active, completed, etc.)
        created_at: Timestamp when mission was created
        updated_at: Timestamp when mission was last updated
        card_data: Type-specific data for this card type
        priority: Priority level (1-10, higher = more important)
    """

    mission_id: str = Field(
        ...,
        description="Unique identifier for the mission",
        min_length=1
    )

    user_id: str = Field(
        ...,
        description="User identifier who owns this mission",
        min_length=1
    )

    thread_id: Optional[str] = Field(
        default=None,
        description="LangGraph thread ID for persistent conversation"
    )

    card_type: Literal[
        "shopping",
        "utility",
        "services",
        "travel",
        "event",
        "restaurant",
        "recipe",
        "content",
        "health"
    ] = Field(
        ...,
        description="Type of mission card"
    )

    category: Literal["savings", "ikigai", "health"] = Field(
        ...,
        description="High-level category for this mission"
    )

    state: Literal[
        "pending",
        "active",
        "snoozed",
        "completed",
        "dismissed"
    ] = Field(
        default="pending",
        description="Current state of the mission"
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when mission was created"
    )

    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when mission was last updated"
    )

    card_data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Type-specific card data (ShoppingCardData, TravelCardData, etc.)"
    )

    priority: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Priority level (1-10, higher = more important)"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "mission_id": "mission_abc123",
                "user_id": "user_123",
                "thread_id": "thread_456",
                "card_type": "shopping",
                "category": "savings",
                "state": "active",
                "priority": 5
            }
        }
    }


# ==============================================================================
# SAVINGS CATEGORY - CARD DATA MODELS
# ==============================================================================

class ShoppingCardData(BaseModel):
    """
    Card data for shopping/product deal missions.

    Used when mission agent finds product deals, price drops, or items matching
    user preferences from retailers.
    """

    product_name: str = Field(..., min_length=1, description="Product name")
    product_url: str = Field(..., min_length=1, description="URL to product page")
    image_url: str = Field(..., min_length=1, description="Product image URL")
    current_price: float = Field(..., gt=0, description="Current price in USD")
    original_price: Optional[float] = Field(None, gt=0, description="Original price if on sale")
    retailer_name: str = Field(..., min_length=1, description="Retailer name (e.g., Amazon, Target)")
    in_stock: bool = Field(True, description="Whether product is in stock")
    savings_amount: Optional[float] = Field(None, ge=0, description="Amount saved if on sale")


class UtilityCardData(BaseModel):
    """
    Card data for utility bill optimization missions.

    Used when mission agent finds cheaper energy, water, internet, or phone providers.
    """

    utility_type: Literal["energy", "water", "internet", "phone"] = Field(
        ...,
        description="Type of utility service"
    )
    current_provider: str = Field(..., min_length=1, description="Current service provider")
    current_cost: float = Field(..., gt=0, description="Current monthly cost in USD")
    recommended_provider: str = Field(..., min_length=1, description="Recommended new provider")
    recommended_cost: float = Field(..., gt=0, description="Recommended monthly cost in USD")
    savings_annual: float = Field(..., ge=0, description="Estimated annual savings in USD")
    switch_incentive: Optional[float] = Field(None, ge=0, description="One-time switching bonus/incentive")


class ServicesCardData(BaseModel):
    """
    Card data for financial services optimization missions.

    Used when mission agent finds better insurance, banking, or investment options.
    """

    service_type: Literal["insurance", "banking", "investment"] = Field(
        ...,
        description="Type of financial service"
    )
    current_provider: str = Field(..., min_length=1, description="Current service provider")
    current_terms: Dict[str, Any] = Field(..., description="Current service terms and features")
    recommended_provider: str = Field(..., min_length=1, description="Recommended new provider")
    recommended_terms: Dict[str, Any] = Field(..., description="Recommended service terms and features")
    savings_annual: float = Field(..., ge=0, description="Estimated annual savings in USD")


# ==============================================================================
# IKIGAI CATEGORY - CARD DATA MODELS
# ==============================================================================

class TravelCardData(BaseModel):
    """
    Card data for travel planning missions.

    Used when mission agent plans trips matching user's Ikigai interests.
    """

    destination: str = Field(..., min_length=1, description="Travel destination")
    destination_image_url: str = Field(..., min_length=1, description="Destination image URL")
    trip_dates: Optional[tuple[datetime, datetime]] = Field(None, description="Proposed trip dates (start, end)")
    hotel_options: List[Dict[str, Any]] = Field(default_factory=list, description="Hotel recommendations")
    flight_options: List[Dict[str, Any]] = Field(default_factory=list, description="Flight options")
    activities: List[Dict[str, Any]] = Field(default_factory=list, description="Recommended activities")
    estimated_cost: float = Field(..., gt=0, description="Total estimated trip cost in USD")
    alignment_score: float = Field(..., ge=0, le=1, description="How well trip matches Ikigai profile (0-1)")


class EventCardData(BaseModel):
    """
    Card data for event recommendation missions.

    Used when mission agent finds events matching user's interests (comedy, theater, sports, concerts).
    """

    event_type: Literal["comedy", "theater", "sports", "concert"] = Field(
        ...,
        description="Type of event"
    )
    event_name: str = Field(..., min_length=1, description="Name of the event")
    event_image_url: str = Field(..., min_length=1, description="Event image/poster URL")
    venue: str = Field(..., min_length=1, description="Venue name and location")
    event_date: datetime = Field(..., description="Date and time of event")
    ticket_options: List[Dict[str, Any]] = Field(default_factory=list, description="Available ticket options with pricing")
    artist_performer: str = Field(..., min_length=1, description="Main artist/performer/team")


class RestaurantCardData(BaseModel):
    """
    Card data for restaurant recommendation missions.

    Used when mission agent recommends dining options matching user preferences.
    """

    restaurant_name: str = Field(..., min_length=1, description="Restaurant name")
    restaurant_image_url: str = Field(..., min_length=1, description="Restaurant image URL")
    cuisine_type: str = Field(..., min_length=1, description="Type of cuisine")
    price_range: Literal["$", "$$", "$$$", "$$$$"] = Field(..., description="Price range indicator")
    rating: float = Field(..., ge=0, le=5, description="Average rating (0-5)")
    review_count: int = Field(..., ge=0, description="Number of reviews")
    distance_miles: float = Field(..., ge=0, description="Distance from user in miles")
    reservation_url: str = Field(..., min_length=1, description="URL to make reservation")
    menu_highlights: List[str] = Field(default_factory=list, max_length=10, description="Highlighted menu items")


class RecipeCardData(BaseModel):
    """
    Card data for recipe recommendation missions.

    Used when mission agent suggests recipes matching user's cooking preferences.
    """

    recipe_name: str = Field(..., min_length=1, description="Recipe name")
    recipe_image_url: str = Field(..., min_length=1, description="Recipe image URL")
    cuisine_type: str = Field(..., min_length=1, description="Type of cuisine")
    difficulty: Literal["easy", "medium", "hard"] = Field(..., description="Recipe difficulty level")
    prep_time_minutes: int = Field(..., gt=0, description="Preparation time in minutes")
    cook_time_minutes: int = Field(..., gt=0, description="Cooking time in minutes")
    servings: int = Field(..., gt=0, description="Number of servings")
    ingredients: List[str] = Field(..., min_length=1, description="List of ingredients")
    instructions_url: str = Field(..., min_length=1, description="URL to full recipe instructions")


class ContentCardData(BaseModel):
    """
    Card data for content recommendation missions.

    Used when mission agent recommends articles, videos, books, or podcasts matching interests.
    """

    content_type: Literal["article", "video", "book", "podcast"] = Field(
        ...,
        description="Type of content"
    )
    title: str = Field(..., min_length=1, description="Content title")
    thumbnail_url: str = Field(..., min_length=1, description="Content thumbnail/cover image URL")
    author_creator: str = Field(..., min_length=1, description="Author or creator name")
    description: str = Field(..., min_length=1, description="Brief description of content")
    content_url: str = Field(..., min_length=1, description="URL to access content")
    estimated_time_minutes: int = Field(..., gt=0, description="Estimated time to consume (minutes)")
    topics: List[str] = Field(default_factory=list, max_length=10, description="Content topics/tags")


# ==============================================================================
# HEALTH CATEGORY - CARD DATA MODELS
# ==============================================================================

class HealthCardData(BaseModel):
    """
    Card data for health and fitness missions.

    Used when mission agent creates diagnostic or fitness-related missions based on user data.
    """

    health_type: Literal["diagnostic", "fitness", "nutrition"] = Field(
        ...,
        description="Type of health mission"
    )
    title: str = Field(..., min_length=1, description="Health mission title")
    description: str = Field(..., min_length=1, description="Detailed description")
    action_items: List[str] = Field(..., min_length=1, description="Specific action items for user")
    resources: List[Dict[str, Any]] = Field(default_factory=list, description="Helpful resources (articles, videos, apps)")
    priority: Literal["high", "medium", "low"] = Field(..., description="Health priority level")


# ==============================================================================
# USER & SYSTEM MODELS
# ==============================================================================

class UserProfile(BaseModel):
    """
    Core user profile information.

    Created at signup, updated throughout user lifecycle.
    Stored in Store namespace: (user_id, "user_profile")
    """

    user_id: str = Field(..., min_length=1, description="Unique user identifier")
    wallet_address: str = Field(..., min_length=1, description="User's blockchain wallet address")
    display_name: Optional[str] = Field(default=None, description="User's display name")
    email: Optional[str] = Field(default=None, description="User's email (optional, for notifications)")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Account creation timestamp")
    last_login: datetime = Field(default_factory=datetime.utcnow, description="Last login timestamp")
    onboarding_completed: bool = Field(default=False, description="Whether user completed onboarding")
    preferences: Dict[str, Any] = Field(default_factory=dict, description="User preferences")


class WalletTransaction(BaseModel):
    """
    Token transaction record for user rewards and payments.

    Tracks all token movements in/out of user wallet.
    Stored in Store namespace: (user_id, "wallet_transactions")
    """

    transaction_id: str = Field(..., min_length=1, description="Unique transaction identifier")
    user_id: str = Field(..., min_length=1, description="User who owns this transaction")
    transaction_type: Literal["reward", "withdrawal", "purchase", "refund"] = Field(
        ...,
        description="Type of transaction"
    )
    amount: float = Field(..., description="Transaction amount (positive = credit, negative = debit)")
    token_symbol: str = Field(default="OWN", description="Token symbol (default: OWN)")
    description: str = Field(..., min_length=1, description="Human-readable description")
    related_mission_id: Optional[str] = Field(default=None, description="Mission ID if transaction from mission reward")
    blockchain_tx_hash: Optional[str] = Field(default=None, description="On-chain transaction hash")
    status: Literal["pending", "completed", "failed"] = Field(
        default="completed",
        description="Transaction status"
    )
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Transaction timestamp")


class Notification(BaseModel):
    """
    User notification for app events.

    Sent when missions created, data sources connected, rewards earned, etc.
    Stored in Store namespace: (user_id, "notifications")
    """

    notification_id: str = Field(..., min_length=1, description="Unique notification identifier")
    user_id: str = Field(..., min_length=1, description="User who receives this notification")
    notification_type: Literal[
        "mission_created",
        "mission_completed",
        "reward_earned",
        "data_source_connected",
        "data_source_error",
        "system_update"
    ] = Field(..., description="Type of notification")
    title: str = Field(..., min_length=1, description="Notification title")
    message: str = Field(..., min_length=1, description="Notification message body")
    related_mission_id: Optional[str] = Field(default=None, description="Related mission ID if applicable")
    related_data_source: Optional[str] = Field(default=None, description="Related data source if applicable")
    action_url: Optional[str] = Field(default=None, description="Deep link to relevant app screen")
    is_read: bool = Field(default=False, description="Whether user has read this notification")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Notification creation timestamp")


class DataSourceConnection(BaseModel):
    """
    Connection status for user data sources.

    Tracks which data sources (email, calendar, etc.) user has connected.
    Stored in Store namespace: (user_id, "data_source_connections")
    """

    user_id: str = Field(..., min_length=1, description="User who owns this connection")
    source_type: Literal[
        "email",
        "calendar",
        "financial",
        "location",
        "browser",
        "photos",
        "social",
        "health"
    ] = Field(..., description="Type of data source")
    source_name: str = Field(..., min_length=1, description="Specific source name (e.g., 'Gmail', 'Google Calendar')")
    status: Literal["connected", "disconnected", "error", "pending_auth"] = Field(
        ...,
        description="Connection status"
    )
    connected_at: Optional[datetime] = Field(default=None, description="When connection was established")
    last_sync: Optional[datetime] = Field(default=None, description="Last successful data sync")
    oauth_token_expiry: Optional[datetime] = Field(default=None, description="OAuth token expiration time")
    error_message: Optional[str] = Field(default=None, description="Error message if status=error")
    permissions: List[str] = Field(default_factory=list, description="Granted permissions (read, write, etc.)")
    sync_frequency: Literal["realtime", "hourly", "daily", "weekly"] = Field(
        default="daily",
        description="How often to sync this source"
    )
