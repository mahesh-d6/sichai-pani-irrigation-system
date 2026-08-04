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
    try:
        today = dt.date.today()
        month_start = today.replace(day=1)

        farmer_profile = None
        if current_user.role == models.UserRole.farmer:
            farmer_profile = db.query(models.Farmer).filter(models.Farmer.user_id == current_user.id).first()

        total_farmers = db.query(models.Farmer).filter(models.Farmer.is_active == True).count()

        req_q = db.query(models.WaterRequest)
        if farmer_profile:
            req_q = req_q.filter(models.WaterRequest.farmer_id == farmer_profile.id)

        active_requests = req_q.filter(
            models.WaterRequest.status.in_([
                models.RequestStatus.pending,
                models.RequestStatus.approved,
                models.RequestStatus.in_progress,
                models.RequestStatus.paused,
            ])
        ).count()

        todays_schedule = req_q.filter(models.WaterRequest.request_date == today).count()

        total_revenue = db.query(func.coalesce(func.sum(models.Payment.amount), 0.0)).filter(
            models.Payment.status == models.PaymentStatus.paid
        )
        if farmer_profile:
            total_revenue = total_revenue.filter(models.Payment.farmer_id == farmer_profile.id)
        total_revenue_val = float(total_revenue.scalar() or 0.0)

        water_used_today = db.query(func.coalesce(func.sum(models.WaterRequest.actual_total_hours), func.sum(models.WaterRequest.total_hours), 0.0)).filter(
            models.WaterRequest.request_date == today
        )
        if farmer_profile:
            water_used_today = water_used_today.filter(models.WaterRequest.farmer_id == farmer_profile.id)
        water_used_today_val = float(water_used_today.scalar() or 0.0)

        monthly_income = db.query(func.coalesce(func.sum(models.Payment.amount), 0.0)).filter(
            models.Payment.status == models.PaymentStatus.paid,
            models.Payment.payment_date >= month_start,
        )
        if farmer_profile:
            monthly_income = monthly_income.filter(models.Payment.farmer_id == farmer_profile.id)
        monthly_income_val = float(monthly_income.scalar() or 0.0)

        pending_payments = db.query(func.coalesce(func.sum(models.WaterRequest.total_amount), 0.0)).filter(
            models.WaterRequest.payment_status == models.PaymentStatus.pending
        )
        if farmer_profile:
            pending_payments = pending_payments.filter(models.WaterRequest.farmer_id == farmer_profile.id)
        pending_payments_val = float(pending_payments.scalar() or 0.0)

        active_pumps = db.query(models.Pump).filter(models.Pump.is_active == True).count()

        comp_q = db.query(models.Complaint)
        if farmer_profile:
            comp_q = comp_q.filter(models.Complaint.farmer_id == farmer_profile.id)
        open_complaints = comp_q.filter(
            models.Complaint.status.in_([models.ComplaintStatus.open, models.ComplaintStatus.in_progress])
        ).count()

        unread_notifications = db.query(models.Notification).filter(
            models.Notification.user_id == current_user.id, models.Notification.is_read == False
        ).count()

        return schemas.DashboardStats(
            total_farmers=total_farmers,
            active_water_requests=active_requests,
            todays_schedule=todays_schedule,
            total_revenue=total_revenue_val,
            water_used_today_hours=water_used_today_val,
            monthly_income=monthly_income_val,
            pending_payments=pending_payments_val,
            active_pumps=active_pumps,
            open_complaints=open_complaints,
            unread_notifications=unread_notifications,
        )
    except Exception as err:
        print("Dashboard stats error:", err)
        return schemas.DashboardStats(
            total_farmers=0,
            active_water_requests=0,
            todays_schedule=0,
            total_revenue=0.0,
            water_used_today_hours=0.0,
            monthly_income=0.0,
            pending_payments=0.0,
            active_pumps=0,
            open_complaints=0,
            unread_notifications=0,
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
