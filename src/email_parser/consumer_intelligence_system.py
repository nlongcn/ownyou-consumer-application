"""
Consumer Intelligence System

Unified interface that integrates all components of the modular recommendation system:
- Consumer profiles with persistent memory
- Category-specific analyzers
- AI agents with mission framework
- LLM analysis engine
- Memory management

This replaces the monolithic marketing_analyzer.py with a comprehensive,
extensible consumer intelligence platform.
"""

import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
import pandas as pd
from datetime import datetime

from .models.consumer_profile import ConsumerProfile, RecommendationCategoryType
from .models.recommendation_schemas import CategorySpecificProfiles
from .utils.memory_manager import MemoryManager
from .analysis.llm_analysis_engine import LLMAnalysisEngine
from .analysis.recommendation_category import RecommendationEngine
from .analysis.categories.shopping_analyzer import ShoppingAnalyzer
from .analysis.categories.travel_analyzer import TravelAnalyzer
from .agents.base_agent import MissionController, Mission, MissionPriority, AgentCapability
from .llm_clients.base import BaseLLMClient


class ConsumerIntelligenceSystem:
    """
    Unified consumer intelligence system that provides:
    - Multi-category recommendation analysis
    - Persistent consumer profiling
    - AI agent coordination
    - Memory-enabled learning
    - Cross-category insights
    """

    def __init__(self, llm_client: BaseLLMClient, storage_dir: str = "consumer_profiles",
                 logger: Optional[logging.Logger] = None):
        """
        Initialize the consumer intelligence system.

        Args:
            llm_client: LLM client for analysis operations
            storage_dir: Directory for profile storage
            logger: Optional logger instance
        """
        self.logger = logger or logging.getLogger(__name__)

        # Initialize core components (using JSON instead of gzip for easier file access)
        self.memory_manager = MemoryManager(storage_dir=storage_dir, compression=False)
        self.analysis_engine = LLMAnalysisEngine(llm_client, self.logger)
        self.recommendation_engine = RecommendationEngine(self.analysis_engine)
        self.mission_controller = MissionController(self.memory_manager, self.recommendation_engine)

        # Register category analyzers
        self._register_analyzers()

        # Initialize system state
        self.active_profiles: Dict[str, ConsumerProfile] = {}
        self.system_stats = {
            "profiles_analyzed": 0,
            "recommendations_generated": 0,
            "missions_completed": 0,
            "categories_supported": len(RecommendationCategoryType)
        }

        self.logger.info("Consumer Intelligence System initialized")

    def _register_analyzers(self) -> None:
        """Register all category-specific analyzers."""
        # Register working analyzers
        shopping_analyzer = ShoppingAnalyzer(self.analysis_engine)
        self.recommendation_engine.register_analyzer(shopping_analyzer)

        travel_analyzer = TravelAnalyzer(self.analysis_engine)
        self.recommendation_engine.register_analyzer(travel_analyzer)

        # TODO: Add remaining analyzers (entertainment, health, restaurants, recipes)
        # when implemented

        self.logger.info(f"Registered {len(self.recommendation_engine.registry._analyzers)} category analyzers")

    def analyze_consumer_profile(self, email_data: pd.DataFrame, profile_id: str,
                                create_if_missing: bool = True) -> ConsumerProfile:
        """
        Perform comprehensive consumer profile analysis.

        Args:
            email_data: Email data to analyze
            profile_id: ID of consumer profile
            create_if_missing: Whether to create new profile if not found

        Returns:
            Updated consumer profile with new insights
        """
        # Load or create consumer profile
        with self.memory_manager.profile_session(profile_id, create_if_missing) as profile:
            self.logger.info(f"Analyzing consumer profile {profile_id} with {len(email_data)} emails")

            # Perform multi-category analysis
            updated_profile = self.recommendation_engine.analyze_consumer_profile(email_data, profile)

            # Update system stats
            self.system_stats["profiles_analyzed"] += 1

            # Cache active profile
            self.active_profiles[profile_id] = updated_profile

            self.logger.info(f"Profile analysis completed for {profile_id}, confidence: {updated_profile.confidence_score:.2f}")

            return updated_profile

    def generate_recommendations(self, profile_id: str, max_recommendations: int = 20,
                               categories: List[RecommendationCategoryType] = None) -> List[Dict[str, Any]]:
        """
        Generate unified recommendations for a consumer profile.

        Args:
            profile_id: ID of consumer profile
            max_recommendations: Maximum recommendations to return
            categories: Specific categories to focus on (all if None)

        Returns:
            List of recommendations across categories
        """
        # Load profile
        profile = self._get_profile(profile_id)
        if not profile:
            self.logger.error(f"Profile {profile_id} not found")
            return []

        # Generate recommendations
        recommendations = self.recommendation_engine.generate_unified_recommendations(
            profile, max_recommendations
        )

        # Filter by categories if specified
        if categories:
            category_values = [cat.value for cat in categories]
            recommendations = [
                rec for rec in recommendations
                if rec.get('category') in category_values
            ]

        # Update system stats
        self.system_stats["recommendations_generated"] += len(recommendations)

        self.logger.info(f"Generated {len(recommendations)} recommendations for profile {profile_id}")

        return recommendations

    def create_mission(self, profile_id: str, mission_type: str, objectives: List[Dict[str, Any]],
                      category: RecommendationCategoryType, priority: MissionPriority = MissionPriority.MEDIUM) -> str:
        """
        Create and assign a mission for AI agent execution.

        Args:
            profile_id: Consumer profile to use
            mission_type: Type of mission (research, recommendation, analysis)
            objectives: List of mission objectives
            category: Primary category for the mission
            priority: Mission priority level

        Returns:
            Mission ID
        """
        # Determine required capabilities based on mission type and category
        capabilities = self._get_required_capabilities(mission_type, category)

        # Create mission
        mission_id = self.mission_controller.create_mission(
            title=f"{mission_type.title()} Mission for {category.value}",
            description=f"Execute {mission_type} for consumer profile {profile_id} in {category.value} category",
            category=category,
            objectives=objectives,
            priority=priority,
            required_capabilities=capabilities
        )

        # Assign mission to best available agent
        assigned = self.mission_controller.assign_mission(mission_id)

        if assigned:
            self.logger.info(f"Created and assigned mission {mission_id} for profile {profile_id}")
        else:
            self.logger.warning(f"Created mission {mission_id} but could not assign agent")

        return mission_id

    def execute_mission(self, mission_id: str, profile_id: str) -> Dict[str, Any]:
        """
        Execute a mission using AI agents.

        Args:
            mission_id: ID of mission to execute
            profile_id: Consumer profile to use

        Returns:
            Mission execution results
        """
        results = self.mission_controller.execute_mission(mission_id, profile_id)

        if results.get("success"):
            self.system_stats["missions_completed"] += 1
            self.logger.info(f"Mission {mission_id} completed successfully")
        else:
            self.logger.error(f"Mission {mission_id} failed: {results.get('error', 'Unknown error')}")

        return results

    def get_profile_insights(self, profile_id: str,
                           category: Optional[RecommendationCategoryType] = None) -> Dict[str, Any]:
        """
        Get comprehensive insights for a consumer profile.

        Args:
            profile_id: Consumer profile ID
            category: Specific category to focus on (all if None)

        Returns:
            Dictionary with profile insights and statistics
        """
        profile = self._get_profile(profile_id)
        if not profile:
            return {"error": "Profile not found"}

        insights = {
            "profile_id": profile_id,
            "confidence_score": profile.confidence_score,
            "last_updated": profile.last_updated.isoformat(),
            "data_sources": profile.data_sources,
            "total_memories": len(profile.memories),
            "analysis_history": profile.analysis_history
        }

        if category:
            # Category-specific insights
            category_profile = profile.get_category_profile(category)
            insights["category_insights"] = {
                "category": category.value,
                "insights_count": len(category_profile.insights),
                "behavior_patterns_count": len(category_profile.behavior_patterns),
                "engagement_score": category_profile.engagement_score,
                "last_analyzed": category_profile.last_analyzed.isoformat() if category_profile.last_analyzed else None,
                "high_confidence_insights": [
                    {
                        "type": insight.insight_type,
                        "description": insight.description,
                        "confidence": insight.confidence
                    }
                    for insight in category_profile.get_high_confidence_insights()
                ]
            }
        else:
            # All categories insights
            insights["categories"] = {}
            for cat, cat_profile in profile.categories.items():
                if cat_profile.insights or cat_profile.behavior_patterns:
                    insights["categories"][cat.value] = {
                        "insights_count": len(cat_profile.insights),
                        "behavior_patterns_count": len(cat_profile.behavior_patterns),
                        "engagement_score": cat_profile.engagement_score,
                        "last_analyzed": cat_profile.last_analyzed.isoformat() if cat_profile.last_analyzed else None
                    }

        # Recent memories
        insights["recent_memories"] = [
            {
                "content": memory.content[:100] + "..." if len(memory.content) > 100 else memory.content,
                "memory_type": memory.memory_type,
                "importance": memory.importance,
                "created_at": memory.created_at.isoformat()
            }
            for memory in profile.get_recent_memories(days=7)
        ]

        return insights

    def export_profile(self, profile_id: str, export_path: str,
                      format: str = "json", include_memories: bool = True) -> bool:
        """
        Export consumer profile to external file.

        Args:
            profile_id: Profile to export
            export_path: Path to export file
            format: Export format (json, pickle)
            include_memories: Whether to include memory data

        Returns:
            True if successful
        """
        profile = self._get_profile(profile_id)
        if not profile:
            self.logger.error(f"Profile {profile_id} not found for export")
            return False

        # Create export data
        export_data = profile.to_dict()

        if not include_memories:
            export_data["memories"] = []

        # Add system metadata
        export_data["export_metadata"] = {
            "exported_at": datetime.utcnow().isoformat(),
            "system_version": "2.0",
            "format": format,
            "include_memories": include_memories
        }

        return self.memory_manager.export_profile(profile_id, export_path, format)

    def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status and statistics."""
        mission_status = self.mission_controller.get_system_status()

        return {
            "system_stats": self.system_stats,
            "memory_manager": {
                "cached_profiles": self.memory_manager.cache.size(),
                "storage_directory": str(self.memory_manager.storage_dir),
                "compression_enabled": self.memory_manager.compression
            },
            "recommendation_engine": {
                "registered_analyzers": len(self.recommendation_engine.registry._analyzers),
                "supported_categories": [cat.value for cat in RecommendationCategoryType]
            },
            "mission_controller": mission_status,
            "active_profiles": list(self.active_profiles.keys()),
            "llm_client": {
                "model": self.analysis_engine.model_name,
                "provider": type(self.analysis_engine.llm_client).__name__
            }
        }

    def process_user_feedback(self, profile_id: str, feedback_data: Dict[str, Any]) -> bool:
        """
        Process user feedback to improve recommendations.

        Args:
            profile_id: Consumer profile ID
            feedback_data: User feedback data

        Returns:
            True if processed successfully
        """
        try:
            profile = self._get_profile(profile_id)
            if not profile:
                return False

            # Store feedback as memory
            feedback_memory = f"User feedback: {feedback_data.get('summary', 'No summary')}"
            profile.add_memory(
                content=feedback_memory,
                memory_type="episodic",
                importance=0.8,  # High importance for feedback
                tags=["user_feedback", "learning"],
                context={
                    "feedback_type": feedback_data.get("type", "general"),
                    "satisfaction": feedback_data.get("satisfaction", 0),
                    "timestamp": datetime.utcnow().isoformat()
                }
            )

            # Save updated profile
            self.memory_manager.save_profile(profile)

            # TODO: Process feedback through agents if mission_id provided
            if "mission_id" in feedback_data:
                mission_id = feedback_data["mission_id"]
                # Find and notify relevant agent
                for agent in self.mission_controller.agents.values():
                    if agent.get_mission_status(mission_id):
                        agent.process_user_feedback(mission_id, feedback_data)
                        break

            self.logger.info(f"Processed user feedback for profile {profile_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to process user feedback: {e}")
            return False

    def _get_profile(self, profile_id: str) -> Optional[ConsumerProfile]:
        """Get profile from cache or load from storage."""
        # Check cache first
        if profile_id in self.active_profiles:
            return self.active_profiles[profile_id]

        # Load from storage
        profile = self.memory_manager.load_profile(profile_id)
        if profile:
            self.active_profiles[profile_id] = profile

        return profile

    def _get_required_capabilities(self, mission_type: str,
                                 category: RecommendationCategoryType) -> List[AgentCapability]:
        """Determine required capabilities for a mission."""
        capabilities = []

        # Category-specific capabilities
        category_map = {
            RecommendationCategoryType.SHOPPING: AgentCapability.SHOPPING_RESEARCH,
            RecommendationCategoryType.TRAVEL: AgentCapability.TRAVEL_PLANNING,
            RecommendationCategoryType.ENTERTAINMENT: AgentCapability.ENTERTAINMENT_DISCOVERY,
            RecommendationCategoryType.HEALTH: AgentCapability.HEALTH_MONITORING,
            RecommendationCategoryType.RESTAURANTS: AgentCapability.RESTAURANT_FINDING,
            RecommendationCategoryType.RECIPES: AgentCapability.RECIPE_SUGGESTION
        }

        if category in category_map:
            capabilities.append(category_map[category])

        # Mission type capabilities
        if mission_type in ["analysis", "research"]:
            capabilities.append(AgentCapability.DATA_ANALYSIS)

        if mission_type in ["recommendation", "synthesis"]:
            capabilities.append(AgentCapability.RECOMMENDATION_SYNTHESIS)

        return capabilities

    def cleanup_system(self, days_threshold: int = 90) -> Dict[str, int]:
        """
        Perform system cleanup operations.

        Args:
            days_threshold: Remove data older than this many days

        Returns:
            Dictionary with cleanup statistics
        """
        # Memory manager cleanup
        memory_stats = self.memory_manager.cleanup_storage(days_threshold)

        # Clear cache
        self.memory_manager.cache.clear()
        self.active_profiles.clear()

        self.logger.info(f"System cleanup completed: {memory_stats}")

        return memory_stats


# Convenience functions for common operations

def create_consumer_intelligence_system(llm_client: BaseLLMClient,
                                       storage_dir: str = "consumer_profiles") -> ConsumerIntelligenceSystem:
    """
    Create a fully configured consumer intelligence system.

    Args:
        llm_client: LLM client for analysis
        storage_dir: Storage directory for profiles

    Returns:
        Configured ConsumerIntelligenceSystem instance
    """
    return ConsumerIntelligenceSystem(llm_client, storage_dir)


def analyze_email_data(system: ConsumerIntelligenceSystem, email_data: pd.DataFrame,
                      profile_id: str) -> Dict[str, Any]:
    """
    Analyze email data and return comprehensive results.

    Args:
        system: ConsumerIntelligenceSystem instance
        email_data: Email data to analyze
        profile_id: Consumer profile ID

    Returns:
        Dictionary with analysis results
    """
    # Analyze profile
    profile = system.analyze_consumer_profile(email_data, profile_id)

    # Generate recommendations
    recommendations = system.generate_recommendations(profile_id)

    # Get insights
    insights = system.get_profile_insights(profile_id)

    return {
        "profile_confidence": profile.confidence_score,
        "recommendations": recommendations,
        "insights": insights,
        "categories_analyzed": len([cat for cat, cat_profile in profile.categories.items()
                                   if cat_profile.insights or cat_profile.behavior_patterns])
    }