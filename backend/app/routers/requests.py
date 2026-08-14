import datetime as dt
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles, get_or_create_farmer_profile, STAFF_ROLES
from ..config import settings
from ..notify import notify_roles, notify_user


router = APIRouter(prefix="/api/requests", tags=["water-requests"])


def compute_hours_and_amount(start: dt.time, end: dt.time, rate_per_hour: float) -> tuple[float, float]:
    today = dt.date.today()
    start_dt = dt.datetime.combine(today, start)
    end_dt = dt.datetime.combine(today, end)
    if end_dt <= start_dt:
        end_dt += dt.timedelta(days=1)

    delta_hours = (end_dt - start_dt).total_seconds() / 3600
    total_hours = round(delta_hours * 4) / 4
    total_amount = round(total_hours * rate_per_hour, 2)
    return total_hours, total_amount


@router.get("", response_model=List[schemas.WaterRequestOut])
def list_requests(
    farmer_id: Optional[int] = None,
    status: Optional[models.RequestStatus] = None,
    payment_status: Optional[models.PaymentStatus] = None,
    date_from: Optional[dt.date] = None,
    date_to: Optional[dt.date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.WaterRequest)
    if current_user.role == models.UserRole.farmer:
        farmer_profile = get_or_create_farmer_profile(db, current_user)
        q = q.filter(models.WaterRequest.farmer_id == farmer_profile.id)
    elif farmer_id:
        q = q.filter(models.WaterRequest.farmer_id == farmer_id)

    if status:
        q = q.filter(models.WaterRequest.status == status)
    if payment_status:
        q = q.filter(models.WaterRequest.payment_status == payment_status)
    if date_from:
        q = q.filter(models.WaterRequest.request_date >= date_from)
    if date_to:
        q = q.filter(models.WaterRequest.request_date <= date_to)
    return q.order_by(models.WaterRequest.id.desc()).all()


@router.post("/calculate")
def calculate_preview(start_time: dt.time, end_time: dt.time, rate_per_hour: Optional[float] = None):
    rate = rate_per_hour or settings.water_rate_per_hour
    total_hours, total_amount = compute_hours_and_amount(start_time, end_time, rate)
    return {"total_hours": total_hours, "rate_per_hour": rate, "total_amount": total_amount}


@router.post("", response_model=schemas.WaterRequestOut, status_code=201)
def create_request(
    payload: schemas.WaterRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == models.UserRole.farmer:
        farmer_profile = get_or_create_farmer_profile(db, current_user)
        farmer_id = farmer_profile.id
    else:
        farmer_id = payload.farmer_id
        if not farmer_id:
            raise HTTPException(400, "farmer_id is required for admin/operator requests")

    farmer = db.query(models.Farmer).filter(models.Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(404, "Farmer not found")

    rate = settings.water_rate_per_hour
    if payload.start_time and payload.end_time:
        total_hours, total_amount = compute_hours_and_amount(payload.start_time, payload.end_time, rate)
    else:
        total_hours, total_amount = 0.0, 0.0

    wr = models.WaterRequest(
        farmer_id=farmer_id,
        request_date=payload.request_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        total_hours=total_hours,
        crop=payload.crop,
        canal_id=payload.canal_id,
        pump_id=payload.pump_id,
        remarks=payload.remarks,
        rate_per_hour=rate,
        total_amount=total_amount,
    )
    db.add(wr)
    db.commit()
    db.refresh(wr)

    notify_roles(
        db,
        [models.UserRole.water_operator, models.UserRole.super_admin, models.UserRole.admin],
        "New water request",
        f"Farmer {farmer.full_name} requested water for {payload.request_date}" + (f" ({payload.crop})" if payload.crop else ""),
    )

    return wr


@router.patch("/{request_id}/status", response_model=schemas.WaterRequestOut)
def update_status(
    request_id: int,
    payload: schemas.WaterRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Request not found")

    old_status = wr.status
    new_status = payload.status
    wr.status = new_status

    if payload.operator_id:
        wr.operator_id = payload.operator_id

    now = dt.datetime.utcnow()

    if new_status == models.RequestStatus.in_progress:
        if not wr.actual_start_time:
            wr.actual_start_time = now
    elif new_status in (models.RequestStatus.completed, models.RequestStatus.paused):
        if wr.actual_start_time:
            delta = (now - wr.actual_start_time).total_seconds()
            prev_acc = wr.accumulated_seconds or 0.0
            total_sec = prev_acc + delta
            wr.accumulated_seconds = total_sec

            if new_status == models.RequestStatus.completed:
                wr.actual_end_time = now
                hrs = round((total_sec / 3600.0) * 4) / 4
                if hrs < 0.25 and total_sec > 0:
                    hrs = 0.25
                wr.actual_total_hours = hrs
                wr.total_hours = hrs
                wr.total_amount = round(hrs * wr.rate_per_hour, 2)
            else:
                wr.actual_start_time = None

    db.commit()
    db.refresh(wr)
    return wr


@router.post("/{request_id}/start", response_model=schemas.WaterRequestOut)
def start_water(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Request not found")
    now = dt.datetime.utcnow()
    wr.status = models.RequestStatus.in_progress
    wr.operator_id = current_user.id
    if not wr.actual_start_time:
        wr.actual_start_time = now
    db.commit()
    db.refresh(wr)
    return wr


@router.post("/{request_id}/pause", response_model=schemas.WaterRequestOut)
def pause_water(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Request not found")
    now = dt.datetime.utcnow()
    wr.status = models.RequestStatus.paused
    if wr.actual_start_time:
        delta = (now - wr.actual_start_time).total_seconds()
        wr.accumulated_seconds = (wr.accumulated_seconds or 0.0) + delta
        wr.actual_start_time = None
    db.commit()
    db.refresh(wr)
    return wr


@router.post("/{request_id}/resume", response_model=schemas.WaterRequestOut)
def resume_water(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Request not found")
    now = dt.datetime.utcnow()
    wr.status = models.RequestStatus.in_progress
    wr.actual_start_time = now
    db.commit()
    db.refresh(wr)
    return wr


@router.post("/{request_id}/stop", response_model=schemas.WaterRequestOut)
def stop_water(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*STAFF_ROLES)),
):
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Request not found")
    now = dt.datetime.utcnow()
    wr.status = models.RequestStatus.completed
    wr.actual_end_time = now

    total_sec = wr.accumulated_seconds or 0.0
    if wr.actual_start_time:
        total_sec += (now - wr.actual_start_time).total_seconds()

    wr.accumulated_seconds = total_sec
    hrs = round((total_sec / 3600.0) * 4) / 4
    if hrs < 0.25 and total_sec > 0:
        hrs = 0.25
    wr.actual_total_hours = hrs
    wr.total_hours = hrs
    wr.total_amount = round(hrs * wr.rate_per_hour, 2)
    db.commit()
    db.refresh(wr)

    farmer = db.query(models.Farmer).filter(models.Farmer.id == wr.farmer_id).first()
    if farmer and farmer.user_id:
        notify_user(
            db,
            farmer.user_id,
            f"Water Request Completed (Request #{wr.id})",
            f"Water delivery for {wr.crop or 'your crop'} is completed ({hrs} hrs). Total Bill: Rs.{wr.total_amount}. Please make your payment.",
        )

    return wr

