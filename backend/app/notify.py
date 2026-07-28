"""
Shared helper for creating in-app notifications. Used any time an event
happens that someone else needs to know about: a farmer's new water
request (Operator + Admin), a new complaint (Admin), a payment awaiting
verification (Admin), or a new device signing into an Admin account
(that same Admin).
"""
from typing import Iterable
from sqlalchemy.orm import Session

from . import models


def notify_roles(db: Session, roles: Iterable["models.UserRole"], title: str, message: str) -> None:
    """Creates one Notification per active user whose role is in `roles`."""
    users = db.query(models.User).filter(models.User.role.in_(list(roles)), models.User.is_active.is_(True)).all()
    for user in users:
        db.add(models.Notification(user_id=user.id, title=title, message=message))
    db.commit()


def notify_user(db: Session, user_id: int, title: str, message: str) -> None:
    db.add(models.Notification(user_id=user_id, title=title, message=message))
    db.commit()
