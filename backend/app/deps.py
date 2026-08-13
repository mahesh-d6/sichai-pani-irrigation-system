from typing import List, Optional
import time
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .auth import decode_access_token
from . import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/farmer/login", auto_error=False)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exception

    if user.role.value in ("super_admin", "admin") and user.active_session_id:
        token_session_id = payload.get("session_id")
        if token_session_id != user.active_session_id:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "You have been logged out because this account was accessed from another device.",
            )

    return user


def get_or_create_farmer_profile(db: Session, user: models.User) -> models.Farmer:
    """
    Safely retrieves or creates a linked Farmer profile for any user with the farmer role.
    Guarantees unique farmer_code and valid mobile_number to prevent DB integrity errors.
    """
    if user.farmer_profile:
        return user.farmer_profile

    # Look up existing profile by user_id or email
    farmer = db.query(models.Farmer).filter(
        (models.Farmer.user_id == user.id) |
        (user.email.isnot(None) & (models.Farmer.email == user.email))
    ).first()

    if farmer:
        if farmer.user_id != user.id:
            farmer.user_id = user.id
            db.commit()
            db.refresh(farmer)
        return farmer

    # Generate unique farmer_code
    base_code = f"FARM-{user.id:04d}"
    code = base_code
    idx = 1
    while db.query(models.Farmer).filter(models.Farmer.farmer_code == code).first():
        code = f"{base_code}-{idx}"
        idx += 1

    mobile = user.mobile_number or f"98{user.id:08d}"[:10]

    farmer = models.Farmer(
        user_id=user.id,
        farmer_code=code,
        full_name=user.full_name or "Farmer User",
        mobile_number=mobile,
        email=user.email,
        is_active=True,
    )
    db.add(farmer)
    db.commit()
    db.refresh(farmer)
    return farmer


def require_roles(*roles: str):
    """Dependency factory for Role-Based Access Control on a route."""

    def checker(user: models.User = Depends(get_current_user)) -> models.User:
        if user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return checker


ADMIN_ROLES = ("super_admin", "admin")
STAFF_ROLES = ("super_admin", "admin", "water_operator")
