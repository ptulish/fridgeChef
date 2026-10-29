import hashlib
import secrets
import base64
import json
import hmac
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from app.core.config import settings

SECRET_KEY = getattr(settings, "JWT_SECRET", "fridgechef-secret-jwt-key-2026-supersecure-long-string")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 with a random 16-byte salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}:{key.hex()}"


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """Verify a plain password against the stored salt:hash string."""
    if not hashed_password or ":" not in hashed_password:
        return False
    try:
        salt, key = hashed_password.split(":")
        new_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return hmac.compare_digest(key, new_key.hex())
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a standard RFC 7519 JWT token signed with HMAC-SHA256."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": int(expire.timestamp()), "iat": int(datetime.now(timezone.utc).timestamp())})

    header = {"alg": ALGORITHM, "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=").decode()
    payload_b64 = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).rstrip(b"=").decode()

    signing_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a standard RFC 7519 JWT token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode()
        expected_sig = hmac.new(SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()

        # Pad base64 signature
        pad_sig = 4 - (len(signature_b64) % 4)
        if pad_sig != 4:
            signature_b64 += "=" * pad_sig
        actual_sig = base64.urlsafe_b64decode(signature_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        # Decode payload
        pad_p = 4 - (len(payload_b64) % 4)
        if pad_p != 4:
            payload_b64 += "=" * pad_p
        payload_json = base64.urlsafe_b64decode(payload_b64).decode()
        payload = json.loads(payload_json)

        # Check expiration
        if "exp" in payload and datetime.now(timezone.utc).timestamp() > payload["exp"]:
            return None

        return payload
    except Exception:
        return None
