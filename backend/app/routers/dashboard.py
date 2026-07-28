import datetime as dt
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=schemas.DashboardStats)
def stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    today = dt.date.today()
    month_start = today.replace(day=1)

    total_farmers = db.query(models.Farmer).filter(models.Farmer.is_active == True).count()  # noqa: E712
    active_requests = db.query(models.WaterRequest).filter(
        models.WaterRequest.status.in_([models.RequestStatus.pending, models.RequestStatus.approved])
    ).count()
    todays_schedule = db.query(models.WaterRequest).filter(models.WaterRequest.request_date == today).count()

    total_revenue = db.query(func.coalesce(func.sum(models.Payment.amount), 0.0)).filter(
        models.Payment.status == models.PaymentStatus.paid
    ).scalar()

    water_used_today = db.query(func.coalesce(func.sum(models.WaterRequest.total_hours), 0.0)).filter(
        models.WaterRequest.request_date == today
    ).scalar()

    monthly_income = db.query(func.coalesce(func.sum(models.Payment.amount), 0.0)).filter(
        models.Payment.status == models.PaymentStatus.paid,
        models.Payment.payment_date >= month_start,
    ).scalar()

    pending_payments = db.query(func.coalesce(func.sum(models.WaterRequest.total_amount), 0.0)).filter(
        models.WaterRequest.payment_status == models.PaymentStatus.pending
    ).scalar()

    active_pumps = db.query(models.Pump).filter(models.Pump.is_active == True).count()  # noqa: E712
    open_complaints = db.query(models.Complaint).filter(
        models.Complaint.status.in_([models.ComplaintStatus.open, models.ComplaintStatus.in_progress])
    ).count()
    unread_notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id, models.Notification.is_read == False  # noqa: E712
    ).count()

    return schemas.DashboardStats(
        total_farmers=total_farmers,
        active_water_requests=active_requests,
        todays_schedule=todays_schedule,
        total_revenue=total_revenue,
        water_used_today_hours=water_used_today,
        monthly_income=monthly_income,
        pending_payments=pending_payments,
        active_pumps=active_pumps,
        open_complaints=open_complaints,
        unread_notifications=unread_notifications,
    )


@router.get("/charts/water-usage")
def water_usage_chart(days: int = 14, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    since = dt.date.today() - dt.timedelta(days=days)
    rows = (
        db.query(models.WaterRequest.request_date, func.sum(models.WaterRequest.total_hours))
        .filter(models.WaterRequest.request_date >= since)
        .group_by(models.WaterRequest.request_date)
        .order_by(models.WaterRequest.request_date)
        .all()
    )
    return [{"label": str(d), "value": float(v or 0)} for d, v in rows]


@router.get("/charts/revenue")
def revenue_chart(days: int = 14, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    since = dt.datetime.utcnow() - dt.timedelta(days=days)
    rows = (
        db.query(func.date(models.Payment.payment_date), func.sum(models.Payment.amount))
        .filter(models.Payment.payment_date >= since, models.Payment.status == models.PaymentStatus.paid)
        .group_by(func.date(models.Payment.payment_date))
        .order_by(func.date(models.Payment.payment_date))
        .all()
    )
    return [{"label": str(d), "value": float(v or 0)} for d, v in rows]
