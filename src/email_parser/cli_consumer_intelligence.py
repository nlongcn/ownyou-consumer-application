#!/usr/bin/env python3
"""
Consumer Intelligence CLI

Demonstrates the new modular consumer intelligence system as an alternative
to the existing marketing analyzer. This shows how the new architecture
provides enhanced capabilities while maintaining compatibility.

Usage:
    python -m src.email_parser.cli_consumer_intelligence --help
    python -m src.email_parser.cli_consumer_intelligence analyze --csv emails.csv --profile-id user123
    python -m src.email_parser.cli_consumer_intelligence recommend --profile-id user123
"""

import argparse
import sys
import json
import pandas as pd
from pathlib import Path
from datetime import datetime
import logging
from typing import Optional, List

# Add the src directory to the Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "src"))

from email_parser.consumer_intelligence_system import ConsumerIntelligenceSystem, create_consumer_intelligence_system
from email_parser.llm_clients.base import LLMClientFactory
from email_parser.models.consumer_profile import RecommendationCategoryType
from email_parser.agents.base_agent import MissionPriority
from email_parser.utils.config import get_config


def setup_logging(verbose: bool = False) -> logging.Logger:
    """Set up logging configuration."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


def load_email_data(csv_path: str) -> pd.DataFrame:
    """Load email data from CSV file."""
    try:
        df = pd.read_csv(csv_path)
        print(f"Loaded {len(df)} emails from {csv_path}")
        return df
    except Exception as e:
        print(f"Error loading CSV: {e}")
        sys.exit(1)


def analyze_profile_legacy(csv_path: str, profile_id: str) -> None:
    """Analyze consumer profile from email data."""
    print(f"Analyzing consumer profile: {profile_id}")

    # Load email data
    email_data = load_email_data(csv_path)

    # Analyze profile
    profile = system.analyze_consumer_profile(email_data, profile_id)

    # Display results
    print(f"\nProfile Analysis Results:")
    print(f"Profile ID: {profile.profile_id}")
    print(f"Confidence Score: {profile.confidence_score:.2f}")
    print(f"Categories with insights: {len([cat for cat, cat_profile in profile.categories.items() if cat_profile.insights])}")
    print(f"Total memories: {len(profile.memories)}")
    print(f"Last updated: {profile.last_updated}")

    # Show category breakdown
    print("\nCategory Insights:")
    for category, category_profile in profile.categories.items():
        if category_profile.insights or category_profile.behavior_patterns:
            print(f"  {category.value}:")
            print(f"    Insights: {len(category_profile.insights)}")
            print(f"    Behavior Patterns: {len(category_profile.behavior_patterns)}")
            print(f"    Engagement Score: {category_profile.engagement_score:.2f}")

            # Show high-confidence insights
            high_conf_insights = category_profile.get_high_confidence_insights()
            if high_conf_insights:
                print("    High-confidence insights:")
                for insight in high_conf_insights[:3]:  # Show top 3
                    print(f"      - {insight.description} (confidence: {insight.confidence:.2f})")

    print(f"\nProfile saved to storage directory")


def generate_recommendations(system: ConsumerIntelligenceSystem, profile_id: str,
                           max_recommendations: int, categories: list) -> None:
    """Generate recommendations for a profile."""
    print(f"Generating recommendations for profile: {profile_id}")

    # Parse categories
    category_filter = None
    if categories:
        try:
            category_filter = [RecommendationCategoryType(cat) for cat in categories]
        except ValueError as e:
            print(f"Invalid category: {e}")
            sys.exit(1)

    # Generate recommendations
    recommendations = system.generate_recommendations(
        profile_id,
        max_recommendations=max_recommendations,
        categories=category_filter
    )

    if not recommendations:
        print("No recommendations generated. Profile may not exist or have insufficient data.")
        return

    print(f"\nGenerated {len(recommendations)} recommendations:")
    print("-" * 60)

    for i, rec in enumerate(recommendations, 1):
        print(f"{i}. {rec.get('title', 'No title')}")
        print(f"   Category: {rec.get('category', 'Unknown')}")
        print(f"   Type: {rec.get('type', 'Unknown')}")
        print(f"   Confidence: {rec.get('confidence', 0):.2f}")
        print(f"   Description: {rec.get('description', 'No description')}")
        if rec.get('metadata'):
            print(f"   Evidence: {rec['metadata'].get('evidence', [])}")
        print()


def get_profile_insights(system: ConsumerIntelligenceSystem, profile_id: str, category: str) -> None:
    """Get detailed insights for a profile."""
    print(f"Getting insights for profile: {profile_id}")

    # Parse category
    category_filter = None
    if category:
        try:
            category_filter = RecommendationCategoryType(category)
        except ValueError:
            print(f"Invalid category: {category}")
            sys.exit(1)

    # Get insights
    insights = system.get_profile_insights(profile_id, category_filter)

    if "error" in insights:
        print(f"Error: {insights['error']}")
        return

    # Display insights
    print("\nProfile Insights:")
    print(f"Profile ID: {insights['profile_id']}")
    print(f"Confidence Score: {insights['confidence_score']:.2f}")
    print(f"Total Memories: {insights['total_memories']}")
    print(f"Last Updated: {insights['last_updated']}")

    if category_filter:
        # Category-specific insights
        cat_insights = insights.get('category_insights', {})
        print(f"\n{category_filter.value.title()} Category Insights:")
        print(f"Insights Count: {cat_insights.get('insights_count', 0)}")
        print(f"Behavior Patterns: {cat_insights.get('behavior_patterns_count', 0)}")
        print(f"Engagement Score: {cat_insights.get('engagement_score', 0):.2f}")

        high_conf = cat_insights.get('high_confidence_insights', [])
        if high_conf:
            print("High-confidence insights:")
            for insight in high_conf:
                print(f"  - {insight['description']} (confidence: {insight['confidence']:.2f})")
    else:
        # All categories
        categories = insights.get('categories', {})
        print(f"\nAll Categories ({len(categories)} active):")
        for cat_name, cat_data in categories.items():
            print(f"  {cat_name.title()}:")
            print(f"    Insights: {cat_data['insights_count']}")
            print(f"    Patterns: {cat_data['behavior_patterns_count']}")
            print(f"    Engagement: {cat_data['engagement_score']:.2f}")

    # Recent memories
    recent = insights.get('recent_memories', [])
    if recent:
        print(f"\nRecent Memories ({len(recent)}):")
        for memory in recent[:5]:  # Show top 5
            print(f"  - {memory['content']} (importance: {memory['importance']:.2f})")


def get_system_status(system: ConsumerIntelligenceSystem) -> None:
    """Display system status."""
    status = system.get_system_status()

    print("Consumer Intelligence System Status:")
    print("-" * 50)

    # System stats
    stats = status['system_stats']
    print(f"Profiles Analyzed: {stats['profiles_analyzed']}")
    print(f"Recommendations Generated: {stats['recommendations_generated']}")
    print(f"Missions Completed: {stats['missions_completed']}")
    print(f"Categories Supported: {stats['categories_supported']}")

    # Memory manager
    memory = status['memory_manager']
    print(f"\nMemory Manager:")
    print(f"Cached Profiles: {memory['cached_profiles']}")
    print(f"Storage Directory: {memory['storage_directory']}")
    print(f"Compression: {memory['compression_enabled']}")

    # Recommendation engine
    engine = status['recommendation_engine']
    print(f"\nRecommendation Engine:")
    print(f"Registered Analyzers: {engine['registered_analyzers']}")
    print(f"Supported Categories: {', '.join(engine['supported_categories'])}")

    # Mission controller
    missions = status['mission_controller']['missions']
    print(f"\nMission Controller:")
    print(f"Queued Missions: {missions['queued']}")
    print(f"Active Missions: {missions['active']}")
    print(f"Completed Missions: {missions['completed']}")

    # Active profiles
    active = status['active_profiles']
    print(f"\nActive Profiles: {len(active)}")
    if active:
        print(f"Profile IDs: {', '.join(active)}")


def export_profile(system: ConsumerIntelligenceSystem, profile_id: str,
                  output_path: str, format: str, include_memories: bool) -> None:
    """Export a consumer profile."""
    print(f"Exporting profile {profile_id} to {output_path}")

    success = system.export_profile(
        profile_id=profile_id,
        export_path=output_path,
        format=format,
        include_memories=include_memories
    )

    if success:
        print(f"Profile exported successfully to {output_path}")
    else:
        print(f"Failed to export profile")


def analyze_profile(system: ConsumerIntelligenceSystem, csv_path: str, profile_id: str) -> None:
    """Analyze consumer profile from email data."""
    print(f"Analyzing consumer profile: {profile_id}")

    # Load email data
    email_df = load_email_data(csv_path)

    # Analyze profile
    profile = system.analyze_consumer_profile(email_df, profile_id)

    # Print summary
    print(f"Profile updated for {profile_id}")
    print(f"Categories analyzed: {len(profile.categories)}")

    # Show sample insights
    for category, category_profile in profile.categories.items():
        print(f"\n{category.value}:")
        if hasattr(category_profile, 'insights') and category_profile.insights:
            insights = category_profile.insights

            # Handle different insight data structures
            if isinstance(insights, list):
                # Insights is a list of insight objects
                if len(insights) > 0:
                    print(f"  Found {len(insights)} insights:")
                    for i, insight in enumerate(insights[:3], 1):
                        if isinstance(insight, dict):
                            insight_type = insight.get('insight_type', 'unknown')
                            description = insight.get('description', 'No description')
                            confidence = insight.get('confidence', 0.0)
                            print(f"  {i}. [{insight_type}] {description}")
                            print(f"     Confidence: {confidence:.1%}")
                        elif hasattr(insight, 'insight_type'):
                            # Handle object format
                            insight_type = getattr(insight, 'insight_type', 'unknown')
                            description = getattr(insight, 'description', 'No description')
                            confidence = getattr(insight, 'confidence', 0.0)
                            print(f"  {i}. [{insight_type}] {description}")
                            print(f"     Confidence: {confidence:.1%}")
                        else:
                            print(f"  {i}. {insight}")
                    if len(insights) > 3:
                        print(f"  ... and {len(insights) - 3} more")
                else:
                    print("  No insights available yet")
            elif hasattr(insights, 'recommendations') and insights.recommendations:
                # Original format with recommendations attribute
                for i, rec in enumerate(insights.recommendations[:3], 1):
                    print(f"  {i}. {rec.title}: {rec.description}")
            else:
                print("  No insights available yet")
        else:
            print("  No insights available yet")


def generate_recommendations(system: ConsumerIntelligenceSystem, profile_id: str,
                           max_recommendations: int, categories: Optional[List[str]] = None) -> None:
    """Generate recommendations for a consumer profile."""
    print(f"Generating recommendations for: {profile_id}")

    # Parse categories if provided
    category_types = None
    if categories:
        try:
            category_types = [RecommendationCategoryType(cat) for cat in categories]
        except ValueError as e:
            print(f"Invalid category: {e}")
            return

    # Generate recommendations
    recommendations = system.generate_recommendations(
        profile_id,
        max_recommendations=max_recommendations,
        categories=category_types
    )

    if not recommendations:
        print("No recommendations generated. Profile may not exist or lack data.")
        return

    # Display recommendations (handle both dict and object formats)
    print(f"\n{len(recommendations)} recommendations:")
    for i, rec in enumerate(recommendations, 1):
        if isinstance(rec, dict):
            # Handle dictionary format
            category = rec.get('category', 'unknown')
            title = rec.get('title', 'No title')
            description = rec.get('description', 'No description')
            confidence = rec.get('confidence', 0.0)
            priority = rec.get('priority', 'medium')
            estimated_value = rec.get('estimated_value')

            print(f"{i}. [{category}] {title}")
            print(f"   {description}")
            print(f"   Confidence: {confidence:.1%}, Priority: {priority}")
            if estimated_value:
                print(f"   Estimated value: ${estimated_value:.2f}")
        else:
            # Handle object format
            print(f"{i}. [{rec.category.value}] {rec.title}")
            print(f"   {rec.description}")
            print(f"   Confidence: {rec.confidence:.1%}, Priority: {rec.priority.value}")
            if rec.estimated_value:
                print(f"   Estimated value: ${rec.estimated_value:.2f}")
        print()


def get_profile_insights(system: ConsumerIntelligenceSystem, profile_id: str, category: str) -> None:
    """Get detailed insights for a specific category."""
    try:
        category_type = RecommendationCategoryType(category) if category else None
    except ValueError:
        print(f"Invalid category: {category}")
        return

    insights = system.get_profile_insights(profile_id, category_type)

    if not insights:
        print(f"No insights found for profile {profile_id}")
        return

    print(f"Insights for {profile_id}:")
    if category_type:
        # Single category insights
        insight = insights.get(category_type)
        if insight:
            print(f"\n{category_type.value}:")
            print(f"  Recommendations: {len(insight.recommendations)}")
            print(f"  Preferences: {insight.preferences}")
            print(f"  Patterns: {insight.behavioral_patterns}")
        else:
            print(f"No insights for category: {category_type.value}")
    else:
        # All category insights
        for cat_type, insight in insights.items():
            print(f"\n{cat_type.value}:")
            print(f"  Recommendations: {len(insight.recommendations)}")
            if insight.preferences:
                print(f"  Key preferences: {list(insight.preferences.keys())[:3]}")


def get_system_status(system: ConsumerIntelligenceSystem) -> None:
    """Display system status and statistics."""
    print("Consumer Intelligence System Status:")

    # Get basic system information
    try:
        active_profiles = getattr(system, 'active_profiles', [])
        print(f"  Active profiles: {len(active_profiles)}")
    except:
        print("  Active profiles: Unable to determine")

    # Check if memory manager exists
    if hasattr(system, 'memory_manager'):
        print(f"  Memory manager: Active")
        print(f"  Storage directory: {getattr(system.memory_manager, 'storage_dir', 'Unknown')}")
    else:
        print("  Memory manager: Not available")

    # Check analyzers
    if hasattr(system, 'analyzers'):
        print(f"  Registered analyzers: {len(system.analyzers)}")
        for analyzer_name in system.analyzers.keys():
            print(f"    - {analyzer_name}")
    else:
        print("  Analyzers: Not available")

    # Check recommendation engine
    if hasattr(system, 'recommendation_engine'):
        print(f"  Recommendation engine: Active")
    else:
        print("  Recommendation engine: Not available")

    print("\nSystem is operational and ready for analysis.")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Consumer Intelligence System CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    parser.add_argument('--storage-dir', default='consumer_profiles',
                       help='Storage directory for profiles (default: consumer_profiles)')

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Analyze command
    analyze_parser = subparsers.add_parser('analyze', help='Analyze consumer profile from email data')
    analyze_parser.add_argument('--csv', required=True, help='CSV file with email data')
    analyze_parser.add_argument('--profile-id', required=True, help='Consumer profile ID')

    # Recommend command
    recommend_parser = subparsers.add_parser('recommend', help='Generate recommendations')
    recommend_parser.add_argument('--profile-id', required=True, help='Consumer profile ID')
    recommend_parser.add_argument('--max-recommendations', type=int, default=20,
                                 help='Maximum recommendations to generate (default: 20)')
    recommend_parser.add_argument('--categories', nargs='*',
                                 choices=[cat.value for cat in RecommendationCategoryType],
                                 help='Specific categories to focus on')

    # Insights command
    insights_parser = subparsers.add_parser('insights', help='Get profile insights')
    insights_parser.add_argument('--profile-id', required=True, help='Consumer profile ID')
    insights_parser.add_argument('--category', choices=[cat.value for cat in RecommendationCategoryType],
                                help='Specific category to focus on')

    # Status command
    subparsers.add_parser('status', help='Show system status')

    # Export command
    export_parser = subparsers.add_parser('export', help='Export consumer profile')
    export_parser.add_argument('--profile-id', required=True, help='Consumer profile ID')
    export_parser.add_argument('--output', required=True, help='Output file path')
    export_parser.add_argument('--format', choices=['json', 'pickle'], default='json',
                              help='Export format (default: json)')
    export_parser.add_argument('--no-memories', action='store_true',
                              help='Exclude memories from export')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Setup logging
    logger = setup_logging(args.verbose)

    # Load configuration
    config = get_config()

    # Create LLM configuration dictionary
    import os
    llm_config = {
        'ollama_base_url': config.llm.ollama_base_url,
        'ollama_model': config.llm.ollama_model,
        'ollama_timeout': config.llm.ollama_timeout,
        'openai_api_key': config.llm.openai_api_key,
        'openai_model': config.llm.openai_model,
        'openai_max_tokens': config.llm.openai_max_tokens,
        'openai_temperature': config.llm.openai_temperature,
        'anthropic_api_key': config.llm.anthropic_api_key,
        'anthropic_model': config.llm.anthropic_model,
        'anthropic_max_tokens': config.llm.anthropic_max_tokens,
        'seed': int(os.getenv('LLM_SEED', '42')),
        'redact_reports': os.getenv('REDACT_REPORTS', '') in ('1','true','yes','on')
    }

    # Create LLM client
    llm_client = LLMClientFactory.create_client(
        provider=config.llm.provider,
        config=llm_config
    )

    # Create consumer intelligence system
    system = create_consumer_intelligence_system(llm_client, args.storage_dir)

    # Execute command
    try:
        if args.command == 'analyze':
            analyze_profile(system, args.csv, args.profile_id)

        elif args.command == 'recommend':
            generate_recommendations(system, args.profile_id,
                                   args.max_recommendations, args.categories)

        elif args.command == 'insights':
            get_profile_insights(system, args.profile_id, args.category)

        elif args.command == 'status':
            get_system_status(system)

        elif args.command == 'export':
            export_profile(system, args.profile_id, args.output,
                         args.format, not args.no_memories)

    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Command failed: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()