from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles, ADMIN_ROLES
from ..auth import hash_password, validate_strong_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=List[schemas.UserOut])
def list_users(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    q = db.query(models.User)
    if role:
        q = q.filter(models.User.role == role)
    return q.order_by(models.User.id.desc()).all()


@router.post("/operator", response_model=schemas.UserOut, status_code=201)
def create_operator(
    payload: schemas.OperatorCreateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    """
    Only one Operator account is allowed in the whole system. An Admin
    creates it once; there is no public operator self-registration.
    """
    existing = db.query(models.User).filter(models.User.role == models.UserRole.water_operator).count()
    if existing >= 1:
        raise HTTPException(403, "An Operator account already exists. Only one is allowed system-wide.")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(400, "An account with this email already exists")

    validate_strong_password(payload.password)

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=models.UserRole.water_operator,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/role", response_model=schemas.UserOut)
def update_role(
    user_id: int,
    role: models.UserRole,
    db: Session = Depends(get_db),
    _=Depends(require_roles("super_admin")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    # Guard the same caps here that apply at account-creation time, so a
    # role change can't be used to sneak past them.
    if role.value in ("super_admin", "admin") and user.role.value not in ("super_admin", "admin"):
        from .. import config
        count = db.query(models.User).filter(models.User.role.in_(["super_admin", "admin"])).count()
        if count >= config.settings.max_admin_accounts:
            raise HTTPException(403, f"Only {config.settings.max_admin_accounts} Admin accounts are allowed.")
    if role == models.UserRole.water_operator and user.role != models.UserRole.water_operator:
        count = db.query(models.User).filter(models.User.role == models.UserRole.water_operator).count()
        if count >= 1:
            raise HTTPException(403, "Only one Operator account is allowed system-wide.")

    user.role = role
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/status", response_model=schemas.UserOut)
def toggle_active(
    user_id: int,
    is_active: bool,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("super_admin")),
):
    """
    Permanently delete a user account (super_admin only).
    The two default seeded accounts and the currently logged-in admin
    are protected and cannot be deleted.
    """
    PROTECTED_EMAILS = {"admin@sichaipani.com", "operator@sichaipani.com"}

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.email in PROTECTED_EMAILS:
        raise HTTPException(403, "Cannot delete the default system accounts.")
    if user.id == current_user.id:
        raise HTTPException(403, "You cannot delete your own account.")

    # Cascade: delete farmer profile data linked to this user
    farmer = db.query(models.Farmer).filter(models.Farmer.user_id == user_id).first()
    if farmer:
        db.query(models.Payment).filter(models.Payment.farmer_id == farmer.id).delete()
        db.query(models.WaterRequest).filter(models.WaterRequest.farmer_id == farmer.id).delete()
        db.delete(farmer)

    # Delete login history and notifications
    db.query(models.LoginLog).filter(models.LoginLog.user_id == user_id).delete()
    db.query(models.Notification).filter(models.Notification.user_id == user_id).delete()

    db.delete(user)
    db.commit()
