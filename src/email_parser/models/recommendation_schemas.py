"""
Category-Specific Data Models and Schemas

Defines specific data structures for each recommendation category
to provide typed interfaces and validation.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from datetime import datetime

# Shopping Category Models

class PriceRange(Enum):
    """Price sensitivity categories."""
    BUDGET = "budget"
    MODERATE = "moderate"
    PREMIUM = "premium"
    LUXURY = "luxury"


class PurchaseIntent(Enum):
    """Purchase intention levels."""
    IMMEDIATE = "immediate"
    PLANNED = "planned"
    RESEARCH = "research"
    BROWSING = "browsing"


@dataclass
class ProductPreference:
    """Product category preference."""
    category: str
    subcategories: List[str] = field(default_factory=list)
    preference_strength: float = 0.0  # 0.0 to 1.0
    price_range: Optional[PriceRange] = None
    brand_preferences: List[str] = field(default_factory=list)
    purchase_frequency: str = "unknown"  # daily, weekly, monthly, occasional, rare


@dataclass
class ShoppingProfile:
    """Shopping behavior profile."""
    product_preferences: List[ProductPreference] = field(default_factory=list)
    price_sensitivity: PriceRange = PriceRange.MODERATE
    purchase_timing: List[str] = field(default_factory=list)  # seasonal, planned, impulse
    preferred_channels: List[str] = field(default_factory=list)  # online, in-store, mobile
    research_behavior: Dict[str, Any] = field(default_factory=dict)
    loyalty_indicators: Dict[str, float] = field(default_factory=dict)


# Travel Category Models

class TravelStyle(Enum):
    """Travel style preferences."""
    LUXURY = "luxury"
    COMFORT = "comfort"
    BUDGET = "budget"
    ADVENTURE = "adventure"
    BUSINESS = "business"
    FAMILY = "family"
    SOLO = "solo"
    ROMANTIC = "romantic"


class TripDuration(Enum):
    """Typical trip duration preferences."""
    WEEKEND = "weekend"
    SHORT_BREAK = "short_break"  # 3-5 days
    WEEK_LONG = "week_long"
    EXTENDED = "extended"  # 2+ weeks


@dataclass
class DestinationPreference:
    """Travel destination preference."""
    region: str
    countries: List[str] = field(default_factory=list)
    climate_preference: str = "any"  # tropical, temperate, cold, varied
    activity_focus: List[str] = field(default_factory=list)  # culture, nature, food, adventure
    preference_strength: float = 0.0


@dataclass
class TravelProfile:
    """Travel behavior profile."""
    destination_preferences: List[DestinationPreference] = field(default_factory=list)
    travel_style: List[TravelStyle] = field(default_factory=list)
    trip_duration_preference: List[TripDuration] = field(default_factory=list)
    booking_patterns: Dict[str, Any] = field(default_factory=dict)
    seasonal_preferences: Dict[str, List[str]] = field(default_factory=dict)
    travel_frequency: str = "unknown"
    accommodation_preferences: List[str] = field(default_factory=list)


# Entertainment Category Models

class EntertainmentType(Enum):
    """Types of entertainment."""
    FILM = "film"
    TELEVISION = "television"
    THEATER = "theater"
    CONCERTS = "concerts"
    COMEDY = "comedy"
    SPORTS = "sports"
    GAMING = "gaming"
    BOOKS = "books"
    PODCASTS = "podcasts"
    MUSEUMS = "museums"


class SocialPreference(Enum):
    """Social context preferences."""
    SOCIAL = "social"
    SOLO = "solo"
    FAMILY = "family"
    ROMANTIC = "romantic"
    MIXED = "mixed"


@dataclass
class EntertainmentPreference:
    """Entertainment category preference."""
    entertainment_type: EntertainmentType
    genres: List[str] = field(default_factory=list)
    preference_strength: float = 0.0
    social_preference: SocialPreference = SocialPreference.MIXED
    frequency: str = "unknown"  # daily, weekly, monthly, occasional
    platform_preferences: List[str] = field(default_factory=list)


@dataclass
class EntertainmentProfile:
    """Entertainment behavior profile."""
    entertainment_preferences: List[EntertainmentPreference] = field(default_factory=list)
    content_consumption_patterns: Dict[str, Any] = field(default_factory=dict)
    event_attendance_patterns: Dict[str, Any] = field(default_factory=dict)
    subscription_services: List[str] = field(default_factory=list)
    discovery_methods: List[str] = field(default_factory=list)
    time_preferences: Dict[str, List[str]] = field(default_factory=dict)  # weekend, evening, etc.


# Health Category Models

class HealthFocus(Enum):
    """Health and wellness focus areas."""
    FITNESS = "fitness"
    NUTRITION = "nutrition"
    MENTAL_HEALTH = "mental_health"
    PREVENTIVE_CARE = "preventive_care"
    CHRONIC_CONDITION = "chronic_condition"
    WELLNESS = "wellness"
    BEAUTY = "beauty"
    SLEEP = "sleep"


class ActivityLevel(Enum):
    """Physical activity levels."""
    SEDENTARY = "sedentary"
    LIGHT = "light"
    MODERATE = "moderate"
    ACTIVE = "active"
    VERY_ACTIVE = "very_active"


@dataclass
class HealthPreference:
    """Health and wellness preference."""
    focus_area: HealthFocus
    specific_interests: List[str] = field(default_factory=list)
    preference_strength: float = 0.0
    activity_level: Optional[ActivityLevel] = None
    approach: str = "unknown"  # holistic, medical, natural, technology-based


@dataclass
class HealthProfile:
    """Health and wellness behavior profile."""
    health_preferences: List[HealthPreference] = field(default_factory=list)
    fitness_patterns: Dict[str, Any] = field(default_factory=dict)
    nutrition_patterns: Dict[str, Any] = field(default_factory=dict)
    wellness_activities: List[str] = field(default_factory=list)
    health_services: List[str] = field(default_factory=list)
    tracking_behavior: Dict[str, Any] = field(default_factory=dict)


# Restaurant Category Models

class CuisineType(Enum):
    """Major cuisine categories."""
    AMERICAN = "american"
    ASIAN = "asian"
    EUROPEAN = "european"
    MEDITERRANEAN = "mediterranean"
    LATIN_AMERICAN = "latin_american"
    MIDDLE_EASTERN = "middle_eastern"
    AFRICAN = "african"
    FUSION = "fusion"
    VEGETARIAN = "vegetarian"
    SEAFOOD = "seafood"


class DiningOccasion(Enum):
    """Dining occasion types."""
    CASUAL = "casual"
    BUSINESS = "business"
    ROMANTIC = "romantic"
    FAMILY = "family"
    CELEBRATION = "celebration"
    QUICK_MEAL = "quick_meal"
    FINE_DINING = "fine_dining"


@dataclass
class CuisinePreference:
    """Cuisine preference details."""
    cuisine_type: CuisineType
    specific_cuisines: List[str] = field(default_factory=list)
    preference_strength: float = 0.0
    price_tolerance: PriceRange = PriceRange.MODERATE
    spice_preference: str = "unknown"  # mild, medium, spicy, very_spicy


@dataclass
class RestaurantProfile:
    """Restaurant and dining behavior profile."""
    cuisine_preferences: List[CuisinePreference] = field(default_factory=list)
    dining_occasions: List[DiningOccasion] = field(default_factory=list)
    service_preferences: List[str] = field(default_factory=list)  # dine-in, takeout, delivery
    discovery_methods: List[str] = field(default_factory=list)
    price_sensitivity: PriceRange = PriceRange.MODERATE
    dietary_restrictions: List[str] = field(default_factory=list)
    location_preferences: Dict[str, Any] = field(default_factory=dict)


# Recipe Category Models

class CookingSkill(Enum):
    """Cooking skill levels."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    PROFESSIONAL = "professional"


class RecipeComplexity(Enum):
    """Recipe complexity preferences."""
    SIMPLE = "simple"  # 15-30 minutes, few ingredients
    MODERATE = "moderate"  # 30-60 minutes, moderate prep
    COMPLEX = "complex"  # 1+ hours, extensive prep
    GOURMET = "gourmet"  # Advanced techniques, specialty ingredients


class MealType(Enum):
    """Types of meals."""
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACKS = "snacks"
    DESSERTS = "desserts"
    BEVERAGES = "beverages"
    APPETIZERS = "appetizers"


@dataclass
class CookingPreference:
    """Cooking and recipe preference."""
    cuisine_style: str
    complexity_preference: RecipeComplexity = RecipeComplexity.MODERATE
    meal_types: List[MealType] = field(default_factory=list)
    cooking_methods: List[str] = field(default_factory=list)  # baking, grilling, stir-fry, etc.
    preference_strength: float = 0.0


@dataclass
class RecipeProfile:
    """Cooking and recipe behavior profile."""
    cooking_preferences: List[CookingPreference] = field(default_factory=list)
    skill_level: CookingSkill = CookingSkill.INTERMEDIATE
    dietary_preferences: List[str] = field(default_factory=list)
    cooking_frequency: str = "unknown"  # daily, several_times_week, weekly, occasional
    ingredient_preferences: Dict[str, Any] = field(default_factory=dict)
    equipment_available: List[str] = field(default_factory=list)
    time_constraints: Dict[str, Any] = field(default_factory=dict)
    learning_interests: List[str] = field(default_factory=list)


# Unified Category Profile Container

@dataclass
class CategorySpecificProfiles:
    """Container for all category-specific profiles."""
    shopping: Optional[ShoppingProfile] = None
    travel: Optional[TravelProfile] = None
    entertainment: Optional[EntertainmentProfile] = None
    health: Optional[HealthProfile] = None
    restaurants: Optional[RestaurantProfile] = None
    recipes: Optional[RecipeProfile] = None

    def get_profile(self, category: str) -> Optional[Union[
        ShoppingProfile, TravelProfile, EntertainmentProfile,
        HealthProfile, RestaurantProfile, RecipeProfile
    ]]:
        """Get profile for specific category."""
        return getattr(self, category, None)

    def set_profile(self, category: str, profile: Union[
        ShoppingProfile, TravelProfile, EntertainmentProfile,
        HealthProfile, RestaurantProfile, RecipeProfile
    ]) -> None:
        """Set profile for specific category."""
        setattr(self, category, profile)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        result = {}
        for category in ['shopping', 'travel', 'entertainment', 'health', 'restaurants', 'recipes']:
            profile = getattr(self, category, None)
            if profile:
                # Convert dataclass to dict
                result[category] = self._dataclass_to_dict(profile)
        return result

    def _dataclass_to_dict(self, obj: Any) -> Dict[str, Any]:
        """Convert dataclass to dictionary recursively."""
        if hasattr(obj, '__dataclass_fields__'):
            result = {}
            for field_name, field_def in obj.__dataclass_fields__.items():
                value = getattr(obj, field_name)
                if value is None:
                    continue
                elif isinstance(value, list):
                    result[field_name] = [self._dataclass_to_dict(item) for item in value]
                elif isinstance(value, dict):
                    result[field_name] = {
                        k: self._dataclass_to_dict(v) for k, v in value.items()
                    }
                elif hasattr(value, '__dataclass_fields__'):
                    result[field_name] = self._dataclass_to_dict(value)
                elif isinstance(value, Enum):
                    result[field_name] = value.value
                else:
                    result[field_name] = value
            return result
        else:
            return obj

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CategorySpecificProfiles':
        """Create from dictionary."""
        profiles = cls()

        # Shopping profile
        if 'shopping' in data:
            shopping_data = data['shopping']
            product_prefs = []
            for pref_data in shopping_data.get('product_preferences', []):
                product_prefs.append(ProductPreference(
                    category=pref_data['category'],
                    subcategories=pref_data.get('subcategories', []),
                    preference_strength=pref_data.get('preference_strength', 0.0),
                    price_range=PriceRange(pref_data['price_range']) if pref_data.get('price_range') else None,
                    brand_preferences=pref_data.get('brand_preferences', []),
                    purchase_frequency=pref_data.get('purchase_frequency', 'unknown')
                ))

            profiles.shopping = ShoppingProfile(
                product_preferences=product_prefs,
                price_sensitivity=PriceRange(shopping_data.get('price_sensitivity', 'moderate')),
                purchase_timing=shopping_data.get('purchase_timing', []),
                preferred_channels=shopping_data.get('preferred_channels', []),
                research_behavior=shopping_data.get('research_behavior', {}),
                loyalty_indicators=shopping_data.get('loyalty_indicators', {})
            )

        # Travel profile
        if 'travel' in data:
            travel_data = data['travel']
            dest_prefs = []
            for dest_data in travel_data.get('destination_preferences', []):
                dest_prefs.append(DestinationPreference(
                    region=dest_data['region'],
                    countries=dest_data.get('countries', []),
                    climate_preference=dest_data.get('climate_preference', 'any'),
                    activity_focus=dest_data.get('activity_focus', []),
                    preference_strength=dest_data.get('preference_strength', 0.0)
                ))

            profiles.travel = TravelProfile(
                destination_preferences=dest_prefs,
                travel_style=[TravelStyle(style) for style in travel_data.get('travel_style', [])],
                trip_duration_preference=[TripDuration(dur) for dur in travel_data.get('trip_duration_preference', [])],
                booking_patterns=travel_data.get('booking_patterns', {}),
                seasonal_preferences=travel_data.get('seasonal_preferences', {}),
                travel_frequency=travel_data.get('travel_frequency', 'unknown'),
                accommodation_preferences=travel_data.get('accommodation_preferences', [])
            )

        # Entertainment profile
        if 'entertainment' in data:
            ent_data = data['entertainment']
            ent_prefs = []
            for pref_data in ent_data.get('entertainment_preferences', []):
                ent_prefs.append(EntertainmentPreference(
                    entertainment_type=EntertainmentType(pref_data['entertainment_type']),
                    genres=pref_data.get('genres', []),
                    preference_strength=pref_data.get('preference_strength', 0.0),
                    social_preference=SocialPreference(pref_data.get('social_preference', 'mixed')),
                    frequency=pref_data.get('frequency', 'unknown'),
                    platform_preferences=pref_data.get('platform_preferences', [])
                ))

            profiles.entertainment = EntertainmentProfile(
                entertainment_preferences=ent_prefs,
                content_consumption_patterns=ent_data.get('content_consumption_patterns', {}),
                event_attendance_patterns=ent_data.get('event_attendance_patterns', {}),
                subscription_services=ent_data.get('subscription_services', []),
                discovery_methods=ent_data.get('discovery_methods', []),
                time_preferences=ent_data.get('time_preferences', {})
            )

        # Health profile
        if 'health' in data:
            health_data = data['health']
            health_prefs = []
            for pref_data in health_data.get('health_preferences', []):
                health_prefs.append(HealthPreference(
                    focus_area=HealthFocus(pref_data['focus_area']),
                    specific_interests=pref_data.get('specific_interests', []),
                    preference_strength=pref_data.get('preference_strength', 0.0),
                    activity_level=ActivityLevel(pref_data['activity_level']) if pref_data.get('activity_level') else None,
                    approach=pref_data.get('approach', 'unknown')
                ))

            profiles.health = HealthProfile(
                health_preferences=health_prefs,
                fitness_patterns=health_data.get('fitness_patterns', {}),
                nutrition_patterns=health_data.get('nutrition_patterns', {}),
                wellness_activities=health_data.get('wellness_activities', []),
                health_services=health_data.get('health_services', []),
                tracking_behavior=health_data.get('tracking_behavior', {})
            )

        # Restaurant profile
        if 'restaurants' in data:
            rest_data = data['restaurants']
            cuisine_prefs = []
            for pref_data in rest_data.get('cuisine_preferences', []):
                cuisine_prefs.append(CuisinePreference(
                    cuisine_type=CuisineType(pref_data['cuisine_type']),
                    specific_cuisines=pref_data.get('specific_cuisines', []),
                    preference_strength=pref_data.get('preference_strength', 0.0),
                    price_tolerance=PriceRange(pref_data.get('price_tolerance', 'moderate')),
                    spice_preference=pref_data.get('spice_preference', 'unknown')
                ))

            profiles.restaurants = RestaurantProfile(
                cuisine_preferences=cuisine_prefs,
                dining_occasions=[DiningOccasion(occ) for occ in rest_data.get('dining_occasions', [])],
                service_preferences=rest_data.get('service_preferences', []),
                discovery_methods=rest_data.get('discovery_methods', []),
                price_sensitivity=PriceRange(rest_data.get('price_sensitivity', 'moderate')),
                dietary_restrictions=rest_data.get('dietary_restrictions', []),
                location_preferences=rest_data.get('location_preferences', {})
            )

        # Recipe profile
        if 'recipes' in data:
            recipe_data = data['recipes']
            cooking_prefs = []
            for pref_data in recipe_data.get('cooking_preferences', []):
                cooking_prefs.append(CookingPreference(
                    cuisine_style=pref_data['cuisine_style'],
                    complexity_preference=RecipeComplexity(pref_data.get('complexity_preference', 'moderate')),
                    meal_types=[MealType(meal) for meal in pref_data.get('meal_types', [])],
                    cooking_methods=pref_data.get('cooking_methods', []),
                    preference_strength=pref_data.get('preference_strength', 0.0)
                ))

            profiles.recipes = RecipeProfile(
                cooking_preferences=cooking_prefs,
                skill_level=CookingSkill(recipe_data.get('skill_level', 'intermediate')),
                dietary_preferences=recipe_data.get('dietary_preferences', []),
                cooking_frequency=recipe_data.get('cooking_frequency', 'unknown'),
                ingredient_preferences=recipe_data.get('ingredient_preferences', {}),
                equipment_available=recipe_data.get('equipment_available', []),
                time_constraints=recipe_data.get('time_constraints', {}),
                learning_interests=recipe_data.get('learning_interests', [])
            )

        return profiles