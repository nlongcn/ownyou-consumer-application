/**
 * AI Agent Base Classes and Mission Framework
 *
 * 1:1 Port of Python base_agent.py from src/email_parser/agents/base_agent.py
 *
 * Provides the foundation for AI agents that can access consumer profiles,
 * execute missions, and learn from interactions to improve recommendations.
 *
 * Python source: src/email_parser/agents/base_agent.py (lines 1-657)
 */

/**
 * Status of agent missions
 * Python source: base_agent.py:22-29 (MissionStatus)
 */
export enum MissionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

/**
 * Mission priority levels
 * Python source: base_agent.py:32-37 (MissionPriority)
 */
export enum MissionPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Agent capabilities for mission matching
 * Python source: base_agent.py:40-50 (AgentCapability)
 */
export enum AgentCapability {
  SHOPPING_RESEARCH = 'shopping_research',
  TRAVEL_PLANNING = 'travel_planning',
  ENTERTAINMENT_DISCOVERY = 'entertainment_discovery',
  HEALTH_MONITORING = 'health_monitoring',
  RESTAURANT_FINDING = 'restaurant_finding',
  RECIPE_SUGGESTION = 'recipe_suggestion',
  CROSS_CATEGORY = 'cross_category',
  DATA_ANALYSIS = 'data_analysis',
  RECOMMENDATION_SYNTHESIS = 'recommendation_synthesis',
}

/**
 * Specific objective within a mission
 * Python source: base_agent.py:53-64 (MissionObjective)
 */
export interface MissionObjective {
  objective_id: string
  description: string
  success_criteria: Record<string, any>
  required_data: string[]
  optional_data: string[]
  completion_deadline: Date | null
  completed: boolean
  completion_timestamp: Date | null
  results: Record<string, any>
}

/**
 * A specific task or goal assigned to an AI agent
 *
 * Missions define what the agent should accomplish, what data it can access,
 * and how success is measured.
 *
 * Python source: base_agent.py:67-141 (Mission)
 */
export class Mission {
  mission_id: string
  title: string
  description: string
  category: string // RecommendationCategoryType
  priority: MissionPriority

  // Mission objectives
  objectives: MissionObjective[]

  // Agent requirements
  required_capabilities: AgentCapability[]

  // Data access permissions
  data_access: Record<string, any>
  memory_access_level: string // 'category' | 'full' | 'limited'

  // Mission context
  context: Record<string, any>
  user_preferences: Record<string, any>

  // Execution tracking
  status: MissionStatus
  assigned_agent_id: string | null
  created_at: Date
  started_at: Date | null
  completed_at: Date | null

  // Results and learning
  results: Record<string, any>
  success_metrics: Record<string, number>
  lessons_learned: string[]

  constructor(data: {
    mission_id: string
    title: string
    description: string
    category: string
    priority?: MissionPriority
    required_capabilities?: AgentCapability[]
  }) {
    // Python lines 75-100
    this.mission_id = data.mission_id
    this.title = data.title
    this.description = data.description
    this.category = data.category
    this.priority = data.priority || MissionPriority.MEDIUM

    this.objectives = []
    this.required_capabilities = data.required_capabilities || []

    this.data_access = {}
    this.memory_access_level = 'category'

    this.context = {}
    this.user_preferences = {}

    this.status = MissionStatus.PENDING
    this.assigned_agent_id = null
    this.created_at = new Date()
    this.started_at = null
    this.completed_at = null

    this.results = {}
    this.success_metrics = {}
    this.lessons_learned = []
  }

  /**
   * Add a new objective to the mission
   * Python source: base_agent.py:107-119 (Mission.add_objective)
   */
  addObjective(
    description: string,
    success_criteria: Record<string, any>,
    required_data: string[] = [],
    deadline: Date | null = null
  ): string {
    const objective_id = crypto.randomUUID()
    const objective: MissionObjective = {
      objective_id,
      description,
      success_criteria,
      required_data,
      optional_data: [],
      completion_deadline: deadline,
      completed: false,
      completion_timestamp: null,
      results: {},
    }
    this.objectives.push(objective)
    return objective_id
  }

  /**
   * Mark an objective as completed with results
   * Python source: base_agent.py:121-129 (Mission.complete_objective)
   */
  completeObjective(objective_id: string, results: Record<string, any>): boolean {
    for (const objective of this.objectives) {
      if (objective.objective_id === objective_id) {
        objective.completed = true
        objective.completion_timestamp = new Date()
        objective.results = results
        return true
      }
    }
    return false
  }

  /**
   * Get mission completion progress (0.0 to 1.0)
   * Python source: base_agent.py:131-136 (Mission.get_progress)
   */
  getProgress(): number {
    if (this.objectives.length === 0) {
      return 0.0
    }
    const completed = this.objectives.filter((obj) => obj.completed).length
    return completed / this.objectives.length
  }

  /**
   * Check if all objectives are completed
   * Python source: base_agent.py:138-140 (Mission.is_complete)
   */
  isComplete(): boolean {
    return this.objectives.every((obj) => obj.completed)
  }
}

/**
 * Context for agent memory access
 * Python source: base_agent.py:143-150 (AgentMemoryContext)
 */
export interface AgentMemoryContext {
  profile_access: any // ConsumerProfile
  category_memories: any[] // MemoryEntry[]
  cross_category_memories: any[] // MemoryEntry[]
  recent_interactions: Record<string, any>[]
  learned_preferences: Record<string, any>
}

/**
 * Abstract base class for AI agents that can execute missions
 * using consumer profiles and memory systems
 *
 * Python source: base_agent.py:153-450 (AIAgent)
 */
export abstract class AIAgent {
  agent_id: string
  name: string
  capabilities: AgentCapability[]
  memory_manager: any // MemoryManager
  recommendation_engine: any // RecommendationEngine

  // Agent state
  current_missions: Map<string, Mission>
  completed_missions: Mission[]
  agent_memory: Record<string, any>
  performance_metrics: {
    missions_completed: number
    success_rate: number
    average_completion_time: number
    user_satisfaction: number
  }

  // Learning state
  learned_patterns: Record<string, any>
  user_feedback_history: Array<Record<string, any>>

  constructor(
    agent_id: string,
    name: string,
    capabilities: AgentCapability[],
    memory_manager: any,
    recommendation_engine: any
  ) {
    // Python lines 159-193
    this.agent_id = agent_id
    this.name = name
    this.capabilities = capabilities
    this.memory_manager = memory_manager
    this.recommendation_engine = recommendation_engine

    this.current_missions = new Map()
    this.completed_missions = []
    this.agent_memory = {}
    this.performance_metrics = {
      missions_completed: 0,
      success_rate: 0.0,
      average_completion_time: 0.0,
      user_satisfaction: 0.0,
    }

    this.learned_patterns = {}
    this.user_feedback_history = []
  }

  /**
   * Check if agent can handle the given mission
   * Python source: base_agent.py:195-201 (AIAgent.can_handle_mission)
   */
  canHandleMission(mission: Mission): boolean {
    const required_caps = new Set(mission.required_capabilities)
    const agent_caps = new Set(this.capabilities)

    return Array.from(required_caps).every((cap) => agent_caps.has(cap))
  }

  /**
   * Assign a mission to this agent
   * Python source: base_agent.py:203-214 (AIAgent.assign_mission)
   */
  assignMission(mission: Mission): boolean {
    if (!this.canHandleMission(mission)) {
      console.warn(`Agent ${this.name} cannot handle mission ${mission.title}`)
      return false
    }

    mission.assigned_agent_id = this.agent_id
    mission.status = MissionStatus.PENDING
    this.current_missions.set(mission.mission_id, mission)

    console.info(`Mission '${mission.title}' assigned to agent ${this.name}`)
    return true
  }

  /**
   * Execute a specific mission using consumer profile
   * Python source: base_agent.py:216-271 (AIAgent.execute_mission)
   */
  async executeMission(mission_id: string, profile_id: string): Promise<Record<string, any>> {
    if (!this.current_missions.has(mission_id)) {
      return { success: false, error: 'Mission not found' }
    }

    const mission = this.current_missions.get(mission_id)!

    try {
      // Load consumer profile
      const profile = await this.memory_manager.loadProfile(profile_id)
      if (!profile) {
        return { success: false, error: 'Profile not found' }
      }

      // Prepare memory context
      const memory_context = this._prepareMemoryContext(mission, profile)

      // Execute mission
      mission.status = MissionStatus.IN_PROGRESS
      mission.started_at = new Date()

      const results = await this._executeMissionLogic(mission, memory_context)

      // Update mission status
      if (results.success) {
        mission.status = MissionStatus.COMPLETED
        mission.completed_at = new Date()
        mission.results = results

        // Move to completed missions
        this.completed_missions.push(mission)
        this.current_missions.delete(mission_id)

        // Update performance metrics
        this._updatePerformanceMetrics(mission, results)

        // Store learnings
        this._storeMissionLearnings(mission, results, profile)
      } else {
        mission.status = MissionStatus.FAILED
      }

      return results
    } catch (error) {
      console.error(`Mission execution failed: ${error}`)
      mission.status = MissionStatus.FAILED
      return { success: false, error: String(error) }
    }
  }

  /**
   * Execute the core mission logic
   * Must be implemented by subclasses
   *
   * Python source: base_agent.py:273-286 (AIAgent._execute_mission_logic)
   */
  protected abstract _executeMissionLogic(
    mission: Mission,
    memory_context: AgentMemoryContext
  ): Promise<Record<string, any>>

  /**
   * Prepare memory context for mission execution
   * Python source: base_agent.py:288-310 (AIAgent._prepare_memory_context)
   */
  protected _prepareMemoryContext(mission: Mission, profile: any): AgentMemoryContext {
    // Get category-specific memories
    const category_memories = profile.getMemoriesByCategory(mission.category)

    // Get cross-category memories if allowed
    let cross_category_memories: any[] = []
    if (['full', 'cross_category'].includes(mission.memory_access_level)) {
      cross_category_memories = profile.memories.filter(
        (memory: any) => memory.category !== mission.category || memory.category === null
      )
    }

    // Get recent interactions
    const recent_memories = profile.getRecentMemories(30)

    return {
      profile_access: profile,
      category_memories,
      cross_category_memories,
      recent_interactions: [], // TODO: Implement interaction history
      learned_preferences: this.learned_patterns[mission.category] || {},
    }
  }

  /**
   * Update agent performance metrics based on mission results
   * Python source: base_agent.py:312-331 (AIAgent._update_performance_metrics)
   */
  protected _updatePerformanceMetrics(mission: Mission, results: Record<string, any>): void {
    this.performance_metrics.missions_completed += 1

    // Calculate success rate
    const total_missions = this.completed_missions.length
    const successful_missions = this.completed_missions.filter(
      (m) => m.status === MissionStatus.COMPLETED
    ).length
    this.performance_metrics.success_rate =
      total_missions > 0 ? successful_missions / total_missions : 0

    // Calculate average completion time
    const completion_times = this.completed_missions
      .filter((m) => m.started_at && m.completed_at)
      .map((m) => {
        const duration = m.completed_at!.getTime() - m.started_at!.getTime()
        return duration / 60000 // Minutes
      })

    if (completion_times.length > 0) {
      this.performance_metrics.average_completion_time =
        completion_times.reduce((a, b) => a + b, 0) / completion_times.length
    }
  }

  /**
   * Store learnings from mission execution
   * Python source: base_agent.py:333-364 (AIAgent._store_mission_learnings)
   */
  protected _storeMissionLearnings(
    mission: Mission,
    results: Record<string, any>,
    profile: any
  ): void {
    // Store in agent memory
    const learning_key = `${mission.category}_patterns`
    if (!this.learned_patterns[learning_key]) {
      this.learned_patterns[learning_key] = {}
    }

    // Extract patterns from results
    if (results.insights) {
      for (const insight of results.insights) {
        const pattern_key = `${insight.type || 'general'}_preference`
        this.learned_patterns[learning_key][pattern_key] = {
          strength: insight.confidence || 0.5,
          evidence: insight.evidence || [],
          last_updated: new Date().toISOString(),
        }
      }
    }

    // Store in consumer profile memory
    const memory_content = `Agent ${this.name} completed mission: ${mission.title}. Key insights: ${results.summary || 'No summary available'}`
    profile.addMemory({
      content: memory_content,
      memory_type: 'episodic',
      category: mission.category,
      importance: 0.7,
      tags: ['agent_mission', 'recommendation', mission.category],
      context: {
        agent_id: this.agent_id,
        mission_id: mission.mission_id,
        success: results.success || false,
      },
    })
  }

  /**
   * Get status of a specific mission
   * Python source: base_agent.py:366-394 (AIAgent.get_mission_status)
   */
  getMissionStatus(mission_id: string): Record<string, any> | null {
    // Check current missions
    if (this.current_missions.has(mission_id)) {
      const mission = this.current_missions.get(mission_id)!
      return {
        mission_id: mission.mission_id,
        title: mission.title,
        status: mission.status,
        progress: mission.getProgress(),
        created_at: mission.created_at.toISOString(),
        started_at: mission.started_at ? mission.started_at.toISOString() : null,
      }
    }

    // Check completed missions
    for (const mission of this.completed_missions) {
      if (mission.mission_id === mission_id) {
        return {
          mission_id: mission.mission_id,
          title: mission.title,
          status: mission.status,
          progress: 1.0,
          created_at: mission.created_at.toISOString(),
          started_at: mission.started_at ? mission.started_at.toISOString() : null,
          completed_at: mission.completed_at ? mission.completed_at.toISOString() : null,
          results: mission.results,
        }
      }
    }

    return null
  }

  /**
   * Process user feedback on mission results
   * Python source: base_agent.py:396-417 (AIAgent.process_user_feedback)
   */
  processUserFeedback(mission_id: string, feedback: Record<string, any>): void {
    const feedback_entry = {
      mission_id,
      feedback,
      timestamp: new Date().toISOString(),
      agent_id: this.agent_id,
    }

    this.user_feedback_history.push(feedback_entry)

    // Update user satisfaction metric
    if (feedback.satisfaction !== undefined) {
      const satisfaction_scores = this.user_feedback_history
        .map((f) => f.feedback.satisfaction)
        .filter((s) => s !== undefined)

      this.performance_metrics.user_satisfaction =
        satisfaction_scores.reduce((a, b) => a + b, 0) / satisfaction_scores.length
    }

    // Learn from feedback
    this._learnFromFeedback(feedback_entry)
  }

  /**
   * Learn from user feedback to improve future performance
   * Python source: base_agent.py:419-437 (AIAgent._learn_from_feedback)
   */
  protected _learnFromFeedback(feedback_entry: Record<string, any>): void {
    const feedback = feedback_entry.feedback

    // If user liked the recommendations, strengthen similar patterns
    if (feedback.liked_recommendations) {
      for (const rec of feedback.liked_recommendations) {
        const pattern_key = `preferred_${rec.type || 'general'}`
        if (!(pattern_key in this.agent_memory)) {
          this.agent_memory[pattern_key] = 0.5
        }
        this.agent_memory[pattern_key] = Math.min(1.0, this.agent_memory[pattern_key] + 0.1)
      }
    }

    // If user disliked recommendations, weaken patterns
    if (feedback.disliked_recommendations) {
      for (const rec of feedback.disliked_recommendations) {
        const pattern_key = `preferred_${rec.type || 'general'}`
        if (!(pattern_key in this.agent_memory)) {
          this.agent_memory[pattern_key] = 0.5
        }
        this.agent_memory[pattern_key] = Math.max(0.0, this.agent_memory[pattern_key] - 0.1)
      }
    }
  }

  /**
   * Get comprehensive agent status
   * Python source: base_agent.py:439-450 (AIAgent.get_agent_status)
   */
  getAgentStatus(): Record<string, any> {
    return {
      agent_id: this.agent_id,
      name: this.name,
      capabilities: this.capabilities,
      current_missions: this.current_missions.size,
      completed_missions: this.completed_missions.length,
      performance_metrics: this.performance_metrics,
      learned_patterns_count: Object.values(this.learned_patterns).reduce(
        (sum, patterns: any) => sum + Object.keys(patterns).length,
        0
      ),
      feedback_history_count: this.user_feedback_history.length,
    }
  }
}

/**
 * Controller for managing missions and agent assignments
 *
 * Handles mission queuing, agent selection, and coordination between
 * multiple agents working on related missions.
 *
 * Python source: base_agent.py:453-657 (MissionController)
 */
export class MissionController {
  memory_manager: any
  recommendation_engine: any

  // Mission and agent management
  agents: Map<string, AIAgent>
  mission_queue: Mission[]
  active_missions: Map<string, Mission>
  completed_missions: Mission[]

  constructor(memory_manager: any, recommendation_engine: any) {
    // Python lines 461-471
    this.memory_manager = memory_manager
    this.recommendation_engine = recommendation_engine

    this.agents = new Map()
    this.mission_queue = []
    this.active_missions = new Map()
    this.completed_missions = []
  }

  /**
   * Register an agent with the controller
   * Python source: base_agent.py:473-476 (MissionController.register_agent)
   */
  registerAgent(agent: AIAgent): void {
    this.agents.set(agent.agent_id, agent)
    console.info(`Registered agent: ${agent.name} (${agent.agent_id})`)
  }

  /**
   * Create a new mission
   * Python source: base_agent.py:478-503 (MissionController.create_mission)
   */
  createMission(
    title: string,
    description: string,
    category: string,
    objectives: Array<Record<string, any>>,
    priority: MissionPriority = MissionPriority.MEDIUM,
    required_capabilities: AgentCapability[] = []
  ): string {
    const mission_id = crypto.randomUUID()
    const mission = new Mission({
      mission_id,
      title,
      description,
      category,
      priority,
      required_capabilities,
    })

    // Add objectives
    for (const obj_data of objectives) {
      mission.addObjective(
        obj_data.description,
        obj_data.success_criteria || {},
        obj_data.required_data || [],
        obj_data.deadline || null
      )
    }

    this.mission_queue.push(mission)
    console.info(`Created mission: ${title} (${mission_id})`)
    return mission_id
  }

  /**
   * Assign mission to agent (automatic selection if agent_id not provided)
   * Python source: base_agent.py:505-539 (MissionController.assign_mission)
   */
  assignMission(mission_id: string, agent_id: string | null = null): boolean {
    // Find mission in queue
    const mission_index = this.mission_queue.findIndex((m) => m.mission_id === mission_id)
    if (mission_index === -1) {
      console.error(`Mission ${mission_id} not found in queue`)
      return false
    }

    const mission = this.mission_queue.splice(mission_index, 1)[0]

    // Select agent
    let agent: AIAgent | null = null
    if (agent_id) {
      agent = this.agents.get(agent_id) || null
      if (!agent) {
        console.error(`Agent ${agent_id} not found`)
        this.mission_queue.push(mission)
        return false
      }
    } else {
      agent = this._selectBestAgent(mission)
      if (!agent) {
        console.error(`No suitable agent found for mission ${mission_id}`)
        this.mission_queue.push(mission)
        return false
      }
    }

    // Assign mission
    if (agent.assignMission(mission)) {
      this.active_missions.set(mission_id, mission)
      return true
    } else {
      this.mission_queue.push(mission)
      return false
    }
  }

  /**
   * Select the best agent for a mission based on capabilities and performance
   * Python source: base_agent.py:541-583 (MissionController._select_best_agent)
   */
  private _selectBestAgent(mission: Mission): AIAgent | null {
    const suitable_agents = Array.from(this.agents.values()).filter((agent) =>
      agent.canHandleMission(mission)
    )

    if (suitable_agents.length === 0) {
      return null
    }

    // Score agents based on various factors
    let best_agent: AIAgent | null = null
    let best_score = -1

    for (const agent of suitable_agents) {
      let score = 0

      // Capability match score
      const required_caps = new Set(mission.required_capabilities)
      const agent_caps = new Set(agent.capabilities)
      const capability_overlap = Array.from(required_caps).filter((cap) =>
        agent_caps.has(cap)
      ).length
      score += capability_overlap * 10

      // Performance score
      score += agent.performance_metrics.success_rate * 5
      score += (5.0 - (agent.performance_metrics.user_satisfaction || 2.5)) * 2

      // Workload score (prefer less busy agents)
      const current_workload = agent.current_missions.size
      score += Math.max(0, 5 - current_workload)

      // Category experience score
      const category_missions = agent.completed_missions.filter(
        (m) => m.category === mission.category
      ).length
      score += Math.min(category_missions, 3) // Cap at 3 points

      if (score > best_score) {
        best_score = score
        best_agent = agent
      }
    }

    return best_agent
  }

  /**
   * Execute a mission through its assigned agent
   * Python source: base_agent.py:585-605 (MissionController.execute_mission)
   */
  async executeMission(mission_id: string, profile_id: string): Promise<Record<string, any>> {
    if (!this.active_missions.has(mission_id)) {
      return { success: false, error: 'Mission not active' }
    }

    const mission = this.active_missions.get(mission_id)!
    const agent_id = mission.assigned_agent_id

    if (!agent_id || !this.agents.has(agent_id)) {
      return { success: false, error: 'No agent assigned' }
    }

    const agent = this.agents.get(agent_id)!
    const results = await agent.executeMission(mission_id, profile_id)

    // Move completed mission
    if ([MissionStatus.COMPLETED, MissionStatus.FAILED].includes(mission.status)) {
      this.completed_missions.push(mission)
      this.active_missions.delete(mission_id)
    }

    return results
  }

  /**
   * Get status of any mission (queued, active, or completed)
   * Python source: base_agent.py:607-640 (MissionController.get_mission_status)
   */
  getMissionStatus(mission_id: string): Record<string, any> | null {
    // Check queued missions
    for (const mission of this.mission_queue) {
      if (mission.mission_id === mission_id) {
        return {
          mission_id: mission.mission_id,
          title: mission.title,
          status: 'queued',
          progress: 0.0,
          created_at: mission.created_at.toISOString(),
        }
      }
    }

    // Check active missions
    if (this.active_missions.has(mission_id)) {
      const mission = this.active_missions.get(mission_id)!
      const agent = this.agents.get(mission.assigned_agent_id!)
      if (agent) {
        return agent.getMissionStatus(mission_id)
      }
    }

    // Check completed missions
    for (const mission of this.completed_missions) {
      if (mission.mission_id === mission_id) {
        return {
          mission_id: mission.mission_id,
          title: mission.title,
          status: mission.status,
          progress: 1.0,
          created_at: mission.created_at.toISOString(),
          started_at: mission.started_at ? mission.started_at.toISOString() : null,
          completed_at: mission.completed_at ? mission.completed_at.toISOString() : null,
        }
      }
    }

    return null
  }

  /**
   * Get comprehensive system status
   * Python source: base_agent.py:642-657 (MissionController.get_system_status)
   */
  getSystemStatus(): Record<string, any> {
    const agents_status: Record<string, any> = {}
    for (const [agent_id, agent] of this.agents) {
      agents_status[agent_id] = agent.getAgentStatus()
    }

    const queue_by_priority: Record<string, number> = {}
    for (const priority of Object.values(MissionPriority)) {
      queue_by_priority[priority] = this.mission_queue.filter((m) => m.priority === priority).length
    }

    return {
      agents: agents_status,
      missions: {
        queued: this.mission_queue.length,
        active: this.active_missions.size,
        completed: this.completed_missions.length,
      },
      queue_by_priority,
    }
  }
}
