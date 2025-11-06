"""
Memory Manager for Consumer Profile Persistence

Handles loading, saving, and managing consumer profiles with memory optimization
and data integrity features.
"""

import json
import os
import pickle
import gzip
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timezone, timedelta
import logging
import hashlib
import threading
from contextlib import contextmanager

from ..models.consumer_profile import ConsumerProfile, RecommendationCategoryType, MemoryEntry


class MemoryManagerError(Exception):
    """Custom exception for memory manager operations."""
    pass


class ProfileCache:
    """Thread-safe in-memory cache for consumer profiles."""

    def __init__(self, max_size: int = 100, ttl_hours: int = 24):
        """
        Initialize profile cache.

        Args:
            max_size: Maximum number of profiles to cache
            ttl_hours: Time-to-live for cached profiles in hours
        """
        self.max_size = max_size
        self.ttl = timedelta(hours=ttl_hours)
        self._cache: Dict[str, tuple[ConsumerProfile, datetime]] = {}
        self._access_order: List[str] = []
        self._lock = threading.RLock()

    def get(self, profile_id: str) -> Optional[ConsumerProfile]:
        """Get profile from cache if not expired."""
        with self._lock:
            if profile_id not in self._cache:
                return None

            profile, cached_at = self._cache[profile_id]
            if datetime.now(timezone.utc) - cached_at > self.ttl:
                # Expired, remove from cache
                del self._cache[profile_id]
                if profile_id in self._access_order:
                    self._access_order.remove(profile_id)
                return None

            # Update access order
            if profile_id in self._access_order:
                self._access_order.remove(profile_id)
            self._access_order.append(profile_id)

            return profile

    def put(self, profile: ConsumerProfile) -> None:
        """Add profile to cache with LRU eviction."""
        with self._lock:
            profile_id = profile.profile_id

            # Remove if already exists
            if profile_id in self._cache:
                if profile_id in self._access_order:
                    self._access_order.remove(profile_id)

            # Add to cache
            self._cache[profile_id] = (profile, datetime.now(timezone.utc))
            self._access_order.append(profile_id)

            # Evict if over capacity
            while len(self._cache) > self.max_size and self._access_order:
                oldest = self._access_order.pop(0)
                if oldest in self._cache:
                    del self._cache[oldest]

    def remove(self, profile_id: str) -> None:
        """Remove profile from cache."""
        with self._lock:
            if profile_id in self._cache:
                del self._cache[profile_id]
            if profile_id in self._access_order:
                self._access_order.remove(profile_id)

    def clear(self) -> None:
        """Clear all cached profiles."""
        with self._lock:
            self._cache.clear()
            self._access_order.clear()

    def size(self) -> int:
        """Get current cache size."""
        with self._lock:
            return len(self._cache)


class MemoryManager:
    """
    Manages persistent storage and retrieval of consumer profiles with
    memory optimization, versioning, and backup capabilities.
    """

    def __init__(self, storage_dir: str = "consumer_profiles",
                 cache_size: int = 100, cache_ttl_hours: int = 24,
                 compression: bool = True, backup_count: int = 5):
        """
        Initialize memory manager.

        Args:
            storage_dir: Directory for profile storage
            cache_size: Maximum profiles to keep in memory
            cache_ttl_hours: Cache expiration time in hours
            compression: Whether to compress stored profiles
            backup_count: Number of backup versions to keep
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        self.compression = compression
        self.backup_count = backup_count

        # Initialize cache
        self.cache = ProfileCache(max_size=cache_size, ttl_hours=cache_ttl_hours)

        # Setup logging
        self.logger = logging.getLogger(__name__)

        # Create subdirectories
        (self.storage_dir / "profiles").mkdir(exist_ok=True)
        (self.storage_dir / "backups").mkdir(exist_ok=True)
        (self.storage_dir / "indexes").mkdir(exist_ok=True)

        # Initialize metadata
        self._load_metadata()

    def _load_metadata(self) -> None:
        """Load storage metadata."""
        metadata_path = self.storage_dir / "metadata.json"
        if metadata_path.exists():
            try:
                with open(metadata_path, 'r') as f:
                    self.metadata = json.load(f)
            except Exception as e:
                self.logger.error(f"Failed to load metadata: {e}")
                self.metadata = {}
        else:
            self.metadata = {}

        # Ensure required metadata fields
        if 'profiles' not in self.metadata:
            self.metadata['profiles'] = {}
        if 'last_cleanup' not in self.metadata:
            self.metadata['last_cleanup'] = datetime.now(timezone.utc).isoformat()

    def _save_metadata(self) -> None:
        """Save storage metadata."""
        metadata_path = self.storage_dir / "metadata.json"
        try:
            with open(metadata_path, 'w') as f:
                json.dump(self.metadata, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save metadata: {e}")

    def _get_profile_path(self, profile_id: str) -> Path:
        """Get file path for profile."""
        filename = f"{profile_id}.{'gz' if self.compression else 'json'}"
        return self.storage_dir / "profiles" / filename

    def _get_backup_path(self, profile_id: str, timestamp: datetime) -> Path:
        """Get backup file path for profile."""
        timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
        filename = f"{profile_id}_{timestamp_str}.{'gz' if self.compression else 'json'}"
        return self.storage_dir / "backups" / filename

    def _calculate_checksum(self, data: bytes) -> str:
        """Calculate MD5 checksum for data integrity."""
        return hashlib.md5(data).hexdigest()

    def save_profile(self, profile: ConsumerProfile, create_backup: bool = True) -> bool:
        """
        Save consumer profile with optional backup.

        Args:
            profile: ConsumerProfile to save
            create_backup: Whether to create backup of existing profile

        Returns:
            True if successful, False otherwise
        """
        try:
            profile_path = self._get_profile_path(profile.profile_id)

            # Create backup if requested and profile exists
            if create_backup and profile_path.exists():
                self._create_backup(profile.profile_id)

            # Serialize profile
            profile_data = profile.to_dict()
            serialized = json.dumps(profile_data, indent=2)

            # Save with or without compression
            if self.compression:
                with gzip.open(profile_path, 'wt', encoding='utf-8') as f:
                    f.write(serialized)
            else:
                with open(profile_path, 'w', encoding='utf-8') as f:
                    f.write(serialized)

            # Calculate checksum
            with open(profile_path, 'rb') as f:
                checksum = self._calculate_checksum(f.read())

            # Update metadata
            self.metadata['profiles'][profile.profile_id] = {
                'last_saved': datetime.now(timezone.utc).isoformat(),
                'file_size': profile_path.stat().st_size,
                'checksum': checksum,
                'version': getattr(profile, 'version', 1)
            }
            self._save_metadata()

            # Update cache
            self.cache.put(profile)

            self.logger.info(f"Profile {profile.profile_id} saved successfully")
            return True

        except Exception as e:
            self.logger.error(f"Failed to save profile {profile.profile_id}: {e}")
            return False

    def load_profile(self, profile_id: str, use_cache: bool = True) -> Optional[ConsumerProfile]:
        """
        Load consumer profile with cache support.

        Args:
            profile_id: ID of profile to load
            use_cache: Whether to use cached version if available

        Returns:
            ConsumerProfile or None if not found
        """
        # Try cache first
        if use_cache:
            cached_profile = self.cache.get(profile_id)
            if cached_profile:
                self.logger.debug(f"Profile {profile_id} loaded from cache")
                return cached_profile

        # Load from storage
        profile_path = self._get_profile_path(profile_id)
        if not profile_path.exists():
            self.logger.warning(f"Profile {profile_id} not found")
            return None

        try:
            # Verify checksum if metadata exists
            if profile_id in self.metadata.get('profiles', {}):
                with open(profile_path, 'rb') as f:
                    current_checksum = self._calculate_checksum(f.read())
                expected_checksum = self.metadata['profiles'][profile_id].get('checksum')
                if expected_checksum and current_checksum != expected_checksum:
                    self.logger.warning(f"Checksum mismatch for profile {profile_id}")

            # Load profile data
            if self.compression:
                with gzip.open(profile_path, 'rt', encoding='utf-8') as f:
                    profile_data = json.load(f)
            else:
                with open(profile_path, 'r', encoding='utf-8') as f:
                    profile_data = json.load(f)

            # Deserialize profile
            profile = ConsumerProfile.from_dict(profile_data)

            # Update cache
            if use_cache:
                self.cache.put(profile)

            self.logger.info(f"Profile {profile_id} loaded successfully")
            return profile

        except Exception as e:
            self.logger.error(f"Failed to load profile {profile_id}: {e}")
            return None

    def _create_backup(self, profile_id: str) -> bool:
        """Create backup of existing profile."""
        try:
            source_path = self._get_profile_path(profile_id)
            if not source_path.exists():
                return False

            backup_path = self._get_backup_path(profile_id, datetime.now(timezone.utc))

            # Copy file to backup location
            import shutil
            shutil.copy2(source_path, backup_path)

            # Cleanup old backups
            self._cleanup_old_backups(profile_id)

            self.logger.debug(f"Backup created for profile {profile_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to create backup for profile {profile_id}: {e}")
            return False

    def _cleanup_old_backups(self, profile_id: str) -> None:
        """Remove old backups beyond backup_count limit."""
        try:
            backup_dir = self.storage_dir / "backups"
            backup_files = list(backup_dir.glob(f"{profile_id}_*.json*"))

            if len(backup_files) > self.backup_count:
                # Sort by modification time
                backup_files.sort(key=lambda x: x.stat().st_mtime)

                # Remove oldest backups
                for old_backup in backup_files[:-self.backup_count]:
                    old_backup.unlink()
                    self.logger.debug(f"Removed old backup: {old_backup.name}")

        except Exception as e:
            self.logger.error(f"Failed to cleanup backups for profile {profile_id}: {e}")

    def delete_profile(self, profile_id: str, create_backup: bool = True) -> bool:
        """
        Delete consumer profile with optional backup.

        Args:
            profile_id: ID of profile to delete
            create_backup: Whether to backup before deletion

        Returns:
            True if successful, False otherwise
        """
        try:
            profile_path = self._get_profile_path(profile_id)

            if not profile_path.exists():
                self.logger.warning(f"Profile {profile_id} not found for deletion")
                return False

            # Create backup before deletion
            if create_backup:
                self._create_backup(profile_id)

            # Remove profile file
            profile_path.unlink()

            # Remove from cache
            self.cache.remove(profile_id)

            # Update metadata
            if profile_id in self.metadata.get('profiles', {}):
                del self.metadata['profiles'][profile_id]
                self._save_metadata()

            self.logger.info(f"Profile {profile_id} deleted successfully")
            return True

        except Exception as e:
            self.logger.error(f"Failed to delete profile {profile_id}: {e}")
            return False

    def list_profiles(self) -> List[Dict[str, Any]]:
        """
        List all stored profiles with metadata.

        Returns:
            List of profile metadata dictionaries
        """
        profiles = []

        for profile_id, metadata in self.metadata.get('profiles', {}).items():
            profile_info = {
                'profile_id': profile_id,
                'last_saved': metadata.get('last_saved'),
                'file_size': metadata.get('file_size', 0),
                'version': metadata.get('version', 1)
            }
            profiles.append(profile_info)

        return profiles

    def get_profile_stats(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """
        Get statistics for a specific profile.

        Args:
            profile_id: ID of profile to get stats for

        Returns:
            Dictionary with profile statistics or None if not found
        """
        if profile_id not in self.metadata.get('profiles', {}):
            return None

        metadata = self.metadata['profiles'][profile_id]
        profile_path = self._get_profile_path(profile_id)

        stats = {
            'profile_id': profile_id,
            'exists': profile_path.exists(),
            'last_saved': metadata.get('last_saved'),
            'file_size': metadata.get('file_size', 0),
            'version': metadata.get('version', 1),
            'checksum': metadata.get('checksum'),
            'cached': self.cache.get(profile_id) is not None
        }

        if profile_path.exists():
            stats['actual_file_size'] = profile_path.stat().st_size

        return stats

    def optimize_memory(self, profile: ConsumerProfile,
                       max_memories: int = 1000,
                       importance_threshold: float = 0.3) -> ConsumerProfile:
        """
        Optimize profile memory by removing low-importance or old memories.

        Args:
            profile: Profile to optimize
            max_memories: Maximum number of memories to keep
            importance_threshold: Minimum importance score to keep

        Returns:
            Optimized profile
        """
        if len(profile.memories) <= max_memories:
            return profile

        # Sort memories by importance and recency
        profile.memories.sort(
            key=lambda m: (m.importance, m.created_at),
            reverse=True
        )

        # Keep high-importance memories
        optimized_memories = [
            memory for memory in profile.memories
            if memory.importance >= importance_threshold
        ]

        # Fill remaining slots with most recent memories
        remaining_slots = max_memories - len(optimized_memories)
        if remaining_slots > 0:
            recent_memories = [
                memory for memory in profile.memories
                if memory not in optimized_memories
            ]
            recent_memories.sort(key=lambda m: m.created_at, reverse=True)
            optimized_memories.extend(recent_memories[:remaining_slots])

        profile.memories = optimized_memories
        self.logger.info(f"Optimized profile {profile.profile_id} memories: "
                        f"{len(profile.memories)} kept from original")

        return profile

    def cleanup_storage(self, days_threshold: int = 90) -> Dict[str, int]:
        """
        Cleanup old profiles and backups.

        Args:
            days_threshold: Remove profiles older than this many days

        Returns:
            Dictionary with cleanup statistics
        """
        stats = {'profiles_removed': 0, 'backups_removed': 0, 'errors': 0}

        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_threshold)

            # Cleanup old profiles
            profiles_dir = self.storage_dir / "profiles"
            for profile_file in profiles_dir.glob("*"):
                if profile_file.stat().st_mtime < cutoff_date.timestamp():
                    try:
                        profile_id = profile_file.stem.split('.')[0]
                        if self.delete_profile(profile_id, create_backup=False):
                            stats['profiles_removed'] += 1
                    except Exception as e:
                        self.logger.error(f"Error removing old profile {profile_file}: {e}")
                        stats['errors'] += 1

            # Cleanup old backups
            backups_dir = self.storage_dir / "backups"
            for backup_file in backups_dir.glob("*"):
                if backup_file.stat().st_mtime < cutoff_date.timestamp():
                    try:
                        backup_file.unlink()
                        stats['backups_removed'] += 1
                    except Exception as e:
                        self.logger.error(f"Error removing old backup {backup_file}: {e}")
                        stats['errors'] += 1

            # Update metadata
            self.metadata['last_cleanup'] = datetime.now(timezone.utc).isoformat()
            self._save_metadata()

            self.logger.info(f"Storage cleanup completed: {stats}")

        except Exception as e:
            self.logger.error(f"Storage cleanup failed: {e}")
            stats['errors'] += 1

        return stats

    @contextmanager
    def profile_session(self, profile_id: str, create_if_missing: bool = True):
        """
        Context manager for profile sessions with automatic saving.

        Args:
            profile_id: ID of profile to work with
            create_if_missing: Whether to create new profile if not found

        Yields:
            ConsumerProfile for the session
        """
        profile = self.load_profile(profile_id)

        if profile is None:
            if create_if_missing:
                profile = ConsumerProfile(profile_id=profile_id)
                self.logger.info(f"Created new profile {profile_id}")
            else:
                raise MemoryManagerError(f"Profile {profile_id} not found")

        try:
            yield profile
        finally:
            # Auto-save on session end
            self.save_profile(profile)

    def export_profile(self, profile_id: str, export_path: str,
                      format: str = "json") -> bool:
        """
        Export profile to external file.

        Args:
            profile_id: ID of profile to export
            export_path: Path to export file
            format: Export format ('json' or 'pickle')

        Returns:
            True if successful, False otherwise
        """
        try:
            profile = self.load_profile(profile_id)
            if not profile:
                self.logger.error(f"Profile {profile_id} not found for export")
                return False

            export_file = Path(export_path)
            export_file.parent.mkdir(parents=True, exist_ok=True)

            if format.lower() == "json":
                with open(export_file, 'w') as f:
                    json.dump(profile.to_dict(), f, indent=2)
            elif format.lower() == "pickle":
                with open(export_file, 'wb') as f:
                    pickle.dump(profile, f)
            else:
                raise ValueError(f"Unsupported export format: {format}")

            self.logger.info(f"Profile {profile_id} exported to {export_path}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to export profile {profile_id}: {e}")
            return False

    def import_profile(self, import_path: str, format: str = "json") -> Optional[str]:
        """
        Import profile from external file.

        Args:
            import_path: Path to import file
            format: Import format ('json' or 'pickle')

        Returns:
            Profile ID if successful, None otherwise
        """
        try:
            import_file = Path(import_path)
            if not import_file.exists():
                self.logger.error(f"Import file not found: {import_path}")
                return None

            if format.lower() == "json":
                with open(import_file, 'r') as f:
                    profile_data = json.load(f)
                profile = ConsumerProfile.from_dict(profile_data)
            elif format.lower() == "pickle":
                with open(import_file, 'rb') as f:
                    profile = pickle.load(f)
            else:
                raise ValueError(f"Unsupported import format: {format}")

            # Save imported profile
            if self.save_profile(profile):
                self.logger.info(f"Profile {profile.profile_id} imported from {import_path}")
                return profile.profile_id
            else:
                return None

        except Exception as e:
            self.logger.error(f"Failed to import profile from {import_path}: {e}")
            return None