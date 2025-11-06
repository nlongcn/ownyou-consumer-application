"""
Tests for all CardData models (Savings, Ikigai, Health categories).

Tests validation for each card data type:
- Savings: Shopping, Utility, Services
- Ikigai: Travel, Event, Restaurant, Recipe, Content
- Health: Diagnostic, Fitness, Nutrition
"""

import pytest
from datetime import datetime
from pydantic import ValidationError


class TestSavingsCardDataModels:
    """Tests for Savings category card data models."""

    def test_shopping_card_data_valid(self):
        """Test valid ShoppingCardData instantiation."""
        from src.models.complete_schema import ShoppingCardData

        card_data = ShoppingCardData(
            product_name="Wireless Headphones",
            product_url="https://example.com/headphones",
            image_url="https://example.com/image.jpg",
            current_price=49.99,
            original_price=79.99,
            retailer_name="Amazon",
            in_stock=True,
            savings_amount=30.00
        )

        assert card_data.product_name == "Wireless Headphones"
        assert card_data.current_price == 49.99
        assert card_data.savings_amount == 30.00

    def test_utility_card_data_valid(self):
        """Test valid UtilityCardData instantiation."""
        from src.models.complete_schema import UtilityCardData

        card_data = UtilityCardData(
            utility_type="internet",
            current_provider="Comcast",
            current_cost=89.99,
            recommended_provider="Verizon Fios",
            recommended_cost=69.99,
            savings_annual=240.00
        )

        assert card_data.utility_type == "internet"
        assert card_data.savings_annual == 240.00

    def test_services_card_data_valid(self):
        """Test valid ServicesCardData instantiation."""
        from src.models.complete_schema import ServicesCardData

        card_data = ServicesCardData(
            service_type="insurance",
            current_provider="Geico",
            current_terms={"coverage": "full", "deductible": 500},
            recommended_provider="Progressive",
            recommended_terms={"coverage": "full", "deductible": 500},
            savings_annual=300.00
        )

        assert card_data.service_type == "insurance"
        assert card_data.savings_annual == 300.00


class TestIkigaiCardDataModels:
    """Tests for Ikigai category card data models."""

    def test_travel_card_data_valid(self):
        """Test valid TravelCardData instantiation."""
        from src.models.complete_schema import TravelCardData

        card_data = TravelCardData(
            destination="Paris, France",
            destination_image_url="https://example.com/paris.jpg",
            estimated_cost=2500.00,
            alignment_score=0.85,
            hotel_options=[{"name": "Hotel A", "price": 150}],
            activities=[{"name": "Eiffel Tower", "cost": 30}]
        )

        assert card_data.destination == "Paris, France"
        assert card_data.alignment_score == 0.85
        assert card_data.estimated_cost == 2500.00

    def test_event_card_data_valid(self):
        """Test valid EventCardData instantiation."""
        from src.models.complete_schema import EventCardData

        card_data = EventCardData(
            event_type="comedy",
            event_name="John Mulaney Live",
            event_image_url="https://example.com/event.jpg",
            venue="Madison Square Garden",
            event_date=datetime(2025, 6, 15, 20, 0),
            artist_performer="John Mulaney",
            ticket_options=[{"section": "Orchestra", "price": 75}]
        )

        assert card_data.event_type == "comedy"
        assert card_data.artist_performer == "John Mulaney"

    def test_restaurant_card_data_valid(self):
        """Test valid RestaurantCardData instantiation."""
        from src.models.complete_schema import RestaurantCardData

        card_data = RestaurantCardData(
            restaurant_name="Osteria Francescana",
            restaurant_image_url="https://example.com/restaurant.jpg",
            cuisine_type="Italian",
            price_range="$$$$",
            rating=4.8,
            review_count=523,
            distance_miles=2.5,
            reservation_url="https://example.com/reserve",
            menu_highlights=["Pasta", "Risotto"]
        )

        assert card_data.restaurant_name == "Osteria Francescana"
        assert card_data.rating == 4.8
        assert card_data.price_range == "$$$$"

    def test_recipe_card_data_valid(self):
        """Test valid RecipeCardData instantiation."""
        from src.models.complete_schema import RecipeCardData

        card_data = RecipeCardData(
            recipe_name="Homemade Pizza",
            recipe_image_url="https://example.com/pizza.jpg",
            cuisine_type="Italian",
            difficulty="medium",
            prep_time_minutes=30,
            cook_time_minutes=15,
            servings=4,
            ingredients=["flour", "water", "yeast", "tomatoes", "cheese"],
            instructions_url="https://example.com/recipe"
        )

        assert card_data.recipe_name == "Homemade Pizza"
        assert card_data.difficulty == "medium"
        assert len(card_data.ingredients) == 5

    def test_content_card_data_valid(self):
        """Test valid ContentCardData instantiation."""
        from src.models.complete_schema import ContentCardData

        card_data = ContentCardData(
            content_type="article",
            title="The Future of AI",
            thumbnail_url="https://example.com/thumbnail.jpg",
            author_creator="Jane Doe",
            description="An insightful article about AI trends",
            content_url="https://example.com/article",
            estimated_time_minutes=15,
            topics=["AI", "Technology", "Future"]
        )

        assert card_data.content_type == "article"
        assert card_data.estimated_time_minutes == 15
        assert len(card_data.topics) == 3


class TestHealthCardDataModels:
    """Tests for Health category card data models."""

    def test_health_card_data_valid(self):
        """Test valid HealthCardData instantiation."""
        from src.models.complete_schema import HealthCardData

        card_data = HealthCardData(
            health_type="fitness",
            title="Weekly Cardio Plan",
            description="A structured cardio workout plan",
            action_items=["Run 30 min", "Bike 45 min", "Swim 20 min"],
            resources=[{"type": "app", "name": "Nike Run Club"}],
            priority="high"
        )

        assert card_data.health_type == "fitness"
        assert card_data.priority == "high"
        assert len(card_data.action_items) == 3


class TestCardDataValidation:
    """Tests for validation constraints across all card data models."""

    def test_shopping_card_negative_price_rejected(self):
        """Test that negative prices are rejected."""
        from src.models.complete_schema import ShoppingCardData

        with pytest.raises(ValidationError):
            ShoppingCardData(
                product_name="Item",
                product_url="https://example.com",
                image_url="https://example.com/img.jpg",
                current_price=-10.00,  # Invalid
                retailer_name="Store"
            )

    def test_travel_alignment_score_bounds(self):
        """Test that alignment_score must be between 0 and 1."""
        from src.models.complete_schema import TravelCardData

        # Too high
        with pytest.raises(ValidationError):
            TravelCardData(
                destination="Tokyo",
                destination_image_url="https://example.com/tokyo.jpg",
                estimated_cost=3000.00,
                alignment_score=1.5  # Invalid
            )

        # Valid
        card_data = TravelCardData(
            destination="Tokyo",
            destination_image_url="https://example.com/tokyo.jpg",
            estimated_cost=3000.00,
            alignment_score=0.92  # Valid
        )
        assert card_data.alignment_score == 0.92

    def test_restaurant_rating_bounds(self):
        """Test that restaurant rating must be between 0 and 5."""
        from src.models.complete_schema import RestaurantCardData

        with pytest.raises(ValidationError):
            RestaurantCardData(
                restaurant_name="Test",
                restaurant_image_url="https://example.com/img.jpg",
                cuisine_type="American",
                price_range="$$",
                rating=6.0,  # Invalid
                review_count=100,
                distance_miles=1.0,
                reservation_url="https://example.com"
            )

    def test_recipe_empty_ingredients_rejected(self):
        """Test that recipes must have at least one ingredient."""
        from src.models.complete_schema import RecipeCardData

        with pytest.raises(ValidationError):
            RecipeCardData(
                recipe_name="Empty Recipe",
                recipe_image_url="https://example.com/img.jpg",
                cuisine_type="Test",
                difficulty="easy",
                prep_time_minutes=10,
                cook_time_minutes=5,
                servings=1,
                ingredients=[],  # Invalid - empty list
                instructions_url="https://example.com"
            )

    def test_health_empty_action_items_rejected(self):
        """Test that health cards must have at least one action item."""
        from src.models.complete_schema import HealthCardData

        with pytest.raises(ValidationError):
            HealthCardData(
                health_type="fitness",
                title="No Actions",
                description="Test",
                action_items=[],  # Invalid - empty list
                priority="low"
            )
