"""
Consumer Profile Data Models

Core data structures for persistent consumer profiling and AI agent integration.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import json
import uuid


class RecommendationCategoryType(Enum):
    """Supported recommendation categories."""
    SHOPPING = "shopping"
    TRAVEL = "travel"
    ENTERTAINMENT = "entertainment"
    HEALTH = "health"
    RESTAURANTS = "restaurants"
    RECIPES = "recipes"


class ConfidenceLevel(Enum):
    """Confidence levels for profile insights."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


@dataclass
class Insight:
    """A single consumer insight with evidence and confidence."""
    insight_type: str
    description: str
    evidence: List[str]
    confidence: float
    confidence_level: ConfidenceLevel
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def update_confidence(self, new_confidence: float) -> None:
        """Update confidence and refresh timestamp."""
        self.confidence = new_confidence
        self.confidence_level = self._calculate_confidence_level(new_confidence)
        self.last_updated = datetime.now(timezone.utc)

    @staticmethod
    def _calculate_confidence_level(confidence: float) -> ConfidenceLevel:
        """Convert numeric confidence to enum."""
        if confidence >= 0.9:
            return ConfidenceLevel.VERY_HIGH
        elif confidence >= 0.7:
            return ConfidenceLevel.HIGH
        elif confidence >= 0.5:
            return ConfidenceLevel.MEDIUM
        else:
            return ConfidenceLevel.LOW


@dataclass
class BehaviorPattern:
    """Consumer behavior pattern with temporal tracking."""
    pattern_id: str
    pattern_type: str
    description: str
    frequency: int
    recency: datetime
    confidence: float
    evidence: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)

    def add_evidence(self, evidence_item: str) -> None:
        """Add new evidence and update recency."""
        self.evidence.append(evidence_item)
        self.frequency += 1
        self.recency = datetime.now(timezone.utc)


@dataclass
class CategoryProfile:
    """Profile for a specific recommendation category."""
    category: RecommendationCategoryType
    insights: List[Insight] = field(default_factory=list)
    behavior_patterns: List[BehaviorPattern] = field(default_factory=list)
    preferences: Dict[str, Any] = field(default_factory=dict)
    engagement_score: float = 0.0
    last_analyzed: Optional[datetime] = None
    analysis_count: int = 0

    def add_insight(self, insight: Insight) -> None:
        """Add a new insight to this category."""
        self.insights.append(insight)
        self.last_analyzed = datetime.now(timezone.utc)
        self.analysis_count += 1

    def get_high_confidence_insights(self) -> List[Insight]:
        """Get insights with high or very high confidence."""
        return [
            insight for insight in self.insights
            if insight.confidence_level in [ConfidenceLevel.HIGH, ConfidenceLevel.VERY_HIGH]
        ]

    def update_engagement_score(self, new_score: float) -> None:
        """Update engagement score with timestamp."""
        self.engagement_score = new_score
        self.last_analyzed = datetime.now(timezone.utc)


@dataclass
class MemoryEntry:
    """Individual memory entry with context and retrieval metadata."""
    memory_id: str
    content: str
    memory_type: str  # episodic, semantic, procedural
    category: Optional[RecommendationCategoryType] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    accessed_count: int = 0
    last_accessed: Optional[datetime] = None
    importance: float = 0.5
    tags: List[str] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)

    def access(self) -> None:
        """Record memory access for retrieval optimization."""
        self.accessed_count += 1
        self.last_accessed = datetime.now(timezone.utc)
        # Boost importance slightly on access
        self.importance = min(1.0, self.importance + 0.01)


@dataclass
class ConsumerProfile:
    """
    Complete consumer profile with multi-category insights and memory.

    This is the central data structure that AI agents use to understand
    user preferences, behaviors, and context for recommendations.
    """
    profile_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Category-specific profiles
    categories: Dict[RecommendationCategoryType, CategoryProfile] = field(default_factory=dict)

    # Cross-category insights
    behavioral_patterns: List[BehaviorPattern] = field(default_factory=list)
    demographic_insights: Dict[str, Any] = field(default_factory=dict)
    temporal_patterns: Dict[str, Any] = field(default_factory=dict)

    # Memory system
    memories: List[MemoryEntry] = field(default_factory=list)

    # Profile metadata
    data_sources: List[str] = field(default_factory=list)
    analysis_history: List[Dict[str, Any]] = field(default_factory=list)
    confidence_score: float = 0.0

    def __post_init__(self):
        """Initialize category profiles."""
        for category in RecommendationCategoryType:
            if category not in self.categories:
                self.categories[category] = CategoryProfile(category=category)

    def add_memory(self, content: str, memory_type: str,
                   category: Optional[RecommendationCategoryType] = None,
                   importance: float = 0.5, tags: List[str] = None,
                   context: Dict[str, Any] = None) -> str:
        """Add a new memory entry."""
        memory_id = str(uuid.uuid4())
        memory = MemoryEntry(
            memory_id=memory_id,
            content=content,
            memory_type=memory_type,
            category=category,
            importance=importance,
            tags=tags or [],
            context=context or {}
        )
        self.memories.append(memory)
        self.last_updated = datetime.now(timezone.utc)
        return memory_id

    def get_category_profile(self, category: RecommendationCategoryType) -> CategoryProfile:
        """Get profile for specific category."""
        return self.categories[category]

    def get_memories_by_category(self, category: RecommendationCategoryType) -> List[MemoryEntry]:
        """Retrieve memories for specific category."""
        return [memory for memory in self.memories if memory.category == category]

    def get_recent_memories(self, days: int = 30) -> List[MemoryEntry]:
        """Get memories from recent time period."""
        cutoff_date = datetime.now(timezone.utc).replace(day=datetime.now(timezone.utc).day - days)
        return [
            memory for memory in self.memories
            if memory.created_at >= cutoff_date
        ]

    def get_high_importance_memories(self, threshold: float = 0.7) -> List[MemoryEntry]:
        """Get memories above importance threshold."""
        return [
            memory for memory in self.memories
            if memory.importance >= threshold
        ]

    def update_confidence_score(self) -> None:
        """Calculate overall profile confidence based on category insights."""
        if not self.categories:
            self.confidence_score = 0.0
            return

        category_scores = []
        for category_profile in self.categories.values():
            if category_profile.insights:
                avg_confidence = sum(
                    insight.confidence for insight in category_profile.insights
                ) / len(category_profile.insights)
                # Weight by engagement score
                weighted_score = avg_confidence * (0.7 + 0.3 * category_profile.engagement_score)
                category_scores.append(weighted_score)

        if category_scores:
            self.confidence_score = sum(category_scores) / len(category_scores)
        else:
            self.confidence_score = 0.0

        self.last_updated = datetime.now(timezone.utc)

    def add_analysis_record(self, analysis_type: str, results: Dict[str, Any]) -> None:
        """Record an analysis session."""
        record = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'analysis_type': analysis_type,
            'categories_analyzed': [cat.value for cat in results.get('categories', [])],
            'insights_generated': results.get('insights_count', 0),
            'confidence_score': results.get('confidence_score', 0.0)
        }
        self.analysis_history.append(record)
        self.last_updated = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Convert profile to dictionary for serialization."""
        return {
            'profile_id': self.profile_id,
            'created_at': self.created_at.isoformat(),
            'last_updated': self.last_updated.isoformat(),
            'categories': {
                cat.value: {
                    'insights': [
                        {
                            'insight_type': insight.insight_type,
                            'description': insight.description,
                            'evidence': insight.evidence,
                            'confidence': insight.confidence,
                            'confidence_level': insight.confidence_level.value,
                            'created_at': insight.created_at.isoformat(),
                            'last_updated': insight.last_updated.isoformat()
                        }
                        for insight in profile.insights
                    ],
                    'behavior_patterns': [
                        {
                            'pattern_id': pattern.pattern_id,
                            'pattern_type': pattern.pattern_type,
                            'description': pattern.description,
                            'frequency': pattern.frequency,
                            'recency': pattern.recency.isoformat(),
                            'confidence': pattern.confidence,
                            'evidence': pattern.evidence,
                            'tags': pattern.tags
                        }
                        for pattern in profile.behavior_patterns
                    ],
                    'preferences': profile.preferences,
                    'engagement_score': profile.engagement_score,
                    'last_analyzed': profile.last_analyzed.isoformat() if profile.last_analyzed else None,
                    'analysis_count': profile.analysis_count
                }
                for cat, profile in self.categories.items()
            },
            'behavioral_patterns': [
                {
                    'pattern_id': pattern.pattern_id,
                    'pattern_type': pattern.pattern_type,
                    'description': pattern.description,
                    'frequency': pattern.frequency,
                    'recency': pattern.recency.isoformat(),
                    'confidence': pattern.confidence,
                    'evidence': pattern.evidence,
                    'tags': pattern.tags
                }
                for pattern in self.behavioral_patterns
            ],
            'demographic_insights': self.demographic_insights,
            'temporal_patterns': self.temporal_patterns,
            'memories': [
                {
                    'memory_id': memory.memory_id,
                    'content': memory.content,
                    'memory_type': memory.memory_type,
                    'category': memory.category.value if memory.category else None,
                    'created_at': memory.created_at.isoformat(),
                    'accessed_count': memory.accessed_count,
                    'last_accessed': memory.last_accessed.isoformat() if memory.last_accessed else None,
                    'importance': memory.importance,
                    'tags': memory.tags,
                    'context': memory.context
                }
                for memory in self.memories
            ],
            'data_sources': self.data_sources,
            'analysis_history': self.analysis_history,
            'confidence_score': self.confidence_score
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConsumerProfile':
        """Create profile from dictionary."""
        profile = cls(
            profile_id=data['profile_id'],
            created_at=datetime.fromisoformat(data['created_at'].replace('Z', '+00:00')),
            last_updated=datetime.fromisoformat(data['last_updated'].replace('Z', '+00:00')),
            demographic_insights=data.get('demographic_insights', {}),
            temporal_patterns=data.get('temporal_patterns', {}),
            data_sources=data.get('data_sources', []),
            analysis_history=data.get('analysis_history', []),
            confidence_score=data.get('confidence_score', 0.0)
        )

        # Reconstruct categories
        for cat_name, cat_data in data.get('categories', {}).items():
            category = RecommendationCategoryType(cat_name)
            category_profile = CategoryProfile(category=category)

            # Reconstruct insights
            for insight_data in cat_data.get('insights', []):
                insight = Insight(
                    insight_type=insight_data['insight_type'],
                    description=insight_data['description'],
                    evidence=insight_data['evidence'],
                    confidence=insight_data['confidence'],
                    confidence_level=ConfidenceLevel(insight_data['confidence_level']),
                    created_at=datetime.fromisoformat(insight_data['created_at'].replace('Z', '+00:00')),
                    last_updated=datetime.fromisoformat(insight_data['last_updated'].replace('Z', '+00:00'))
                )
                category_profile.insights.append(insight)

            # Reconstruct behavior patterns
            for pattern_data in cat_data.get('behavior_patterns', []):
                pattern = BehaviorPattern(
                    pattern_id=pattern_data['pattern_id'],
                    pattern_type=pattern_data['pattern_type'],
                    description=pattern_data['description'],
                    frequency=pattern_data['frequency'],
                    recency=datetime.fromisoformat(pattern_data['recency'].replace('Z', '+00:00')),
                    confidence=pattern_data['confidence'],
                    evidence=pattern_data['evidence'],
                    tags=pattern_data['tags']
                )
                category_profile.behavior_patterns.append(pattern)

            category_profile.preferences = cat_data.get('preferences', {})
            category_profile.engagement_score = cat_data.get('engagement_score', 0.0)
            category_profile.analysis_count = cat_data.get('analysis_count', 0)

            if cat_data.get('last_analyzed'):
                category_profile.last_analyzed = datetime.fromisoformat(
                    cat_data['last_analyzed'].replace('Z', '+00:00')
                )

            profile.categories[category] = category_profile

        # Reconstruct behavioral patterns
        for pattern_data in data.get('behavioral_patterns', []):
            pattern = BehaviorPattern(
                pattern_id=pattern_data['pattern_id'],
                pattern_type=pattern_data['pattern_type'],
                description=pattern_data['description'],
                frequency=pattern_data['frequency'],
                recency=datetime.fromisoformat(pattern_data['recency'].replace('Z', '+00:00')),
                confidence=pattern_data['confidence'],
                evidence=pattern_data['evidence'],
                tags=pattern_data['tags']
            )
            profile.behavioral_patterns.append(pattern)

        # Reconstruct memories
        for memory_data in data.get('memories', []):
            memory = MemoryEntry(
                memory_id=memory_data['memory_id'],
                content=memory_data['content'],
                memory_type=memory_data['memory_type'],
                category=RecommendationCategoryType(memory_data['category']) if memory_data['category'] else None,
                created_at=datetime.fromisoformat(memory_data['created_at'].replace('Z', '+00:00')),
                accessed_count=memory_data['accessed_count'],
                importance=memory_data['importance'],
                tags=memory_data['tags'],
                context=memory_data['context']
            )

            if memory_data.get('last_accessed'):
                memory.last_accessed = datetime.fromisoformat(
                    memory_data['last_accessed'].replace('Z', '+00:00')
                )

            profile.memories.append(memory)

        return profile