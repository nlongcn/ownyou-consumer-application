"""
JWT token generation and validation for API authentication.

This module provides JWT-based authentication separate from blockchain
wallet signatures. After wallet signature verification, users receive
a JWT token for API access.

Token Types:
1. Access Token: Short-lived (30 days), used for API authentication
2. Refresh Token: Not implemented (use wallet signature for re-auth)
"""

import jwt
import time
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from dataclasses import dataclass


class JWTError(Exception):
    """Base exception for JWT errors."""
    pass


class InvalidTokenError(JWTError):
    """Raised when token is invalid or malformed."""
    pass


class ExpiredTokenError(JWTError):
    """Raised when token has expired."""
    pass


@dataclass
class TokenClaims:
    """
    Structured representation of JWT token claims.

    Attributes:
        user_id: Unique user identifier
        wallet_address: User's wallet address
        issued_at: Token issue timestamp
        expires_at: Token expiration timestamp
        token_id: Unique token identifier (jti)
        additional_claims: Any additional custom claims
    """
    user_id: str
    wallet_address: str
    issued_at: int
    expires_at: int
    token_id: str
    additional_claims: Dict[str, Any]

    def is_expired(self) -> bool:
        """Check if token is expired."""
        current_time = int(time.time())
        return current_time >= self.expires_at

    def time_until_expiry(self) -> timedelta:
        """Calculate time remaining until expiry."""
        current_time = int(time.time())
        seconds_remaining = max(0, self.expires_at - current_time)
        return timedelta(seconds=seconds_remaining)


class JWTManager:
    """
    Manages JWT token generation and validation.

    This class handles:
    1. Access token generation after wallet signature verification
    2. Token validation for API requests
    3. Token claims extraction and parsing

    Example:
        >>> manager = JWTManager(secret_key="your-secret-key")
        >>> token = manager.generate_token(
        ...     user_id="user_123",
        ...     wallet_address="0x1234..."
        ... )
        >>> claims = manager.validate_token(token)
        >>> print(claims.user_id)  # "user_123"
    """

    def __init__(
        self,
        secret_key: str,
        algorithm: str = "HS256",
        access_token_ttl_days: int = 30
    ):
        """
        Initialize JWT manager.

        Args:
            secret_key: Secret key for signing tokens (MUST be kept secure)
            algorithm: JWT signing algorithm (default: HS256)
            access_token_ttl_days: Access token validity in days (default: 30)
        """
        if not secret_key or len(secret_key) < 32:
            raise ValueError("Secret key must be at least 32 characters")

        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_ttl_days = access_token_ttl_days

    def generate_token(
        self,
        user_id: str,
        wallet_address: str,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate JWT access token for authenticated user.

        Args:
            user_id: Unique user identifier
            wallet_address: User's wallet address (checksummed)
            additional_claims: Optional additional claims to include

        Returns:
            Encoded JWT token string

        Raises:
            JWTError: If token generation fails
        """
        current_time = int(time.time())
        expiry_time = current_time + (self.access_token_ttl_days * 24 * 60 * 60)

        # Generate unique token ID for revocation tracking
        import secrets
        token_id = secrets.token_hex(16)

        # Standard JWT claims
        payload = {
            "sub": user_id,  # Subject (user identifier)
            "wallet": wallet_address,  # Custom claim
            "iat": current_time,  # Issued at
            "exp": expiry_time,  # Expiration
            "jti": token_id,  # JWT ID (for revocation)
        }

        # Add any additional claims
        if additional_claims:
            payload.update(additional_claims)

        try:
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            return token
        except Exception as e:
            raise JWTError(f"Failed to generate token: {e}")

    def validate_token(self, token: str, verify_exp: bool = True) -> TokenClaims:
        """
        Validate JWT token and extract claims.

        Args:
            token: JWT token string
            verify_exp: Whether to verify expiration (default: True)

        Returns:
            TokenClaims object with parsed claims

        Raises:
            InvalidTokenError: If token is invalid or malformed
            ExpiredTokenError: If token has expired
        """
        try:
            # Decode and verify token
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={"verify_exp": verify_exp}
            )

            # Extract standard claims
            user_id = payload.get("sub")
            wallet_address = payload.get("wallet")
            issued_at = payload.get("iat")
            expires_at = payload.get("exp")
            token_id = payload.get("jti")

            # Validate required claims
            if not all([user_id, wallet_address, issued_at, expires_at, token_id]):
                raise InvalidTokenError("Missing required claims in token")

            # Extract additional claims
            standard_claims = {"sub", "wallet", "iat", "exp", "jti"}
            additional_claims = {
                k: v for k, v in payload.items()
                if k not in standard_claims
            }

            claims = TokenClaims(
                user_id=user_id,
                wallet_address=wallet_address,
                issued_at=issued_at,
                expires_at=expires_at,
                token_id=token_id,
                additional_claims=additional_claims
            )

            return claims

        except jwt.ExpiredSignatureError:
            raise ExpiredTokenError("Token has expired")
        except jwt.InvalidTokenError as e:
            raise InvalidTokenError(f"Invalid token: {e}")
        except Exception as e:
            raise JWTError(f"Token validation failed: {e}")

    def decode_without_verification(self, token: str) -> Dict[str, Any]:
        """
        Decode token without verifying signature or expiration.

        SECURITY WARNING: Only use this for debugging or inspection.
        Do NOT use for authentication!

        Args:
            token: JWT token string

        Returns:
            Decoded payload dict

        Raises:
            InvalidTokenError: If token is malformed
        """
        try:
            payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_exp": False}
            )
            return payload
        except Exception as e:
            raise InvalidTokenError(f"Failed to decode token: {e}")

    def extract_user_id(self, token: str) -> str:
        """
        Extract user_id from token without full validation.

        Useful for quickly identifying user from token.
        Still verifies signature but not expiration.

        Args:
            token: JWT token string

        Returns:
            User ID string

        Raises:
            InvalidTokenError: If token is invalid
        """
        claims = self.validate_token(token, verify_exp=False)
        return claims.user_id

    def is_token_valid(self, token: str) -> bool:
        """
        Check if token is valid (convenience method).

        Args:
            token: JWT token string

        Returns:
            True if valid, False otherwise
        """
        try:
            self.validate_token(token)
            return True
        except (InvalidTokenError, ExpiredTokenError):
            return False


class TokenRevocationStore:
    """
    In-memory token revocation store.

    For production, this should be replaced with Redis or similar
    persistent storage.

    This stores revoked token IDs (jti claims) to prevent use of
    revoked tokens even if they haven't expired yet.
    """

    def __init__(self):
        self._revoked_tokens = set()

    def revoke_token(self, token_id: str):
        """
        Revoke a token by its ID.

        Args:
            token_id: JWT ID (jti claim)
        """
        self._revoked_tokens.add(token_id)

    def is_revoked(self, token_id: str) -> bool:
        """
        Check if token is revoked.

        Args:
            token_id: JWT ID (jti claim)

        Returns:
            True if revoked, False otherwise
        """
        return token_id in self._revoked_tokens

    def clear_expired(self, current_time: Optional[int] = None):
        """
        Clear expired tokens from revocation store.

        Note: This is a simplified implementation. In production,
        you'd store expiry times with token IDs and remove expired ones.

        Args:
            current_time: Current timestamp (default: now)
        """
        # Placeholder - in production, implement expiry tracking
        pass


# Global revocation store instance
# In production, replace with Redis or database
_revocation_store = TokenRevocationStore()


def revoke_token(token: str, jwt_manager: JWTManager):
    """
    Revoke a JWT token (convenience function).

    Args:
        token: JWT token to revoke
        jwt_manager: JWTManager instance for validation
    """
    try:
        claims = jwt_manager.validate_token(token, verify_exp=False)
        _revocation_store.revoke_token(claims.token_id)
    except (InvalidTokenError, ExpiredTokenError):
        # Token already invalid, no need to revoke
        pass


def is_token_revoked(token: str, jwt_manager: JWTManager) -> bool:
    """
    Check if token is revoked (convenience function).

    Args:
        token: JWT token to check
        jwt_manager: JWTManager instance for validation

    Returns:
        True if revoked, False otherwise
    """
    try:
        claims = jwt_manager.validate_token(token, verify_exp=False)
        return _revocation_store.is_revoked(claims.token_id)
    except (InvalidTokenError, ExpiredTokenError):
        return True  # Invalid tokens are considered revoked


# Convenience functions for common use cases

def generate_access_token(
    user_id: str,
    wallet_address: str,
    secret_key: str
) -> str:
    """
    Generate access token (convenience function).

    Args:
        user_id: User identifier
        wallet_address: Wallet address
        secret_key: JWT secret key

    Returns:
        JWT token string
    """
    manager = JWTManager(secret_key=secret_key)
    return manager.generate_token(user_id, wallet_address)


def validate_access_token(token: str, secret_key: str) -> TokenClaims:
    """
    Validate access token (convenience function).

    Args:
        token: JWT token string
        secret_key: JWT secret key

    Returns:
        TokenClaims object

    Raises:
        InvalidTokenError: If token invalid
        ExpiredTokenError: If token expired
    """
    manager = JWTManager(secret_key=secret_key)
    return manager.validate_token(token)
