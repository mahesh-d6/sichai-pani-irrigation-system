"""
Shared helper for creating in-app notifications and automated payment reminders.
"""
import datetime as dt
from typing import Iterable
from sqlalchemy.orm import Session

from . import models


def notify_roles(db: Session, roles: Iterable["models.UserRole"], title: str, message: str) -> None:
    """Creates one Notification per active user whose role is in `roles`."""
    users = db.query(models.User).filter(models.User.role.in_(list(roles)), models.User.is_active.is_(True)).all()
    for user in users:
        db.add(models.Notification(user_id=user.id, title=title, message=message))
    try:
        db.commit()
    except Exception:
        db.rollback()


def notify_user(db: Session, user_id: int, title: str, message: str) -> None:
    """Creates a Notification for a specific user."""
    db.add(models.Notification(user_id=user_id, title=title, message=message))
    try:
        db.commit()
    except Exception:
        db.rollback()


def check_and_notify_overdue_payments(db: Session) -> None:
    """
    Checks for completed water requests with pending payments that are 7+ days (1 week) old.
    Automatically sends an overdue payment notification to the farmer's user account.
    """
    seven_days_ago = dt.date.today() - dt.timedelta(days=7)

    overdue_requests = db.query(models.WaterRequest).filter(
        models.WaterRequest.status == models.RequestStatus.completed,
        models.WaterRequest.payment_status == models.PaymentStatus.pending,
        models.WaterRequest.request_date <= seven_days_ago,
    ).all()

    for req in overdue_requests:
        farmer = db.query(models.Farmer).filter(models.Farmer.id == req.farmer_id).first()
        if not farmer or not farmer.user_id:
            continue

        title = f"Payment Due Reminder (Request #{req.id})"
        existing = db.query(models.Notification).filter(
            models.Notification.user_id == farmer.user_id,
            models.Notification.title == title,
        ).first()

        if not existing:
            msg = (
                f"Your payment of Rs.{req.total_amount} for irrigation on {req.request_date} "
                f"({req.crop or 'Crop'}) is pending for over 1 week. Please clear your bill."
            )
            db.add(models.Notification(user_id=farmer.user_id, title=title, message=msg))

    try:
        db.commit()
    except Exception:
        db.rollback()
