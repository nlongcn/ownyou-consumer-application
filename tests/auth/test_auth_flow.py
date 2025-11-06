"""
Comprehensive tests for OwnYou authentication system.

Tests wallet signature verification, JWT tokens, sessions, and
complete authentication flow.
"""

import pytest
import time
from eth_account import Account
from eth_account.messages import encode_defunct

from src.auth import (
    AuthFlow,
    WalletAuthenticator,
    JWTManager,
    SessionManager,
    InvalidSignatureError,
    ExpiredChallengeError,
    InvalidTokenError,
    ExpiredTokenError,
)


# Test fixtures
@pytest.fixture
def test_wallet():
    """Create test wallet."""
    account = Account.create()
    return {
        "address": account.address,
        "private_key": account._private_key,
        "account": account
    }


@pytest.fixture
def jwt_secret():
    """JWT secret for testing."""
    return "test_secret_key_at_least_32_characters_long_12345"


@pytest.fixture
def auth_flow(jwt_secret):
    """Create AuthFlow instance."""
    return AuthFlow(jwt_secret=jwt_secret)


# ============================================================================
# WALLET AUTHENTICATION TESTS
# ============================================================================

class TestWalletAuthentication:
    """Test wallet signature verification."""

    def test_generate_challenge(self):
        """Test challenge generation."""
        auth = WalletAuthenticator()
        challenge = auth.generate_challenge()
        
        assert "challenge" in challenge
        assert "nonce" in challenge
        assert "timestamp" in challenge
        assert "expires_at" in challenge
        assert "Sign this message" in challenge["challenge"]

    def test_verify_valid_signature(self, test_wallet):
        """Test verification of valid signature."""
        auth = WalletAuthenticator()
        challenge_data = auth.generate_challenge()
        
        # Sign challenge
        message = encode_defunct(text=challenge_data["challenge"])
        signed_message = test_wallet["account"].sign_message(message)
        
        # Verify signature
        is_valid = auth.verify_signature(
            test_wallet["address"],
            signed_message.signature.hex(),
            challenge_data["challenge"]
        )
        
        assert is_valid is True

    def test_verify_invalid_signature(self, test_wallet):
        """Test rejection of invalid signature."""
        auth = WalletAuthenticator()
        challenge_data = auth.generate_challenge()
        
        # Wrong signature
        with pytest.raises(InvalidSignatureError):
            auth.verify_signature(
                test_wallet["address"],
                "0x" + "00" * 65,
                challenge_data["challenge"]
            )

    def test_expired_challenge(self, test_wallet):
        """Test rejection of expired challenge."""
        auth = WalletAuthenticator(challenge_ttl_minutes=0)  # Expires immediately
        challenge_data = auth.generate_challenge()
        
        # Wait for expiry
        time.sleep(1)
        
        # Sign challenge
        message = encode_defunct(text=challenge_data["challenge"])
        signed_message = test_wallet["account"].sign_message(message)
        
        # Should reject expired challenge
        with pytest.raises(ExpiredChallengeError):
            auth.verify_signature(
                test_wallet["address"],
                signed_message.signature.hex(),
                challenge_data["challenge"]
            )

    def test_recover_address(self, test_wallet):
        """Test address recovery from signature."""
        auth = WalletAuthenticator()
        challenge_data = auth.generate_challenge()
        
        # Sign challenge
        message = encode_defunct(text=challenge_data["challenge"])
        signed_message = test_wallet["account"].sign_message(message)
        
        # Recover address
        recovered = auth.recover_address(
            challenge_data["challenge"],
            signed_message.signature.hex()
        )
        
        assert recovered.lower() == test_wallet["address"].lower()


# ============================================================================
# JWT TOKEN TESTS
# ============================================================================

class TestJWTTokens:
    """Test JWT token generation and validation."""

    def test_generate_token(self, jwt_secret):
        """Test token generation."""
        manager = JWTManager(secret_key=jwt_secret)
        token = manager.generate_token(
            user_id="user_123",
            wallet_address="0x1234567890abcdef"
        )
        
        assert token is not None
        assert isinstance(token, str)

    def test_validate_token(self, jwt_secret):
        """Test token validation."""
        manager = JWTManager(secret_key=jwt_secret)
        token = manager.generate_token(
            user_id="user_123",
            wallet_address="0x1234567890abcdef"
        )
        
        claims = manager.validate_token(token)
        
        assert claims.user_id == "user_123"
        assert claims.wallet_address == "0x1234567890abcdef"
        assert not claims.is_expired()

    def test_invalid_token(self, jwt_secret):
        """Test rejection of invalid token."""
        manager = JWTManager(secret_key=jwt_secret)
        
        with pytest.raises(InvalidTokenError):
            manager.validate_token("invalid.token.here")

    def test_wrong_secret(self, jwt_secret):
        """Test rejection with wrong secret."""
        manager1 = JWTManager(secret_key=jwt_secret)
        token = manager1.generate_token("user_123", "0x1234")
        
        manager2 = JWTManager(secret_key="wrong_secret_32_chars_long_123456")
        
        with pytest.raises(InvalidTokenError):
            manager2.validate_token(token)


# ============================================================================
# SESSION MANAGEMENT TESTS
# ============================================================================

class TestSessionManagement:
    """Test session creation and management."""

    def test_create_session(self):
        """Test session creation."""
        manager = SessionManager()
        session = manager.create_session(
            user_id="user_123",
            wallet_address="0x1234",
            jwt_token="token_123"
        )
        
        assert session.session_id is not None
        assert session.user_id == "user_123"
        assert session.wallet_address == "0x1234"
        assert not session.is_expired()

    def test_get_session(self):
        """Test session retrieval."""
        manager = SessionManager()
        session = manager.create_session(
            user_id="user_123",
            wallet_address="0x1234",
            jwt_token="token_123"
        )
        
        retrieved = manager.get_session(session.session_id)
        
        assert retrieved.session_id == session.session_id
        assert retrieved.user_id == session.user_id

    def test_validate_session(self):
        """Test session validation."""
        manager = SessionManager()
        session = manager.create_session(
            user_id="user_123",
            wallet_address="0x1234",
            jwt_token="token_123"
        )
        
        is_valid = manager.validate_session(session.session_id)
        
        assert is_valid is True

    def test_delete_session(self):
        """Test session deletion."""
        manager = SessionManager()
        session = manager.create_session(
            user_id="user_123",
            wallet_address="0x1234",
            jwt_token="token_123"
        )
        
        manager.delete_session(session.session_id)
        
        is_valid = manager.validate_session(session.session_id)
        assert is_valid is False


# ============================================================================
# COMPLETE AUTHENTICATION FLOW TESTS
# ============================================================================

class TestAuthFlow:
    """Test complete authentication flow."""

    def test_complete_flow(self, auth_flow, test_wallet):
        """Test complete authentication flow from challenge to validation."""
        # Step 1: Generate challenge
        challenge_data = auth_flow.generate_challenge()
        assert "challenge" in challenge_data
        
        # Step 2: User signs challenge
        message = encode_defunct(text=challenge_data["challenge"])
        signed_message = test_wallet["account"].sign_message(message)
        
        # Step 3: Authenticate and create session
        session = auth_flow.authenticate(
            wallet_address=test_wallet["address"],
            signature=signed_message.signature.hex(),
            challenge=challenge_data["challenge"]
        )
        
        assert session.wallet_address.lower() == test_wallet["address"].lower()
        assert session.jwt_token is not None
        
        # Step 4: Validate API request
        is_valid = auth_flow.validate_request(session.jwt_token)
        assert is_valid is True

    def test_invalid_signature_flow(self, auth_flow, test_wallet):
        """Test authentication rejects invalid signature."""
        challenge_data = auth_flow.generate_challenge()
        
        with pytest.raises(InvalidSignatureError):
            auth_flow.authenticate(
                wallet_address=test_wallet["address"],
                signature="0x" + "00" * 65,
                challenge=challenge_data["challenge"]
            )

    def test_logout(self, auth_flow, test_wallet):
        """Test logout functionality."""
        # Authenticate
        challenge_data = auth_flow.generate_challenge()
        message = encode_defunct(text=challenge_data["challenge"])
        signed_message = test_wallet["account"].sign_message(message)
        
        session = auth_flow.authenticate(
            wallet_address=test_wallet["address"],
            signature=signed_message.signature.hex(),
            challenge=challenge_data["challenge"]
        )
        
        # Logout
        auth_flow.logout(session.jwt_token)
        
        # Validate should fail
        is_valid = auth_flow.validate_request(session.jwt_token)
        assert is_valid is False


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestIntegration:
    """Test integration scenarios."""

    def test_multiple_devices(self, auth_flow, test_wallet):
        """Test user with multiple active sessions."""
        sessions = []
        
        # Create 3 sessions (3 devices)
        for i in range(3):
            challenge_data = auth_flow.generate_challenge()
            message = encode_defunct(text=challenge_data["challenge"])
            signed_message = test_wallet["account"].sign_message(message)
            
            session = auth_flow.authenticate(
                wallet_address=test_wallet["address"],
                signature=signed_message.signature.hex(),
                challenge=challenge_data["challenge"],
                device_info={"device": f"device_{i}"}
            )
            sessions.append(session)
        
        # All sessions should be valid
        for session in sessions:
            assert auth_flow.validate_request(session.jwt_token) is True

    def test_concurrent_requests(self, auth_flow, test_wallet):
        """Test concurrent API requests with same token."""
        # Authenticate
        challenge_data = auth_flow.generate_challenge()
        message = encode_defunct(text=challenge_data["challenge"])
        signed_message = test_wallet["account"].sign_message(message)
        
        session = auth_flow.authenticate(
            wallet_address=test_wallet["address"],
            signature=signed_message.signature.hex(),
            challenge=challenge_data["challenge"]
        )
        
        # Simulate concurrent requests
        for _ in range(10):
            is_valid = auth_flow.validate_request(session.jwt_token)
            assert is_valid is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
