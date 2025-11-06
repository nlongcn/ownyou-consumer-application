#!/usr/bin/env python3
"""
LangGraph Studio Entry Point

This module provides a graph factory function for LangGraph Studio visualization.
Studio uses this to build and display the workflow graph.

Production code should use `workflow.executor.run_workflow()` instead.
"""

from langgraph.checkpoint.sqlite import SqliteSaver
from src.email_parser.memory.manager import MemoryManager
from src.email_parser.workflow.graph import build_workflow_graph


def create_graph():
    """
    Create workflow graph for LangGraph Studio visualization.

    This is the entry point referenced in langgraph.json.
    Studio calls this function to build the graph for inspection.

    Returns:
        Compiled StateGraph with local SQLite checkpointing

    Note:
        This uses a local SQLite checkpointer for state persistence during
        Studio debugging. Production deployments should use run_workflow()
        which defaults to no checkpointing for maximum privacy.
    """
    # Create local SQLite checkpointer for Studio
    checkpointer = SqliteSaver.from_conn_string("data/studio_checkpoints.db")

    # Create memory manager with default user
    # (Studio needs a graph instance, user_id provided at runtime)
    memory_manager = MemoryManager(user_id="studio_user")

    # Build graph with checkpointing enabled
    graph = build_workflow_graph(memory_manager, checkpointer)

    return graph
