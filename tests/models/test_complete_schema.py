"""
Comprehensive tests for all Phase 1 data models.

Tests all mission card types, card data models, and system models
for proper validation, serialization, and field constraints.
"""

import pytest
from datetime import datetime
from pydantic import ValidationError

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
    UserProfile,
    WalletTransaction,
    Notification,
    DataSourceConnection,
)


# ==============================================================================
# MISSION CARD TESTS
# ==============================================================================


class TestMissionCard:
    """Test base MissionCard model validation."""

    def test_mission_card_valid_minimal(self):
        """Test MissionCard with minimal required fields."""
        card = MissionCard(
            mission_id="test_123",
            user_id="user_456",
            card_type="shopping",
            category="savings"
        )
        assert card.mission_id == "test_123"
        assert card.user_id == "user_456"
        assert card.card_type == "shopping"
        assert card.category == "savings"
        assert card.state == "pending"  # default
        assert card.priority == 5  # default
        assert card.thread_id is None
        assert card.card_data is None
        assert isinstance(card.created_at, datetime)
        assert isinstance(card.updated_at, datetime)

    def test_mission_card_valid_complete(self):
        """Test MissionCard with all fields populated."""
        card = MissionCard(
            mission_id="test_123",
            user_id="user_456",
            thread_id="thread_789",
            card_type="travel",
            category="ikigai",
            state="active",
            priority=8,
            card_data={"destination": "Paris"}
        )
        assert card.mission_id == "test_123"
        assert card.thread_id == "thread_789"
        assert card.state == "active"
        assert card.priority == 8
        assert card.card_data == {"destination": "Paris"}

    def test_mission_card_invalid_card_type(self):
        """Test MissionCard rejects invalid card_type."""
        with pytest.raises(ValidationError) as exc_info:
            MissionCard(
                mission_id="test_123",
                user_id="user_456",
                card_type="invalid_type",
                category="savings"
            )
        assert "card_type" in str(exc_info.value)

    def test_mission_card_invalid_category(self):
        """Test MissionCard rejects invalid category."""
        with pytest.raises(ValidationError) as exc_info:
            MissionCard(
                mission_id="test_123",
                user_id="user_456",
                card_type="shopping",
                category="invalid_category"
            )
        assert "category" in str(exc_info.value)

    def test_mission_card_invalid_state(self):
        """Test MissionCard rejects invalid state."""
        with pytest.raises(ValidationError) as exc_info:
            MissionCard(
                mission_id="test_123",
                user_id="user_456",
                card_type="shopping",
                category="savings",
                state="invalid_state"
            )
        assert "state" in str(exc_info.value)

    def test_mission_card_invalid_priority(self):
        """Test MissionCard rejects priority outside 1-10 range."""
        with pytest.raises(ValidationError):
            MissionCard(
                mission_id="test_123",
                user_id="user_456",
                card_type="shopping",
                category="savings",
                priority=11  # too high
            )

        with pytest.raises(ValidationError):
            MissionCard(
                mission_id="test_123",
                user_id="user_456",
                card_type="shopping",
                category="savings",
                priority=0  # too low
            )

    def test_mission_card_missing_required_fields(self):
        """Test MissionCard requires mission_id, user_id, card_type, category."""
        with pytest.raises(ValidationError) as exc_info:
            MissionCard()
        error_str = str(exc_info.value)
        assert "mission_id" in error_str
        assert "user_id" in error_str
        assert "card_type" in error_str
        assert "category" in error_str


# ==============================================================================
# SHOPPING CARD DATA TESTS
# ==============================================================================


class TestShoppingCardData:
    """Test ShoppingCardData model validation."""

    def test_shopping_card_data_valid(self):
        """Test ShoppingCardData with valid data."""
        data = ShoppingCardData(
            product_name="ASIC Running Shoes",
            product_url="https://example.com/product",
            image_url="https://example.com/image.jpg",
            current_price=89.99,
            original_price=120.00,
            retailer_name="Amazon",
            in_stock=True,
            savings_amount=30.01
        )
        assert data.product_name == "ASIC Running Shoes"
        assert data.current_price == 89.99
        assert data.original_price == 120.00
        assert data.savings_amount == 30.01
        assert data.in_stock is True

    def test_shopping_card_data_minimal(self):
        """Test ShoppingCardData with minimal required fields."""
        data = ShoppingCardData(
            product_name="Test Product",
            product_url="https://example.com/product",
            image_url="https://example.com/image.jpg",
            current_price=50.00,
            retailer_name="Test Retailer"
        )
        assert data.original_price is None
        assert data.savings_amount is None
        assert data.in_stock is True  # default

    def test_shopping_card_data_invalid_price(self):
        """Test ShoppingCardData rejects non-positive prices."""
        with pytest.raises(ValidationError):
            ShoppingCardData(
                product_name="Test",
                product_url="https://example.com",
                image_url="https://example.com/image.jpg",
                current_price=0,  # must be > 0
                retailer_name="Test"
            )


# ==============================================================================
# UTILITY CARD DATA TESTS
# ==============================================================================


class TestUtilityCardData:
    """Test UtilityCardData model validation."""

    def test_utility_card_data_valid(self):
        """Test UtilityCardData with valid data."""
        data = UtilityCardData(
            utility_type="energy",
            current_provider="British Gas",
            current_cost=100.00,
            recommended_provider="Octopus Energy",
            recommended_cost=85.00,
            savings_annual=180.00,
            switch_incentive=50.00
        )
        assert data.utility_type == "energy"
        assert data.current_cost == 100.00
        assert data.savings_annual == 180.00

    def test_utility_card_data_invalid_type(self):
        """Test UtilityCardData rejects invalid utility_type."""
        with pytest.raises(ValidationError):
            UtilityCardData(
                utility_type="cable_tv",  # not in allowed types
                current_provider="Provider",
                current_cost=50.00,
                recommended_provider="New Provider",
                recommended_cost=40.00,
                savings_annual=120.00
            )


# ==============================================================================
# SERVICES CARD DATA TESTS
# ==============================================================================


class TestServicesCardData:
    """Test ServicesCardData model validation."""

    def test_services_card_data_valid(self):
        """Test ServicesCardData with valid data."""
        data = ServicesCardData(
            service_type="insurance",
            current_provider="Aviva",
            current_terms={"coverage": "comprehensive", "excess": 250},
            recommended_provider="Churchill",
            recommended_terms={"coverage": "comprehensive", "excess": 150},
            savings_annual=200.00
        )
        assert data.service_type == "insurance"
        assert data.savings_annual == 200.00
        assert data.current_terms["excess"] == 250

    def test_services_card_data_invalid_service_type(self):
        """Test ServicesCardData rejects invalid service_type."""
        with pytest.raises(ValidationError):
            ServicesCardData(
                service_type="mobile_phone",  # not in allowed types
                current_provider="Provider",
                current_terms={},
                recommended_provider="New Provider",
                recommended_terms={},
                savings_annual=100.00
            )


# ==============================================================================
# TRAVEL CARD DATA TESTS
# ==============================================================================


class TestTravelCardData:
    """Test TravelCardData model validation."""

    def test_travel_card_data_valid(self):
        """Test TravelCardData with valid data."""
        data = TravelCardData(
            destination="Paris, France",
            destination_image_url="https://example.com/paris.jpg",
            trip_dates=(datetime(2025, 6, 1), datetime(2025, 6, 7)),
            hotel_options=[{"name": "Hotel A", "price": 150}],
            flight_options=[{"airline": "BA", "price": 200}],
            activities=[{"name": "Eiffel Tower", "price": 20}],
            estimated_cost=1500.00,
            alignment_score=0.95
        )
        assert data.destination == "Paris, France"
        assert data.estimated_cost == 1500.00
        assert data.alignment_score == 0.95
        assert len(data.hotel_options) == 1

    def test_travel_card_data_alignment_score_range(self):
        """Test TravelCardData validates alignment_score between 0-1."""
        with pytest.raises(ValidationError):
            TravelCardData(
                destination="Test",
                destination_image_url="https://example.com/test.jpg",
                estimated_cost=1000.00,
                alignment_score=1.5  # must be <= 1
            )


# ==============================================================================
# EVENT CARD DATA TESTS
# ==============================================================================


class TestEventCardData:
    """Test EventCardData model validation."""

    def test_event_card_data_valid(self):
        """Test EventCardData with valid data."""
        data = EventCardData(
            event_type="comedy",
            event_name="Comedy Night Live",
            event_image_url="https://example.com/event.jpg",
            venue="Comedy Store, London",
            event_date=datetime(2025, 7, 15, 20, 0),
            ticket_options=[{"type": "standard", "price": 25.00}],
            artist_performer="John Bishop"
        )
        assert data.event_type == "comedy"
        assert data.event_name == "Comedy Night Live"
        assert data.artist_performer == "John Bishop"

    def test_event_card_data_invalid_event_type(self):
        """Test EventCardData rejects invalid event_type."""
        with pytest.raises(ValidationError):
            EventCardData(
                event_type="circus",  # not in allowed types
                event_name="Test",
                event_image_url="https://example.com/test.jpg",
                venue="Test Venue",
                event_date=datetime.now(),
                artist_performer="Test Artist"
            )


# ==============================================================================
# RESTAURANT CARD DATA TESTS
# ==============================================================================


class TestRestaurantCardData:
    """Test RestaurantCardData model validation."""

    def test_restaurant_card_data_valid(self):
        """Test RestaurantCardData with valid data."""
        data = RestaurantCardData(
            restaurant_name="The Italian Place",
            restaurant_image_url="https://example.com/restaurant.jpg",
            cuisine_type="Italian",
            price_range="$$",
            rating=4.5,
            review_count=250,
            distance_miles=1.2,
            reservation_url="https://example.com/book",
            menu_highlights=["Pasta Carbonara", "Tiramisu"]
        )
        assert data.restaurant_name == "The Italian Place"
        assert data.rating == 4.5
        assert data.price_range == "$$"
        assert len(data.menu_highlights) == 2

    def test_restaurant_card_data_invalid_price_range(self):
        """Test RestaurantCardData rejects invalid price_range."""
        with pytest.raises(ValidationError):
            RestaurantCardData(
                restaurant_name="Test",
                restaurant_image_url="https://example.com/test.jpg",
                cuisine_type="Test",
                price_range="Expensive",  # must be $, $$, $$$, or $$$$
                rating=4.0,
                review_count=100,
                distance_miles=1.0,
                reservation_url="https://example.com/book"
            )

    def test_restaurant_card_data_rating_range(self):
        """Test RestaurantCardData validates rating between 0-5."""
        with pytest.raises(ValidationError):
            RestaurantCardData(
                restaurant_name="Test",
                restaurant_image_url="https://example.com/test.jpg",
                cuisine_type="Test",
                price_range="$$",
                rating=6.0,  # must be <= 5
                review_count=100,
                distance_miles=1.0,
                reservation_url="https://example.com/book"
            )


# ==============================================================================
# RECIPE CARD DATA TESTS
# ==============================================================================


class TestRecipeCardData:
    """Test RecipeCardData model validation."""

    def test_recipe_card_data_valid(self):
        """Test RecipeCardData with valid data."""
        data = RecipeCardData(
            recipe_name="Pasta Carbonara",
            recipe_image_url="https://example.com/recipe.jpg",
            cuisine_type="Italian",
            difficulty="medium",
            prep_time_minutes=15,
            cook_time_minutes=20,
            servings=4,
            ingredients=["pasta", "eggs", "bacon", "parmesan"],
            instructions_url="https://example.com/recipe/carbonara"
        )
        assert data.recipe_name == "Pasta Carbonara"
        assert data.difficulty == "medium"
        assert len(data.ingredients) == 4

    def test_recipe_card_data_invalid_difficulty(self):
        """Test RecipeCardData rejects invalid difficulty."""
        with pytest.raises(ValidationError):
            RecipeCardData(
                recipe_name="Test",
                recipe_image_url="https://example.com/test.jpg",
                cuisine_type="Test",
                difficulty="expert",  # not in allowed values
                prep_time_minutes=10,
                cook_time_minutes=20,
                servings=2,
                ingredients=["test"],
                instructions_url="https://example.com/test"
            )


# ==============================================================================
# CONTENT CARD DATA TESTS
# ==============================================================================


class TestContentCardData:
    """Test ContentCardData model validation."""

    def test_content_card_data_valid(self):
        """Test ContentCardData with valid data."""
        data = ContentCardData(
            content_type="article",
            title="The Future of AI",
            thumbnail_url="https://example.com/thumbnail.jpg",
            author_creator="Jane Doe",
            description="An in-depth look at AI trends",
            content_url="https://example.com/article",
            estimated_time_minutes=15,
            topics=["AI", "Technology", "Future"]
        )
        assert data.content_type == "article"
        assert data.title == "The Future of AI"
        assert len(data.topics) == 3

    def test_content_card_data_invalid_content_type(self):
        """Test ContentCardData rejects invalid content_type."""
        with pytest.raises(ValidationError):
            ContentCardData(
                content_type="blog",  # not in allowed types
                title="Test",
                thumbnail_url="https://example.com/test.jpg",
                author_creator="Test",
                description="Test",
                content_url="https://example.com/test",
                estimated_time_minutes=10
            )


# ==============================================================================
# HEALTH CARD DATA TESTS
# ==============================================================================


class TestHealthCardData:
    """Test HealthCardData model validation."""

    def test_health_card_data_valid(self):
        """Test HealthCardData with valid data."""
        data = HealthCardData(
            health_type="fitness",
            title="30-Day Running Challenge",
            description="Build your running habit",
            action_items=["Run 5K 3x per week", "Track progress", "Stay hydrated"],
            resources=[{"type": "app", "name": "Strava"}],
            priority="high"
        )
        assert data.health_type == "fitness"
        assert data.title == "30-Day Running Challenge"
        assert len(data.action_items) == 3
        assert data.priority == "high"

    def test_health_card_data_invalid_health_type(self):
        """Test HealthCardData rejects invalid health_type."""
        with pytest.raises(ValidationError):
            HealthCardData(
                health_type="mental_health",  # not in allowed types
                title="Test",
                description="Test",
                action_items=["Test"],
                priority="medium"
            )

    def test_health_card_data_invalid_priority(self):
        """Test HealthCardData rejects invalid priority."""
        with pytest.raises(ValidationError):
            HealthCardData(
                health_type="fitness",
                title="Test",
                description="Test",
                action_items=["Test"],
                priority="critical"  # not in allowed values
            )


# ==============================================================================
# USER PROFILE TESTS
# ==============================================================================


class TestUserProfile:
    """Test UserProfile model validation."""

    def test_user_profile_valid_minimal(self):
        """Test UserProfile with minimal required fields."""
        profile = UserProfile(
            user_id="user_123",
            wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1"
        )
        assert profile.user_id == "user_123"
        # Wallet address is normalized to lowercase
        assert profile.wallet_address == "0x742d35cc6634c0532925a3b844bc9e7595f0beb1"
        assert profile.display_name is None
        assert profile.email is None
        assert profile.onboarding_completed is False
        assert isinstance(profile.created_at, datetime)
        assert isinstance(profile.last_login, datetime)
        assert profile.preferences == {}

    def test_user_profile_valid_complete(self):
        """Test UserProfile with all fields populated."""
        profile = UserProfile(
            user_id="user_123",
            wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
            display_name="John Doe",
            email="john@example.com",
            onboarding_completed=True,
            preferences={"theme": "dark", "notifications": True}
        )
        assert profile.display_name == "John Doe"
        assert profile.email == "john@example.com"
        assert profile.onboarding_completed is True
        assert profile.preferences["theme"] == "dark"

    def test_user_profile_missing_required_fields(self):
        """Test UserProfile requires user_id and wallet_address."""
        with pytest.raises(ValidationError) as exc_info:
            UserProfile()
        error_str = str(exc_info.value)
        assert "user_id" in error_str
        assert "wallet_address" in error_str


# ==============================================================================
# WALLET TRANSACTION TESTS
# ==============================================================================


class TestWalletTransaction:
    """Test WalletTransaction model validation."""

    def test_wallet_transaction_valid(self):
        """Test WalletTransaction with valid data."""
        tx = WalletTransaction(
            transaction_id="tx_123",
            user_id="user_456",
            transaction_type="reward",
            amount=50.00,
            description="Mission completion reward",
            related_mission_id="mission_789",
            blockchain_tx_hash="0xabcdef123456"
        )
        assert tx.transaction_id == "tx_123"
        assert tx.transaction_type == "reward"
        assert tx.amount == 50.00
        assert tx.token_symbol == "OWN"  # default
        assert tx.status == "completed"  # default

    def test_wallet_transaction_negative_amount(self):
        """Test WalletTransaction allows negative amounts for debits."""
        tx = WalletTransaction(
            transaction_id="tx_123",
            user_id="user_456",
            transaction_type="withdrawal",
            amount=-25.00,
            description="Token withdrawal"
        )
        assert tx.amount == -25.00

    def test_wallet_transaction_invalid_type(self):
        """Test WalletTransaction rejects invalid transaction_type."""
        with pytest.raises(ValidationError):
            WalletTransaction(
                transaction_id="tx_123",
                user_id="user_456",
                transaction_type="deposit",  # not in allowed types
                amount=50.00,
                description="Test"
            )

    def test_wallet_transaction_invalid_status(self):
        """Test WalletTransaction rejects invalid status."""
        with pytest.raises(ValidationError):
            WalletTransaction(
                transaction_id="tx_123",
                user_id="user_456",
                transaction_type="reward",
                amount=50.00,
                description="Test",
                status="cancelled"  # not in allowed values
            )


# ==============================================================================
# NOTIFICATION TESTS
# ==============================================================================


class TestNotification:
    """Test Notification model validation."""

    def test_notification_valid(self):
        """Test Notification with valid data."""
        notif = Notification(
            notification_id="notif_123",
            user_id="user_456",
            notification_type="mission_created",
            title="New Shopping Mission",
            message="We found a great deal on running shoes!"
        )
        assert notif.notification_id == "notif_123"
        assert notif.notification_type == "mission_created"
        assert notif.is_read is False  # default
        assert isinstance(notif.created_at, datetime)

    def test_notification_with_optional_fields(self):
        """Test Notification with optional fields."""
        notif = Notification(
            notification_id="notif_123",
            user_id="user_456",
            notification_type="mission_completed",
            title="Mission Complete",
            message="You completed a mission!",
            related_mission_id="mission_789",
            action_url="/missions/mission_789",
            is_read=True
        )
        assert notif.related_mission_id == "mission_789"
        assert notif.action_url == "/missions/mission_789"
        assert notif.is_read is True

    def test_notification_invalid_type(self):
        """Test Notification rejects invalid notification_type."""
        with pytest.raises(ValidationError):
            Notification(
                notification_id="notif_123",
                user_id="user_456",
                notification_type="password_reset",  # not in allowed types
                title="Test",
                message="Test"
            )


# ==============================================================================
# DATA SOURCE CONNECTION TESTS
# ==============================================================================


class TestDataSourceConnection:
    """Test DataSourceConnection model validation."""

    def test_data_source_connection_valid(self):
        """Test DataSourceConnection with valid data."""
        conn = DataSourceConnection(
            user_id="user_123",
            source_type="email",
            source_name="Gmail",
            status="connected",
            connected_at=datetime(2025, 1, 1),
            last_sync=datetime(2025, 1, 5),
            permissions=["read"],
            sync_frequency="daily"
        )
        assert conn.user_id == "user_123"
        assert conn.source_type == "email"
        assert conn.status == "connected"
        assert conn.sync_frequency == "daily"
        assert "read" in conn.permissions

    def test_data_source_connection_error_state(self):
        """Test DataSourceConnection with error status."""
        conn = DataSourceConnection(
            user_id="user_123",
            source_type="calendar",
            source_name="Google Calendar",
            status="error",
            error_message="OAuth token expired"
        )
        assert conn.status == "error"
        assert conn.error_message == "OAuth token expired"

    def test_data_source_connection_invalid_source_type(self):
        """Test DataSourceConnection rejects invalid source_type."""
        with pytest.raises(ValidationError):
            DataSourceConnection(
                user_id="user_123",
                source_type="messaging",  # not in allowed types
                source_name="WhatsApp",
                status="connected"
            )

    def test_data_source_connection_invalid_status(self):
        """Test DataSourceConnection rejects invalid status."""
        with pytest.raises(ValidationError):
            DataSourceConnection(
                user_id="user_123",
                source_type="email",
                source_name="Gmail",
                status="connecting"  # not in allowed values
            )

    def test_data_source_connection_invalid_sync_frequency(self):
        """Test DataSourceConnection rejects invalid sync_frequency."""
        with pytest.raises(ValidationError):
            DataSourceConnection(
                user_id="user_123",
                source_type="email",
                source_name="Gmail",
                status="connected",
                sync_frequency="every_minute"  # not in allowed values
            )


# ==============================================================================
# SERIALIZATION TESTS
# ==============================================================================


class TestSerialization:
    """Test model serialization and deserialization."""

    def test_mission_card_serialization(self):
        """Test MissionCard can be serialized to dict and back."""
        card = MissionCard(
            mission_id="test_123",
            user_id="user_456",
            card_type="shopping",
            category="savings"
        )
        card_dict = card.model_dump()
        assert card_dict["mission_id"] == "test_123"

        # Reconstruct from dict
        card_restored = MissionCard(**card_dict)
        assert card_restored.mission_id == card.mission_id
        assert card_restored.user_id == card.user_id

    def test_shopping_card_data_serialization(self):
        """Test ShoppingCardData can be serialized to dict and back."""
        data = ShoppingCardData(
            product_name="Test Product",
            product_url="https://example.com/product",
            image_url="https://example.com/image.jpg",
            current_price=50.00,
            retailer_name="Test Retailer"
        )
        data_dict = data.model_dump()

        # Reconstruct from dict
        data_restored = ShoppingCardData(**data_dict)
        assert data_restored.product_name == data.product_name
        assert data_restored.current_price == data.current_price

    def test_user_profile_serialization(self):
        """Test UserProfile can be serialized to JSON and back."""
        profile = UserProfile(
            user_id="user_123",
            wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
            preferences={"theme": "dark"}
        )
        json_str = profile.model_dump_json()

        # Reconstruct from JSON
        profile_restored = UserProfile.model_validate_json(json_str)
        assert profile_restored.user_id == profile.user_id
        assert profile_restored.preferences == profile.preferences
