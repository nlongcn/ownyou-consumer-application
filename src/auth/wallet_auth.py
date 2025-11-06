"""
Wallet-based authentication using signature verification.

This module handles:
1. Challenge generation for wallet signature
2. Signature verification (EIP-191, EIP-712)
3. Wallet address recovery from signatures

Supports Ethereum wallet signatures compatible with:
- MetaMask
- Privy embedded wallets
- WalletConnect
- Coinbase Wallet
"""

import secrets
import time
from typing import Optional, Tuple
from datetime import datetime, timedelta
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import is_address, to_checksum_address

# EIP-712 support (optional, for newer eth-account versions)
try:
    from eth_account.messages import encode_structured_data
    HAS_EIP712_SUPPORT = True
except ImportError:
    HAS_EIP712_SUPPORT = False


class WalletAuthError(Exception):
    """Base exception for wallet authentication errors."""
    pass


class InvalidSignatureError(WalletAuthError):
    """Raised when signature verification fails."""
    pass


class ExpiredChallengeError(WalletAuthError):
    """Raised when challenge has expired."""
    pass


class WalletAuthenticator:
    """
    Handles wallet-based authentication via signature verification.

    This class provides methods to:
    1. Generate challenges for users to sign
    2. Verify signed challenges
    3. Recover wallet addresses from signatures

    Example:
        >>> auth = WalletAuthenticator(challenge_ttl_minutes=5)
        >>> challenge = auth.generate_challenge()
        >>> # User signs challenge with wallet
        >>> is_valid = auth.verify_signature(
        ...     wallet_address="0x1234...",
        ...     signature="0xabcd...",
        ...     challenge=challenge
        ... )
    """

    def __init__(
        self,
        challenge_ttl_minutes: int = 5,
        challenge_prefix: str = "Sign this message to authenticate with OwnYou:"
    ):
        """
        Initialize wallet authenticator.

        Args:
            challenge_ttl_minutes: How long challenges are valid (default: 5 minutes)
            challenge_prefix: Prefix for challenge messages
        """
        self.challenge_ttl_minutes = challenge_ttl_minutes
        self.challenge_prefix = challenge_prefix

    def generate_challenge(self) -> dict:
        """
        Generate a challenge message for user to sign.

        The challenge includes:
        - Timestamp (for expiry validation)
        - Random nonce (prevent replay attacks)
        - Human-readable message

        Returns:
            dict with keys:
                - challenge (str): Message to sign
                - nonce (str): Random nonce
                - timestamp (int): Unix timestamp
                - expires_at (str): ISO 8601 expiration time
        """
        timestamp = int(time.time())
        nonce = secrets.token_hex(16)  # 32 character hex string

        challenge_message = (
            f"{self.challenge_prefix}\n\n"
            f"Timestamp: {timestamp}\n"
            f"Nonce: {nonce}\n\n"
            f"This request will expire in {self.challenge_ttl_minutes} minutes."
        )

        expires_at = datetime.utcfromtimestamp(
            timestamp + (self.challenge_ttl_minutes * 60)
        )

        return {
            "challenge": challenge_message,
            "nonce": nonce,
            "timestamp": timestamp,
            "expires_at": expires_at.isoformat() + "Z"
        }

    def parse_challenge(self, challenge: str) -> Tuple[int, str]:
        """
        Extract timestamp and nonce from challenge message.

        Args:
            challenge: The challenge message string

        Returns:
            Tuple of (timestamp, nonce)

        Raises:
            WalletAuthError: If challenge format is invalid
        """
        try:
            lines = challenge.split("\n")
            timestamp_line = [l for l in lines if l.startswith("Timestamp:")][0]
            nonce_line = [l for l in lines if l.startswith("Nonce:")][0]

            timestamp = int(timestamp_line.split(":")[1].strip())
            nonce = nonce_line.split(":")[1].strip()

            return timestamp, nonce
        except (IndexError, ValueError) as e:
            raise WalletAuthError(f"Invalid challenge format: {e}")

    def is_challenge_expired(self, timestamp: int) -> bool:
        """
        Check if challenge has expired.

        Args:
            timestamp: Challenge timestamp (Unix time)

        Returns:
            True if expired, False otherwise
        """
        current_time = int(time.time())
        expiry_time = timestamp + (self.challenge_ttl_minutes * 60)
        return current_time > expiry_time

    def verify_signature(
        self,
        wallet_address: str,
        signature: str,
        challenge: str,
        check_expiry: bool = True
    ) -> bool:
        """
        Verify that signature was created by wallet address for challenge.

        Uses EIP-191 standard for personal message signing.

        Args:
            wallet_address: Expected signer address (0x...)
            signature: Hex-encoded signature (0x...)
            challenge: Original challenge message
            check_expiry: Whether to validate challenge hasn't expired

        Returns:
            True if signature is valid, False otherwise

        Raises:
            InvalidSignatureError: If signature verification fails
            ExpiredChallengeError: If challenge has expired (when check_expiry=True)
        """
        # Validate wallet address format
        if not is_address(wallet_address):
            raise InvalidSignatureError(f"Invalid wallet address format: {wallet_address}")

        wallet_address = to_checksum_address(wallet_address)

        # Parse and validate challenge
        timestamp, nonce = self.parse_challenge(challenge)

        if check_expiry and self.is_challenge_expired(timestamp):
            raise ExpiredChallengeError(
                f"Challenge expired at timestamp {timestamp}"
            )

        # Recover signer address from signature
        try:
            message = encode_defunct(text=challenge)
            recovered_address = Account.recover_message(message, signature=signature)
            recovered_address = to_checksum_address(recovered_address)
        except Exception as e:
            raise InvalidSignatureError(f"Failed to recover address: {e}")

        # Verify recovered address matches expected address
        if recovered_address != wallet_address:
            raise InvalidSignatureError(
                f"Signature verification failed. "
                f"Expected {wallet_address}, got {recovered_address}"
            )

        return True

    def recover_address(self, challenge: str, signature: str) -> str:
        """
        Recover wallet address from signed challenge.

        Useful when you want to identify the signer without
        knowing their address beforehand.

        Args:
            challenge: Original challenge message
            signature: Hex-encoded signature

        Returns:
            Recovered wallet address (checksummed)

        Raises:
            InvalidSignatureError: If signature is invalid
        """
        try:
            message = encode_defunct(text=challenge)
            recovered_address = Account.recover_message(message, signature=signature)
            return to_checksum_address(recovered_address)
        except Exception as e:
            raise InvalidSignatureError(f"Failed to recover address: {e}")

    def verify_eip712_signature(
        self,
        wallet_address: str,
        signature: str,
        typed_data: dict
    ) -> bool:
        """
        Verify EIP-712 typed data signature.

        EIP-712 is used for structured data signing (more user-friendly
        than raw message signing).

        Args:
            wallet_address: Expected signer address
            signature: Hex-encoded signature
            typed_data: EIP-712 typed data structure

        Returns:
            True if signature is valid

        Raises:
            InvalidSignatureError: If signature verification fails
            NotImplementedError: If EIP-712 not supported in installed eth-account version
        """
        if not HAS_EIP712_SUPPORT:
            raise NotImplementedError(
                "EIP-712 signature verification requires eth-account>=0.8.0. "
                "Please upgrade: pip install --upgrade eth-account"
            )

        if not is_address(wallet_address):
            raise InvalidSignatureError(f"Invalid wallet address: {wallet_address}")

        wallet_address = to_checksum_address(wallet_address)

        try:
            message = encode_structured_data(typed_data)
            recovered_address = Account.recover_message(message, signature=signature)
            recovered_address = to_checksum_address(recovered_address)
        except Exception as e:
            raise InvalidSignatureError(f"Failed to recover address from EIP-712: {e}")

        if recovered_address != wallet_address:
            raise InvalidSignatureError(
                f"EIP-712 signature verification failed. "
                f"Expected {wallet_address}, got {recovered_address}"
            )

        return True


# Convenience functions for common use cases

def generate_auth_challenge(ttl_minutes: int = 5) -> dict:
    """
    Generate authentication challenge (convenience function).

    Args:
        ttl_minutes: Challenge validity in minutes

    Returns:
        Challenge dict with message, nonce, timestamp, expires_at
    """
    auth = WalletAuthenticator(challenge_ttl_minutes=ttl_minutes)
    return auth.generate_challenge()


def verify_wallet_signature(
    wallet_address: str,
    signature: str,
    challenge: str
) -> bool:
    """
    Verify wallet signature (convenience function).

    Args:
        wallet_address: Expected signer address
        signature: Hex-encoded signature
        challenge: Original challenge message

    Returns:
        True if valid

    Raises:
        InvalidSignatureError: If signature invalid
        ExpiredChallengeError: If challenge expired
    """
    auth = WalletAuthenticator()
    return auth.verify_signature(wallet_address, signature, challenge)


def recover_wallet_address(challenge: str, signature: str) -> str:
    """
    Recover wallet address from signature (convenience function).

    Args:
        challenge: Original challenge message
        signature: Hex-encoded signature

    Returns:
        Recovered wallet address (checksummed)

    Raises:
        InvalidSignatureError: If signature invalid
    """
    auth = WalletAuthenticator()
    return auth.recover_address(challenge, signature)
