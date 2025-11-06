"""
Memory backend implementations.

Provides different storage backends for persistent memory:
- SQLiteStore: File-based storage (default, zero setup)
- PostgresStore: Production database (requires PostgreSQL server)
- InMemoryStore: Temporary storage (for testing)
"""

from .sqlite_store import SQLiteStore

__all__ = ['SQLiteStore']
