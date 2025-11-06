"""
LangGraph Workflow Module

Orchestrates email analysis pipeline using LangGraph's stateful workflows.

Components:
- state.py: Workflow state schema
- graph.py: StateGraph definition and compilation
- executor.py: Workflow execution entry point
- routing.py: Conditional routing logic
- nodes/: Individual workflow nodes

Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md - LangGraph Workflow section
"""

from .state import WorkflowState
from .graph import build_workflow_graph
from .executor import (
    run_workflow,
    run_workflow_from_csv,
    get_workflow_summary,
    print_workflow_summary
)

__all__ = [
    'WorkflowState',
    'build_workflow_graph',
    'run_workflow',
    'run_workflow_from_csv',
    'get_workflow_summary',
    'print_workflow_summary',
]