from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles, ADMIN_ROLES, STAFF_ROLES

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])
infra_router = APIRouter(prefix="/api/infra", tags=["canals-pumps"])
notifications_router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ---------- Settings ----------

@settings_router.get("")
def get_settings(db: Session = Depends(get_db), _=Depends(require_roles(*ADMIN_ROLES))):
    rows = db.query(models.Setting).all()
    return {r.key: r.value for r in rows}


@settings_router.put("")
def update_setting(payload: schemas.SettingUpdate, db: Session = Depends(get_db), _=Depends(require_roles(*ADMIN_ROLES))):
    row = db.query(models.Setting).filter(models.Setting.key == payload.key).first()
    if row:
        row.value = payload.value
    else:
        row = models.Setting(key=payload.key, value=payload.value)
        db.add(row)
    db.commit()
    return {"key": payload.key, "value": payload.value}


# ---------- Canals & Pumps ----------

@infra_router.get("/canals", response_model=List[schemas.CanalOut])
def list_canals(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Canal).filter(models.Canal.is_active == True).all()  # noqa: E712


@infra_router.get("/pumps", response_model=List[schemas.PumpOut])
def list_pumps(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Pump).filter(models.Pump.is_active == True).all()  # noqa: E712


@infra_router.post("/canals", response_model=schemas.CanalOut, status_code=201)
def create_canal(name: str, location: str = "", db: Session = Depends(get_db), _=Depends(require_roles(*STAFF_ROLES))):
    canal = models.Canal(name=name, location=location)
    db.add(canal)
    db.commit()
    db.refresh(canal)
    return canal


@infra_router.post("/pumps", response_model=schemas.PumpOut, status_code=201)
def create_pump(name: str, canal_id: int | None = None, db: Session = Depends(get_db), _=Depends(require_roles(*STAFF_ROLES))):
    pump = models.Pump(name=name, canal_id=canal_id)
    db.add(pump)
    db.commit()
    db.refresh(pump)
    return pump


# ---------- Notifications ----------

@notifications_router.get("", response_model=List[schemas.NotificationOut])
def list_notifications(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.id.desc())
        .all()
    )


@notifications_router.patch("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    n = db.query(models.Notification).filter(
        models.Notification.id == notification_id, models.Notification.user_id == current_user.id
    ).first()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.is_read = True
    db.commit()
    return {"message": "marked read"}


@notifications_router.post("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id, models.Notification.is_read.is_(False)
    ).update({"is_read": True})
    db.commit()
    return {"message": "all marked read"}
