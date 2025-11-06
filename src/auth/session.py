"""
Session management for authenticated users.

This module manages user sessions combining:
1. JWT tokens for API authentication
2. Session keys for frictionless interactions (future Phase 2)
3. User session metadata

Session Flow:
1. User authenticates with wallet signature
2. Backend creates session with JWT token
3. Session stored with metadata (device, location, etc.)
4. API requests validated against session
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import secrets


class SessionError(Exception):
    """Base exception for session errors."""
    pass


class SessionNotFoundError(SessionError):
    """Raised when session doesn't exist."""
    pass


class SessionExpiredError(SessionError):
    """Raised when session has expired."""
    pass


@dataclass
class Session:
    """
    Represents an authenticated user session.

    Attributes:
        session_id: Unique session identifier
        user_id: User identifier
        wallet_address: User's wallet address
        jwt_token: JWT access token
        created_at: Session creation time
        expires_at: Session expiration time
        last_activity: Last activity timestamp
        device_info: Device metadata (user agent, platform, etc.)
        ip_address: Client IP address
        metadata: Additional session metadata
    """
    session_id: str
    user_id: str
    wallet_address: str
    jwt_token: str
    created_at: datetime
    expires_at: datetime
    last_activity: datetime
    device_info: Optional[Dict[str, str]] = None
    ip_address: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if session has expired."""
        return datetime.utcnow() >= self.expires_at

    def is_idle(self, idle_timeout_minutes: int = 60) -> bool:
        """
        Check if session has been idle too long.

        Args:
            idle_timeout_minutes: Idle timeout in minutes

        Returns:
            True if idle timeout exceeded
        """
        idle_threshold = datetime.utcnow() - timedelta(minutes=idle_timeout_minutes)
        return self.last_activity < idle_threshold

    def update_activity(self):
        """Update last activity timestamp to current time."""
        self.last_activity = datetime.utcnow()

    def time_until_expiry(self) -> timedelta:
        """Calculate time remaining until expiry."""
        if self.is_expired():
            return timedelta(0)
        return self.expires_at - datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Serialize session to dictionary."""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "wallet_address": self.wallet_address,
            "jwt_token": self.jwt_token,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "device_info": self.device_info,
            "ip_address": self.ip_address,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Session":
        """Deserialize session from dictionary."""
        return cls(
            session_id=data["session_id"],
            user_id=data["user_id"],
            wallet_address=data["wallet_address"],
            jwt_token=data["jwt_token"],
            created_at=datetime.fromisoformat(data["created_at"].replace("Z", "")),
            expires_at=datetime.fromisoformat(data["expires_at"].replace("Z", "")),
            last_activity=datetime.fromisoformat(data["last_activity"].replace("Z", "")),
            device_info=data.get("device_info"),
            ip_address=data.get("ip_address"),
            metadata=data.get("metadata", {})
        )


class SessionManager:
    """
    Manages user sessions for the application.

    This class provides session CRUD operations and validation.
    In production, sessions should be stored in Redis or similar
    for performance and scalability.

    Example:
        >>> manager = SessionManager()
        >>> session = manager.create_session(
        ...     user_id="user_123",
        ...     wallet_address="0x1234...",
        ...     jwt_token="eyJ..."
        ... )
        >>> manager.validate_session(session.session_id)
        True
    """

    def __init__(self, default_ttl_days: int = 30, idle_timeout_minutes: int = 60):
        """
        Initialize session manager.

        Args:
            default_ttl_days: Default session TTL in days
            idle_timeout_minutes: Idle timeout in minutes
        """
        self.default_ttl_days = default_ttl_days
        self.idle_timeout_minutes = idle_timeout_minutes
        self._sessions: Dict[str, Session] = {}  # In-memory store (use Redis in production)

    def create_session(
        self,
        user_id: str,
        wallet_address: str,
        jwt_token: str,
        device_info: Optional[Dict[str, str]] = None,
        ip_address: Optional[str] = None,
        ttl_days: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Session:
        """
        Create a new session for authenticated user.

        Args:
            user_id: User identifier
            wallet_address: User's wallet address
            jwt_token: JWT access token
            device_info: Device metadata
            ip_address: Client IP address
            ttl_days: Custom TTL (default: use default_ttl_days)
            metadata: Additional metadata

        Returns:
            Created Session object
        """
        session_id = self._generate_session_id()
        current_time = datetime.utcnow()
        ttl = ttl_days if ttl_days is not None else self.default_ttl_days
        expires_at = current_time + timedelta(days=ttl)

        session = Session(
            session_id=session_id,
            user_id=user_id,
            wallet_address=wallet_address,
            jwt_token=jwt_token,
            created_at=current_time,
            expires_at=expires_at,
            last_activity=current_time,
            device_info=device_info,
            ip_address=ip_address,
            metadata=metadata or {}
        )

        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Session:
        """
        Get session by ID.

        Args:
            session_id: Session identifier

        Returns:
            Session object

        Raises:
            SessionNotFoundError: If session doesn't exist
            SessionExpiredError: If session has expired
        """
        if session_id not in self._sessions:
            raise SessionNotFoundError(f"Session not found: {session_id}")

        session = self._sessions[session_id]

        if session.is_expired():
            self.delete_session(session_id)
            raise SessionExpiredError(f"Session expired: {session_id}")

        return session

    def get_session_by_user(self, user_id: str) -> Optional[Session]:
        """
        Get active session for user.

        Returns the most recently active session if multiple exist.

        Args:
            user_id: User identifier

        Returns:
            Session object or None if no active session
        """
        user_sessions = [
            s for s in self._sessions.values()
            if s.user_id == user_id and not s.is_expired()
        ]

        if not user_sessions:
            return None

        # Return most recently active session
        return max(user_sessions, key=lambda s: s.last_activity)

    def validate_session(self, session_id: str) -> bool:
        """
        Validate session exists and is active.

        Args:
            session_id: Session identifier

        Returns:
            True if valid, False otherwise
        """
        try:
            session = self.get_session(session_id)
            return not session.is_expired()
        except (SessionNotFoundError, SessionExpiredError):
            return False

    def update_session_activity(self, session_id: str):
        """
        Update session last activity timestamp.

        Should be called on each API request to track activity.

        Args:
            session_id: Session identifier

        Raises:
            SessionNotFoundError: If session doesn't exist
        """
        session = self.get_session(session_id)
        session.update_activity()

    def delete_session(self, session_id: str):
        """
        Delete session (logout).

        Args:
            session_id: Session identifier
        """
        if session_id in self._sessions:
            del self._sessions[session_id]

    def delete_user_sessions(self, user_id: str):
        """
        Delete all sessions for a user.

        Useful for "logout all devices" functionality.

        Args:
            user_id: User identifier
        """
        session_ids_to_delete = [
            sid for sid, session in self._sessions.items()
            if session.user_id == user_id
        ]

        for session_id in session_ids_to_delete:
            del self._sessions[session_id]

    def cleanup_expired_sessions(self):
        """
        Remove all expired sessions from storage.

        Should be called periodically (e.g., via cron job).
        """
        current_time = datetime.utcnow()
        expired_session_ids = [
            sid for sid, session in self._sessions.items()
            if session.is_expired()
        ]

        for session_id in expired_session_ids:
            del self._sessions[session_id]

    def cleanup_idle_sessions(self):
        """
        Remove idle sessions that haven't been active recently.

        Should be called periodically.
        """
        idle_session_ids = [
            sid for sid, session in self._sessions.items()
            if session.is_idle(self.idle_timeout_minutes)
        ]

        for session_id in idle_session_ids:
            del self._sessions[session_id]

    def list_user_sessions(self, user_id: str) -> list[Session]:
        """
        List all active sessions for a user.

        Useful for "active devices" UI.

        Args:
            user_id: User identifier

        Returns:
            List of active Session objects
        """
        return [
            session for session in self._sessions.values()
            if session.user_id == user_id and not session.is_expired()
        ]

    def session_count(self, user_id: Optional[str] = None) -> int:
        """
        Count active sessions.

        Args:
            user_id: If provided, count only for this user

        Returns:
            Number of active sessions
        """
        if user_id:
            return len([
                s for s in self._sessions.values()
                if s.user_id == user_id and not s.is_expired()
            ])
        return len([s for s in self._sessions.values() if not s.is_expired()])

    @staticmethod
    def _generate_session_id() -> str:
        """Generate a cryptographically secure random session ID."""
        return f"sess_{secrets.token_urlsafe(32)}"


# Convenience functions for common use cases

def create_user_session(
    user_id: str,
    wallet_address: str,
    jwt_token: str,
    manager: Optional[SessionManager] = None
) -> Session:
    """
    Create user session (convenience function).

    Args:
        user_id: User identifier
        wallet_address: Wallet address
        jwt_token: JWT token
        manager: SessionManager instance (creates new if None)

    Returns:
        Created Session object
    """
    if manager is None:
        manager = SessionManager()
    return manager.create_session(user_id, wallet_address, jwt_token)


def validate_user_session(
    session_id: str,
    manager: Optional[SessionManager] = None
) -> bool:
    """
    Validate session (convenience function).

    Args:
        session_id: Session identifier
        manager: SessionManager instance (creates new if None)

    Returns:
        True if valid, False otherwise
    """
    if manager is None:
        manager = SessionManager()
    return manager.validate_session(session_id)


def logout_user(
    session_id: str,
    manager: Optional[SessionManager] = None
):
    """
    Logout user by deleting session (convenience function).

    Args:
        session_id: Session identifier
        manager: SessionManager instance (creates new if None)
    """
    if manager is None:
        manager = SessionManager()
    manager.delete_session(session_id)


def logout_all_devices(
    user_id: str,
    manager: Optional[SessionManager] = None
):
    """
    Logout user from all devices (convenience function).

    Args:
        user_id: User identifier
        manager: SessionManager instance (creates new if None)
    """
    if manager is None:
        manager = SessionManager()
    manager.delete_user_sessions(user_id)
