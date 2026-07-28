import datetime as dt
import re
import secrets
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def normalize_username(username: str) -> str:
    """
    Farmer usernames are matched case-insensitively and with surrounding
    whitespace trimmed -- e.g. "Pradeep123", "pradeep123 ", and
    "PRADEEP123" all refer to the same account. Without this, a mobile
    keyboard auto-capitalizing the first letter, or a stray space from
    copy-pasting a shared credential, silently fails to match and looks
    like a broken login/forgot-password flow rather than a typo.
    """
    return username.strip().lower()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def validate_strong_password(password: str) -> None:
    """
    Raises HTTPException(400) with a specific reason if the password
    doesn't meet the minimum strength bar: length, upper/lower case,
    a digit, and a special character.
    """
    problems = []
    if len(password) < settings.min_password_length:
        problems.append(f"at least {settings.min_password_length} characters")
    if not re.search(r"[A-Z]", password):
        problems.append("an uppercase letter")
    if not re.search(r"[a-z]", password):
        problems.append("a lowercase letter")
    if not re.search(r"\d", password):
        problems.append("a number")
    if not re.search(r"[^A-Za-z0-9]", password):
        problems.append("a special character")
    if problems:
        raise HTTPException(400, f"Password must contain {', '.join(problems)}.")


def new_session_id() -> str:
    """A random opaque token identifying one logged-in device/session."""
    return secrets.token_hex(24)


def create_access_token(subject: str, extra: Optional[dict] = None, expires_minutes: Optional[int] = None) -> str:
    to_encode = {"sub": subject}
    if extra:
        to_encode.update(extra)
    expire = dt.datetime.utcnow() + dt.timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
