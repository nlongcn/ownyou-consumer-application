#!/usr/bin/env python3
"""
Memory Store Initialization

Handles initialization of LangMem storage backends.
Supports InMemoryStore (development) and PostgresStore (production).

Reference: https://langchain-ai.github.io/langmem/
"""

from typing import Optional, Literal
from langgraph.store.memory import InMemoryStore
import logging

logger = logging.getLogger(__name__)


def initialize_memory_store(
    storage_type: Literal["inmemory", "postgres"] = "inmemory",
    enable_embeddings: bool = False,
    embed_model: str = "openai:text-embedding-3-small",
    embed_dims: int = 1536,
    postgres_connection_string: Optional[str] = None
) -> InMemoryStore:
    """
    Initialize LangMem memory store.

    Args:
        storage_type: Type of storage backend ("inmemory" or "postgres")
        enable_embeddings: Enable semantic search with embeddings (requires API key)
        embed_model: Embedding model for semantic search
        embed_dims: Embedding dimensions (1536 for OpenAI text-embedding-3-small)
        postgres_connection_string: PostgreSQL connection string (required if storage_type="postgres")

    Returns:
        Initialized memory store

    Raises:
        ValueError: If postgres storage requested without connection string

    Example:
        >>> # Development setup (no embeddings)
        >>> store = initialize_memory_store(storage_type="inmemory")

        >>> # Production setup with semantic search
        >>> store = initialize_memory_store(
        ...     storage_type="inmemory",
        ...     enable_embeddings=True
        ... )
    """
    logger.info(f"Initializing {storage_type} memory store")

    if storage_type == "inmemory":
        # InMemoryStore for development and testing
        if enable_embeddings:
            # With embeddings for semantic search
            store = InMemoryStore(
                index={
                    "dims": embed_dims,
                    "embed": embed_model,
                }
            )
            logger.info(f"InMemoryStore initialized with {embed_model} ({embed_dims} dims)")
        else:
            # Without embeddings (for basic development/testing)
            store = InMemoryStore()
            logger.info("InMemoryStore initialized without embeddings")

        return store

    elif storage_type == "postgres":
        # PostgresStore for production
        if not postgres_connection_string:
            raise ValueError(
                "postgres_connection_string required when storage_type='postgres'"
            )

        try:
            from langgraph.store.postgres import AsyncPostgresStore

            # Note: AsyncPostgresStore requires async initialization
            # For now, we'll document this and provide a synchronous wrapper
            logger.warning(
                "PostgreSQL support requires async initialization. "
                "Use initialize_async_postgres_store() for production."
            )

            # Placeholder - actual implementation needs async context
            raise NotImplementedError(
                "PostgreSQL store initialization not yet implemented. "
                "Use InMemoryStore for Phase 2 development."
            )

        except ImportError:
            logger.error("AsyncPostgresStore not available. Install langgraph[postgres]")
            raise ImportError(
                "PostgreSQL support requires: pip install langgraph[postgres]"
            )

    else:
        raise ValueError(f"Unsupported storage_type: {storage_type}")


def get_default_store() -> InMemoryStore:
    """
    Get a default InMemoryStore for quick development usage.

    Returns:
        InMemoryStore with default configuration
    """
    return initialize_memory_store(storage_type="inmemory")