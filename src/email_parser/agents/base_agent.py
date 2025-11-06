"""
AI Agent Base Classes and Mission Framework

Provides the foundation for AI agents that can access consumer profiles,
execute missions, and learn from interactions to improve recommendations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Callable, Union
from enum import Enum
from datetime import datetime, timezone
import uuid
import json
import logging

from ..models.consumer_profile import ConsumerProfile, RecommendationCategoryType, MemoryEntry
from ..utils.memory_manager import MemoryManager
from ..analysis.recommendation_category import RecommendationEngine


class MissionStatus(Enum):
    """Status of agent missions."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class MissionPriority(Enum):
    """Mission priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class AgentCapability(Enum):
    """Agent capabilities for mission matching."""
    SHOPPING_RESEARCH = "shopping_research"
    TRAVEL_PLANNING = "travel_planning"
    ENTERTAINMENT_DISCOVERY = "entertainment_discovery"
    HEALTH_MONITORING = "health_monitoring"
    RESTAURANT_FINDING = "restaurant_finding"
    RECIPE_SUGGESTION = "recipe_suggestion"
    CROSS_CATEGORY = "cross_category"
    DATA_ANALYSIS = "data_analysis"
    RECOMMENDATION_SYNTHESIS = "recommendation_synthesis"


@dataclass
class MissionObjective:
    """Specific objective within a mission."""
    objective_id: str
    description: str
    success_criteria: Dict[str, Any]
    required_data: List[str] = field(default_factory=list)
    optional_data: List[str] = field(default_factory=list)
    completion_deadline: Optional[datetime] = None
    completed: bool = False
    completion_timestamp: Optional[datetime] = None
    results: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Mission:
    """
    A specific task or goal assigned to an AI agent.

    Missions define what the agent should accomplish, what data it can access,
    and how success is measured.
    """
    mission_id: str
    title: str
    description: str
    category: RecommendationCategoryType
    priority: MissionPriority = MissionPriority.MEDIUM

    # Mission objectives
    objectives: List[MissionObjective] = field(default_factory=list)

    # Agent requirements
    required_capabilities: List[AgentCapability] = field(default_factory=list)

    # Data access permissions
    data_access: Dict[str, Any] = field(default_factory=dict)
    memory_access_level: str = "category"  # category, full, limited

    # Mission context
    context: Dict[str, Any] = field(default_factory=dict)
    user_preferences: Dict[str, Any] = field(default_factory=dict)

    # Execution tracking
    status: MissionStatus = MissionStatus.PENDING
    assigned_agent_id: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Results and learning
    results: Dict[str, Any] = field(default_factory=dict)
    success_metrics: Dict[str, float] = field(default_factory=dict)
    lessons_learned: List[str] = field(default_factory=list)

    def add_objective(self, description: str, success_criteria: Dict[str, Any],
                     required_data: List[str] = None, deadline: datetime = None) -> str:
        """Add a new objective to the mission."""
        objective_id = str(uuid.uuid4())
        objective = MissionObjective(
            objective_id=objective_id,
            description=description,
            success_criteria=success_criteria,
            required_data=required_data or [],
            completion_deadline=deadline
        )
        self.objectives.append(objective)
        return objective_id

    def complete_objective(self, objective_id: str, results: Dict[str, Any]) -> bool:
        """Mark an objective as completed with results."""
        for objective in self.objectives:
            if objective.objective_id == objective_id:
                objective.completed = True
                objective.completion_timestamp = datetime.now(timezone.utc)
                objective.results = results
                return True
        return False

    def get_progress(self) -> float:
        """Get mission completion progress (0.0 to 1.0)."""
        if not self.objectives:
            return 0.0
        completed = sum(1 for obj in self.objectives if obj.completed)
        return completed / len(self.objectives)

    def is_complete(self) -> bool:
        """Check if all objectives are completed."""
        return all(obj.completed for obj in self.objectives)


@dataclass
class AgentMemoryContext:
    """Context for agent memory access."""
    profile_access: ConsumerProfile
    category_memories: List[MemoryEntry]
    cross_category_memories: List[MemoryEntry]
    recent_interactions: List[Dict[str, Any]]
    learned_preferences: Dict[str, Any]


class AIAgent(ABC):
    """
    Abstract base class for AI agents that can execute missions
    using consumer profiles and memory systems.
    """

    def __init__(self, agent_id: str, name: str, capabilities: List[AgentCapability],
                 memory_manager: MemoryManager, recommendation_engine: RecommendationEngine,
                 logger: Optional[logging.Logger] = None):
        """
        Initialize AI agent.

        Args:
            agent_id: Unique agent identifier
            name: Human-readable agent name
            capabilities: List of agent capabilities
            memory_manager: Memory manager for profile access
            recommendation_engine: Recommendation engine access
            logger: Optional logger instance
        """
        self.agent_id = agent_id
        self.name = name
        self.capabilities = capabilities
        self.memory_manager = memory_manager
        self.recommendation_engine = recommendation_engine
        self.logger = logger or logging.getLogger(__name__)

        # Agent state
        self.current_missions: Dict[str, Mission] = {}
        self.completed_missions: List[Mission] = []
        self.agent_memory: Dict[str, Any] = {}
        self.performance_metrics: Dict[str, float] = {
            "missions_completed": 0,
            "success_rate": 0.0,
            "average_completion_time": 0.0,
            "user_satisfaction": 0.0
        }

        # Learning state
        self.learned_patterns: Dict[str, Any] = {}
        self.user_feedback_history: List[Dict[str, Any]] = []

    def can_handle_mission(self, mission: Mission) -> bool:
        """Check if agent can handle the given mission."""
        # Check capability requirements
        required_caps = set(mission.required_capabilities)
        agent_caps = set(self.capabilities)

        return required_caps.issubset(agent_caps)

    def assign_mission(self, mission: Mission) -> bool:
        """Assign a mission to this agent."""
        if not self.can_handle_mission(mission):
            self.logger.warning(f"Agent {self.name} cannot handle mission {mission.title}")
            return False

        mission.assigned_agent_id = self.agent_id
        mission.status = MissionStatus.PENDING
        self.current_missions[mission.mission_id] = mission

        self.logger.info(f"Mission '{mission.title}' assigned to agent {self.name}")
        return True

    def execute_mission(self, mission_id: str, profile_id: str) -> Dict[str, Any]:
        """
        Execute a specific mission using consumer profile.

        Args:
            mission_id: ID of mission to execute
            profile_id: ID of consumer profile to use

        Returns:
            Dictionary with execution results
        """
        if mission_id not in self.current_missions:
            return {"success": False, "error": "Mission not found"}

        mission = self.current_missions[mission_id]

        try:
            # Load consumer profile
            profile = self.memory_manager.load_profile(profile_id)
            if not profile:
                return {"success": False, "error": "Profile not found"}

            # Prepare memory context
            memory_context = self._prepare_memory_context(mission, profile)

            # Execute mission
            mission.status = MissionStatus.IN_PROGRESS
            mission.started_at = datetime.now(timezone.utc)

            results = self._execute_mission_logic(mission, memory_context)

            # Update mission status
            if results.get("success", False):
                mission.status = MissionStatus.COMPLETED
                mission.completed_at = datetime.now(timezone.utc)
                mission.results = results

                # Move to completed missions
                self.completed_missions.append(mission)
                del self.current_missions[mission_id]

                # Update performance metrics
                self._update_performance_metrics(mission, results)

                # Store learnings
                self._store_mission_learnings(mission, results, profile)

            else:
                mission.status = MissionStatus.FAILED

            return results

        except Exception as e:
            self.logger.error(f"Mission execution failed: {e}")
            mission.status = MissionStatus.FAILED
            return {"success": False, "error": str(e)}

    @abstractmethod
    def _execute_mission_logic(self, mission: Mission,
                              memory_context: AgentMemoryContext) -> Dict[str, Any]:
        """
        Execute the core mission logic. Must be implemented by subclasses.

        Args:
            mission: Mission to execute
            memory_context: Memory context with profile and history

        Returns:
            Dictionary with execution results
        """
        pass

    def _prepare_memory_context(self, mission: Mission, profile: ConsumerProfile) -> AgentMemoryContext:
        """Prepare memory context for mission execution."""
        # Get category-specific memories
        category_memories = profile.get_memories_by_category(mission.category)

        # Get cross-category memories if allowed
        cross_category_memories = []
        if mission.memory_access_level in ["full", "cross_category"]:
            cross_category_memories = [
                memory for memory in profile.memories
                if memory.category != mission.category or memory.category is None
            ]

        # Get recent interactions
        recent_memories = profile.get_recent_memories(days=30)

        return AgentMemoryContext(
            profile_access=profile,
            category_memories=category_memories,
            cross_category_memories=cross_category_memories,
            recent_interactions=[],  # TODO: Implement interaction history
            learned_preferences=self.learned_patterns.get(mission.category.value, {})
        )

    def _update_performance_metrics(self, mission: Mission, results: Dict[str, Any]) -> None:
        """Update agent performance metrics based on mission results."""
        self.performance_metrics["missions_completed"] += 1

        # Calculate success rate
        total_missions = len(self.completed_missions)
        successful_missions = sum(
            1 for m in self.completed_missions
            if m.status == MissionStatus.COMPLETED
        )
        self.performance_metrics["success_rate"] = successful_missions / total_missions if total_missions > 0 else 0

        # Calculate average completion time
        completion_times = [
            (m.completed_at - m.started_at).total_seconds() / 60  # Minutes
            for m in self.completed_missions
            if m.started_at and m.completed_at
        ]
        if completion_times:
            self.performance_metrics["average_completion_time"] = sum(completion_times) / len(completion_times)

    def _store_mission_learnings(self, mission: Mission, results: Dict[str, Any],
                               profile: ConsumerProfile) -> None:
        """Store learnings from mission execution."""
        # Store in agent memory
        learning_key = f"{mission.category.value}_patterns"
        if learning_key not in self.learned_patterns:
            self.learned_patterns[learning_key] = {}

        # Extract patterns from results
        if "insights" in results:
            for insight in results["insights"]:
                pattern_key = f"{insight.get('type', 'general')}_preference"
                self.learned_patterns[learning_key][pattern_key] = {
                    "strength": insight.get("confidence", 0.5),
                    "evidence": insight.get("evidence", []),
                    "last_updated": datetime.now(timezone.utc).isoformat()
                }

        # Store in consumer profile memory
        memory_content = f"Agent {self.name} completed mission: {mission.title}. Key insights: {results.get('summary', 'No summary available')}"
        profile.add_memory(
            content=memory_content,
            memory_type="episodic",
            category=mission.category,
            importance=0.7,
            tags=["agent_mission", "recommendation", mission.category.value],
            context={
                "agent_id": self.agent_id,
                "mission_id": mission.mission_id,
                "success": results.get("success", False)
            }
        )

    def get_mission_status(self, mission_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific mission."""
        # Check current missions
        if mission_id in self.current_missions:
            mission = self.current_missions[mission_id]
            return {
                "mission_id": mission.mission_id,
                "title": mission.title,
                "status": mission.status.value,
                "progress": mission.get_progress(),
                "created_at": mission.created_at.isoformat(),
                "started_at": mission.started_at.isoformat() if mission.started_at else None
            }

        # Check completed missions
        for mission in self.completed_missions:
            if mission.mission_id == mission_id:
                return {
                    "mission_id": mission.mission_id,
                    "title": mission.title,
                    "status": mission.status.value,
                    "progress": 1.0,
                    "created_at": mission.created_at.isoformat(),
                    "started_at": mission.started_at.isoformat() if mission.started_at else None,
                    "completed_at": mission.completed_at.isoformat() if mission.completed_at else None,
                    "results": mission.results
                }

        return None

    def process_user_feedback(self, mission_id: str, feedback: Dict[str, Any]) -> None:
        """Process user feedback on mission results."""
        feedback_entry = {
            "mission_id": mission_id,
            "feedback": feedback,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent_id": self.agent_id
        }

        self.user_feedback_history.append(feedback_entry)

        # Update user satisfaction metric
        if "satisfaction" in feedback:
            satisfaction_scores = [
                f["feedback"]["satisfaction"]
                for f in self.user_feedback_history
                if "satisfaction" in f["feedback"]
            ]
            self.performance_metrics["user_satisfaction"] = sum(satisfaction_scores) / len(satisfaction_scores)

        # Learn from feedback
        self._learn_from_feedback(feedback_entry)

    def _learn_from_feedback(self, feedback_entry: Dict[str, Any]) -> None:
        """Learn from user feedback to improve future performance."""
        feedback = feedback_entry["feedback"]

        # If user liked the recommendations, strengthen similar patterns
        if feedback.get("liked_recommendations"):
            for rec in feedback["liked_recommendations"]:
                pattern_key = f"preferred_{rec.get('type', 'general')}"
                if pattern_key not in self.agent_memory:
                    self.agent_memory[pattern_key] = 0.5
                self.agent_memory[pattern_key] = min(1.0, self.agent_memory[pattern_key] + 0.1)

        # If user disliked recommendations, weaken patterns
        if feedback.get("disliked_recommendations"):
            for rec in feedback["disliked_recommendations"]:
                pattern_key = f"preferred_{rec.get('type', 'general')}"
                if pattern_key not in self.agent_memory:
                    self.agent_memory[pattern_key] = 0.5
                self.agent_memory[pattern_key] = max(0.0, self.agent_memory[pattern_key] - 0.1)

    def get_agent_status(self) -> Dict[str, Any]:
        """Get comprehensive agent status."""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "capabilities": [cap.value for cap in self.capabilities],
            "current_missions": len(self.current_missions),
            "completed_missions": len(self.completed_missions),
            "performance_metrics": self.performance_metrics,
            "learned_patterns_count": sum(len(patterns) for patterns in self.learned_patterns.values()),
            "feedback_history_count": len(self.user_feedback_history)
        }


class MissionController:
    """
    Controller for managing missions and agent assignments.

    Handles mission queuing, agent selection, and coordination between
    multiple agents working on related missions.
    """

    def __init__(self, memory_manager: MemoryManager, recommendation_engine: RecommendationEngine):
        """Initialize mission controller."""
        self.memory_manager = memory_manager
        self.recommendation_engine = recommendation_engine
        self.logger = logging.getLogger(__name__)

        # Mission and agent management
        self.agents: Dict[str, AIAgent] = {}
        self.mission_queue: List[Mission] = []
        self.active_missions: Dict[str, Mission] = {}
        self.completed_missions: List[Mission] = []

    def register_agent(self, agent: AIAgent) -> None:
        """Register an agent with the controller."""
        self.agents[agent.agent_id] = agent
        self.logger.info(f"Registered agent: {agent.name} ({agent.agent_id})")

    def create_mission(self, title: str, description: str, category: RecommendationCategoryType,
                      objectives: List[Dict[str, Any]], priority: MissionPriority = MissionPriority.MEDIUM,
                      required_capabilities: List[AgentCapability] = None) -> str:
        """Create a new mission."""
        mission_id = str(uuid.uuid4())
        mission = Mission(
            mission_id=mission_id,
            title=title,
            description=description,
            category=category,
            priority=priority,
            required_capabilities=required_capabilities or []
        )

        # Add objectives
        for obj_data in objectives:
            mission.add_objective(
                description=obj_data["description"],
                success_criteria=obj_data.get("success_criteria", {}),
                required_data=obj_data.get("required_data", []),
                deadline=obj_data.get("deadline")
            )

        self.mission_queue.append(mission)
        self.logger.info(f"Created mission: {title} ({mission_id})")
        return mission_id

    def assign_mission(self, mission_id: str, agent_id: str = None) -> bool:
        """Assign mission to agent (automatic selection if agent_id not provided)."""
        # Find mission in queue
        mission = None
        for i, m in enumerate(self.mission_queue):
            if m.mission_id == mission_id:
                mission = self.mission_queue.pop(i)
                break

        if not mission:
            self.logger.error(f"Mission {mission_id} not found in queue")
            return False

        # Select agent
        if agent_id:
            if agent_id not in self.agents:
                self.logger.error(f"Agent {agent_id} not found")
                return False
            agent = self.agents[agent_id]
        else:
            agent = self._select_best_agent(mission)
            if not agent:
                self.logger.error(f"No suitable agent found for mission {mission_id}")
                # Put mission back in queue
                self.mission_queue.append(mission)
                return False

        # Assign mission
        if agent.assign_mission(mission):
            self.active_missions[mission_id] = mission
            return True
        else:
            # Put mission back in queue
            self.mission_queue.append(mission)
            return False

    def _select_best_agent(self, mission: Mission) -> Optional[AIAgent]:
        """Select the best agent for a mission based on capabilities and performance."""
        suitable_agents = [
            agent for agent in self.agents.values()
            if agent.can_handle_mission(mission)
        ]

        if not suitable_agents:
            return None

        # Score agents based on various factors
        best_agent = None
        best_score = -1

        for agent in suitable_agents:
            score = 0

            # Capability match score
            required_caps = set(mission.required_capabilities)
            agent_caps = set(agent.capabilities)
            capability_overlap = len(required_caps.intersection(agent_caps))
            score += capability_overlap * 10

            # Performance score
            score += agent.performance_metrics["success_rate"] * 5
            score += (5.0 - agent.performance_metrics.get("user_satisfaction", 2.5)) * 2

            # Workload score (prefer less busy agents)
            current_workload = len(agent.current_missions)
            score += max(0, 5 - current_workload)

            # Category experience score
            category_missions = sum(
                1 for m in agent.completed_missions
                if m.category == mission.category
            )
            score += min(category_missions, 3)  # Cap at 3 points

            if score > best_score:
                best_score = score
                best_agent = agent

        return best_agent

    def execute_mission(self, mission_id: str, profile_id: str) -> Dict[str, Any]:
        """Execute a mission through its assigned agent."""
        if mission_id not in self.active_missions:
            return {"success": False, "error": "Mission not active"}

        mission = self.active_missions[mission_id]
        agent_id = mission.assigned_agent_id

        if not agent_id or agent_id not in self.agents:
            return {"success": False, "error": "No agent assigned"}

        agent = self.agents[agent_id]
        results = agent.execute_mission(mission_id, profile_id)

        # Move completed mission
        if mission.status in [MissionStatus.COMPLETED, MissionStatus.FAILED]:
            self.completed_missions.append(mission)
            if mission_id in self.active_missions:
                del self.active_missions[mission_id]

        return results

    def get_mission_status(self, mission_id: str) -> Optional[Dict[str, Any]]:
        """Get status of any mission (queued, active, or completed)."""
        # Check queued missions
        for mission in self.mission_queue:
            if mission.mission_id == mission_id:
                return {
                    "mission_id": mission.mission_id,
                    "title": mission.title,
                    "status": "queued",
                    "progress": 0.0,
                    "created_at": mission.created_at.isoformat()
                }

        # Check active missions
        if mission_id in self.active_missions:
            mission = self.active_missions[mission_id]
            agent = self.agents.get(mission.assigned_agent_id)
            if agent:
                return agent.get_mission_status(mission_id)

        # Check completed missions
        for mission in self.completed_missions:
            if mission.mission_id == mission_id:
                return {
                    "mission_id": mission.mission_id,
                    "title": mission.title,
                    "status": mission.status.value,
                    "progress": 1.0,
                    "created_at": mission.created_at.isoformat(),
                    "started_at": mission.started_at.isoformat() if mission.started_at else None,
                    "completed_at": mission.completed_at.isoformat() if mission.completed_at else None
                }

        return None

    def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status."""
        return {
            "agents": {
                agent_id: agent.get_agent_status()
                for agent_id, agent in self.agents.items()
            },
            "missions": {
                "queued": len(self.mission_queue),
                "active": len(self.active_missions),
                "completed": len(self.completed_missions)
            },
            "queue_by_priority": {
                priority.value: sum(1 for m in self.mission_queue if m.priority == priority)
                for priority in MissionPriority
            }
        }