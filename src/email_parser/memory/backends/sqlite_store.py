"""
SQLite-based store compatible with LangMem interface.

Provides persistent storage for memory without requiring external database setup.
Data stored in single SQLite file for easy backup and portability.
"""

import sqlite3
import json
import os
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class MemoryItem:
    """Memory item wrapper to match LangMem InMemoryStore interface."""
    key: str
    value: Dict[str, Any]
    namespace: Tuple[str, ...]


class SQLiteStore:
    """
    SQLite-based memory store compatible with LangMem interface.

    This provides a lightweight, file-based persistent storage alternative
    to PostgreSQL, with zero setup required.

    Example:
        >>> store = SQLiteStore("data/memories.db")
        >>> store.put(("users", "user_123"), "pref_theme", {"value": "dark"})
        >>> result = store.get(("users", "user_123"), "pref_theme")
        >>> print(result)
        {'value': 'dark'}
    """

    def __init__(self, db_path: str = "data/email_parser_memory.db"):
        """
        Initialize SQLite store.

        Args:
            db_path: Path to SQLite database file. Parent directory will be
                    created if it doesn't exist.
        """
        self.db_path = db_path

        # Ensure parent directory exists
        db_dir = Path(db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)

        # Initialize database schema
        self._setup_database()

        logger.info(f"SQLite memory store initialized: {db_path}")

    def _setup_database(self):
        """Initialize database schema if not exists."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Create memories table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                namespace TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create indexes for fast lookups
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_namespace ON memories(namespace)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_key ON memories(key)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_namespace_key ON memories(namespace, key)"
        )

        conn.commit()
        conn.close()

    def put(
        self,
        namespace: Tuple[str, ...],
        key: str,
        value: Dict[str, Any]
    ) -> None:
        """
        Store a memory.

        Args:
            namespace: Tuple of strings representing the namespace hierarchy
                      (e.g., ("users", "user_123"))
            key: Memory key within the namespace
            value: Memory value (dict will be JSON serialized)

        Example:
            >>> store.put(("users", "alice"), "interests", {"tech": 0.9})
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Convert namespace tuple to string
            namespace_str = "/".join(namespace)
            memory_id = f"{namespace_str}_{key}"

            # Serialize value to JSON
            value_json = json.dumps(value)

            # Insert or replace memory
            cursor.execute("""
                INSERT OR REPLACE INTO memories (id, namespace, key, value, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (memory_id, namespace_str, key, value_json))

            conn.commit()

            logger.debug(f"Stored memory: {memory_id}")

        except Exception as e:
            logger.error(f"Failed to store memory {key}: {e}")
            raise
        finally:
            conn.close()

    def get(
        self,
        namespace: Tuple[str, ...],
        key: str
    ) -> Optional[MemoryItem]:
        """
        Retrieve a memory.

        Args:
            namespace: Tuple of strings representing the namespace hierarchy
            key: Memory key to retrieve

        Returns:
            MemoryItem with .value attribute, or None if not found

        Example:
            >>> result = store.get(("users", "alice"), "interests")
            >>> print(result.value)
            {'tech': 0.9}
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            namespace_str = "/".join(namespace)
            memory_id = f"{namespace_str}_{key}"

            cursor.execute(
                "SELECT value FROM memories WHERE id = ?",
                (memory_id,)
            )

            row = cursor.fetchone()

            if row:
                value = json.loads(row[0])
                return MemoryItem(key=key, value=value, namespace=namespace)

            return None

        except Exception as e:
            logger.error(f"Failed to get memory {key}: {e}")
            raise
        finally:
            conn.close()

    def search(
        self,
        namespace: Tuple[str, ...]
    ) -> List[MemoryItem]:
        """
        Search memories by namespace.

        Args:
            namespace: Tuple of strings representing the namespace to search

        Returns:
            List of MemoryItem objects

        Example:
            >>> results = store.search(("users", "alice"))
            >>> for item in results:
            ...     print(f"{item.key}: {item.value}")
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            namespace_str = "/".join(namespace)

            cursor.execute(
                "SELECT key, value FROM memories WHERE namespace = ?",
                (namespace_str,)
            )

            results = []
            for row in cursor.fetchall():
                key = row[0]
                value = json.loads(row[1])
                results.append(MemoryItem(key=key, value=value, namespace=namespace))

            logger.debug(f"Found {len(results)} memories in namespace {namespace_str}")

            return results

        except Exception as e:
            logger.error(f"Failed to search namespace {namespace}: {e}")
            raise
        finally:
            conn.close()

    def delete(
        self,
        namespace: Tuple[str, ...],
        key: str
    ) -> bool:
        """
        Delete a memory.

        Args:
            namespace: Tuple of strings representing the namespace
            key: Memory key to delete

        Returns:
            True if deleted, False if not found
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            namespace_str = "/".join(namespace)
            memory_id = f"{namespace_str}_{key}"

            cursor.execute(
                "DELETE FROM memories WHERE id = ?",
                (memory_id,)
            )

            conn.commit()
            deleted = cursor.rowcount > 0

            if deleted:
                logger.debug(f"Deleted memory: {memory_id}")

            return deleted

        except Exception as e:
            logger.error(f"Failed to delete memory {key}: {e}")
            raise
        finally:
            conn.close()

    def list_namespaces(self) -> List[str]:
        """
        List all unique namespaces.

        Returns:
            List of namespace strings
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            cursor.execute("SELECT DISTINCT namespace FROM memories")
            namespaces = [row[0] for row in cursor.fetchall()]
            return namespaces

        except Exception as e:
            logger.error(f"Failed to list namespaces: {e}")
            raise
        finally:
            conn.close()

    def count(self, namespace: Optional[Tuple[str, ...]] = None) -> int:
        """
        Count memories, optionally filtered by namespace.

        Args:
            namespace: Optional namespace to filter by

        Returns:
            Count of memories
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            if namespace:
                namespace_str = "/".join(namespace)
                cursor.execute(
                    "SELECT COUNT(*) FROM memories WHERE namespace = ?",
                    (namespace_str,)
                )
            else:
                cursor.execute("SELECT COUNT(*) FROM memories")

            count = cursor.fetchone()[0]
            return count

        except Exception as e:
            logger.error(f"Failed to count memories: {e}")
            raise
        finally:
            conn.close()

    def clear(self, namespace: Optional[Tuple[str, ...]] = None) -> int:
        """
        Clear memories, optionally filtered by namespace.

        Args:
            namespace: Optional namespace to filter by. If None, clears all memories.

        Returns:
            Number of memories deleted
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            if namespace:
                namespace_str = "/".join(namespace)
                cursor.execute(
                    "DELETE FROM memories WHERE namespace = ?",
                    (namespace_str,)
                )
            else:
                cursor.execute("DELETE FROM memories")

            conn.commit()
            deleted = cursor.rowcount

            logger.info(f"Cleared {deleted} memories")

            return deleted

        except Exception as e:
            logger.error(f"Failed to clear memories: {e}")
            raise
        finally:
            conn.close()

    def get_stats(self) -> Dict[str, Any]:
        """
        Get database statistics.

        Returns:
            Dict with stats about the database
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Total memories
            cursor.execute("SELECT COUNT(*) FROM memories")
            total_memories = cursor.fetchone()[0]

            # Total namespaces
            cursor.execute("SELECT COUNT(DISTINCT namespace) FROM memories")
            total_namespaces = cursor.fetchone()[0]

            # Database file size
            db_size_bytes = Path(self.db_path).stat().st_size
            db_size_mb = db_size_bytes / (1024 * 1024)

            return {
                "total_memories": total_memories,
                "total_namespaces": total_namespaces,
                "db_size_mb": round(db_size_mb, 2),
                "db_path": self.db_path
            }

        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            raise
        finally:
            conn.close()
