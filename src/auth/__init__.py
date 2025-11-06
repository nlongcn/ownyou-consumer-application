"""
OwnYou Authentication System

This module provides wallet-based authentication with JWT tokens and
session management for the OwnYou Consumer Application.

Main Components:
1. wallet_auth: Wallet signature verification (EIP-191, EIP-712)
2. jwt_tokens: JWT token generation and validation
3. session: User session management

Quick Start:
    >>> from src.auth import AuthFlow
    >>>
    >>> # Generate challenge
    >>> auth_flow = AuthFlow(jwt_secret="your-secret-key")
    >>> challenge = auth_flow.generate_challenge()
    >>>
    >>> # User signs challenge with wallet
    >>> # ...
    >>>
    >>> # Verify and create session
    >>> session = auth_flow.authenticate(
    ...     wallet_address="0x1234...",
    ...     signature="0xabcd...",
    ...     challenge=challenge["challenge"]
    ... )
    >>>
    >>> # API request validation
    >>> is_valid = auth_flow.validate_request(session.jwt_token)

Phase 1 Deliverable:
This authentication system is Phase 1 Deliverable #4, providing:
- Complete wallet signature verification
- JWT token management
- Session handling
- Security contracts for Phase 2 implementation

Phase 2 Integration:
- Integrate Privy SDK for embedded wallets
- Add session key support for frictionless UX
- Implement multi-device sync
"""

from typing import Optional

from src.auth.wallet_auth import (
    WalletAuthenticator,
    WalletAuthError,
    InvalidSignatureError,
    ExpiredChallengeError,
    generate_auth_challenge,
    verify_wallet_signature,
    recover_wallet_address,
)

from src.auth.jwt_tokens import (
    JWTManager,
    JWTError,
    InvalidTokenError,
    ExpiredTokenError,
    TokenClaims,
    TokenRevocationStore,
    generate_access_token,
    validate_access_token,
    revoke_token,
    is_token_revoked,
)

from src.auth.session import (
    SessionManager,
    Session,
    SessionError,
    SessionNotFoundError,
    SessionExpiredError,
    create_user_session,
    validate_user_session,
    logout_user,
    logout_all_devices,
)


class AuthFlow:
    """
    Complete authentication flow combining wallet auth, JWT, and sessions.

    This class provides a high-level API for the entire authentication
    process, making it easy to integrate into API endpoints.

    Example:
        >>> auth_flow = AuthFlow(jwt_secret="your-secret-key")
        >>>
        >>> # Step 1: Generate challenge
        >>> challenge_data = auth_flow.generate_challenge()
        >>>
        >>> # Step 2: User signs challenge (done client-side)
        >>> # ...
        >>>
        >>> # Step 3: Verify signature and create session
        >>> session = auth_flow.authenticate(
        ...     wallet_address="0x1234...",
        ...     signature="0xabcd...",
        ...     challenge=challenge_data["challenge"]
        ... )
        >>>
        >>> # Step 4: Validate API requests
        >>> is_valid = auth_flow.validate_request(session.jwt_token)
    """

    def __init__(
        self,
        jwt_secret: str,
        challenge_ttl_minutes: int = 5,
        session_ttl_days: int = 30
    ):
        """
        Initialize authentication flow.

        Args:
            jwt_secret: Secret key for JWT signing (MUST be secure)
            challenge_ttl_minutes: Challenge validity in minutes
            session_ttl_days: Session validity in days
        """
        self.wallet_auth = WalletAuthenticator(challenge_ttl_minutes=challenge_ttl_minutes)
        self.jwt_manager = JWTManager(
            secret_key=jwt_secret,
            access_token_ttl_days=session_ttl_days
        )
        self.session_manager = SessionManager(default_ttl_days=session_ttl_days)

    def generate_challenge(self) -> dict:
        """
        Generate authentication challenge for user to sign.

        Returns:
            dict with keys:
                - challenge (str): Message to sign
                - nonce (str): Random nonce
                - timestamp (int): Unix timestamp
                - expires_at (str): ISO 8601 expiration time
        """
        return self.wallet_auth.generate_challenge()

    def authenticate(
        self,
        wallet_address: str,
        signature: str,
        challenge: str,
        user_id: Optional[str] = None,
        device_info: Optional[dict] = None,
        ip_address: Optional[str] = None
    ) -> Session:
        """
        Complete authentication: verify signature and create session.

        Args:
            wallet_address: User's wallet address
            signature: Signed challenge
            challenge: Original challenge message
            user_id: User ID (auto-generated if None)
            device_info: Device metadata
            ip_address: Client IP

        Returns:
            Created Session object

        Raises:
            InvalidSignatureError: If signature verification fails
            ExpiredChallengeError: If challenge has expired
        """
        # Step 1: Verify wallet signature
        self.wallet_auth.verify_signature(wallet_address, signature, challenge)

        # Step 2: Generate user_id if not provided
        if user_id is None:
            # In production, this would look up or create user in database
            user_id = f"user_{wallet_address[-8:]}"

        # Step 3: Generate JWT token
        jwt_token = self.jwt_manager.generate_token(
            user_id=user_id,
            wallet_address=wallet_address
        )

        # Step 4: Create session
        session = self.session_manager.create_session(
            user_id=user_id,
            wallet_address=wallet_address,
            jwt_token=jwt_token,
            device_info=device_info,
            ip_address=ip_address
        )

        return session

    def validate_request(self, jwt_token: str) -> bool:
        """
        Validate API request with JWT token.

        Args:
            jwt_token: JWT token from Authorization header

        Returns:
            True if valid, False otherwise
        """
        try:
            # Check if token is revoked
            if is_token_revoked(jwt_token, self.jwt_manager):
                return False

            # Validate token
            claims = self.jwt_manager.validate_token(jwt_token)

            # Check if session exists
            session = self.session_manager.get_session_by_user(claims.user_id)
            if session is None:
                return False

            # Update session activity
            self.session_manager.update_session_activity(session.session_id)

            return True

        except (InvalidTokenError, ExpiredTokenError, SessionError):
            return False

    def logout(self, jwt_token: str):
        """
        Logout user by revoking token and deleting session.

        Args:
            jwt_token: JWT token to revoke
        """
        try:
            claims = self.jwt_manager.validate_token(jwt_token, verify_exp=False)
            revoke_token(jwt_token, self.jwt_manager)
            session = self.session_manager.get_session_by_user(claims.user_id)
            if session:
                self.session_manager.delete_session(session.session_id)
        except (InvalidTokenError, SessionError):
            pass  # Token or session already invalid

    def logout_all_devices(self, user_id: str):
        """
        Logout user from all devices.

        Args:
            user_id: User identifier
        """
        self.session_manager.delete_user_sessions(user_id)

    def get_user_from_token(self, jwt_token: str) -> Optional[str]:
        """
        Extract user_id from JWT token.

        Args:
            jwt_token: JWT token

        Returns:
            User ID string or None if token invalid
        """
        try:
            claims = self.jwt_manager.validate_token(jwt_token, verify_exp=False)
            return claims.user_id
        except (InvalidTokenError, ExpiredTokenError):
            return None


__all__ = [
    # Main authentication flow
    "AuthFlow",
    # Wallet authentication
    "WalletAuthenticator",
    "WalletAuthError",
    "InvalidSignatureError",
    "ExpiredChallengeError",
    "generate_auth_challenge",
    "verify_wallet_signature",
    "recover_wallet_address",
    # JWT tokens
    "JWTManager",
    "JWTError",
    "InvalidTokenError",
    "ExpiredTokenError",
    "TokenClaims",
    "TokenRevocationStore",
    "generate_access_token",
    "validate_access_token",
    "revoke_token",
    "is_token_revoked",
    # Sessions
    "SessionManager",
    "Session",
    "SessionError",
    "SessionNotFoundError",
    "SessionExpiredError",
    "create_user_session",
    "validate_user_session",
    "logout_user",
    "logout_all_devices",
]
