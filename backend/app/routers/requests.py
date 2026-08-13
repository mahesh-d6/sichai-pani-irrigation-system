import datetime as dt
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..config import settings
from ..notify import notify_roles

router = APIRouter(prefix="/api/requests", tags=["water-requests"])


def compute_hours_and_amount(start: dt.time, end: dt.time, rate_per_hour: float) -> tuple[float, float]:
    """
    Core billing calculation used everywhere a water request is created,
    edited, or rescheduled.

    total_hours = (end - start) in hours, rounded to the nearest 0.25h
    total_amount = total_hours * rate_per_hour
    """
    today = dt.date.today()
    start_dt = dt.datetime.combine(today, start)
    end_dt = dt.datetime.combine(today, end)
    if end_dt <= start_dt:
        # Supports overnight irrigation windows (e.g. 22:00 -> 02:00)
        end_dt += dt.timedelta(days=1)

    delta_hours = (end_dt - start_dt).total_seconds() / 3600
    total_hours = round(delta_hours * 4) / 4  # round to nearest quarter hour
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
        farmer_profile = current_user.farmer_profile
        if not farmer_profile:
            # Look up by user_id or email as fallback
            farmer_profile = db.query(models.Farmer).filter(
                (models.Farmer.user_id == current_user.id) |
                (models.Farmer.email == current_user.email)
            ).first()
        if not farmer_profile:
            # No farmer profile yet — return empty list, not all requests
            return []
        q = q.filter(models.WaterRequest.farmer_id == farmer_profile.id)
    if farmer_id:
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
    """Live calculation endpoint the frontend calls as the farmer picks times."""
    rate = rate_per_hour or settings.water_rate_per_hour
    total_hours, total_amount = compute_hours_and_amount(start_time, end_time, rate)
    return {"total_hours": total_hours, "rate_per_hour": rate, "total_amount": total_amount}


@router.post("", response_model=schemas.WaterRequestOut, status_code=201)
def create_request(
    payload: schemas.WaterRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # A farmer can only ever file a request for themselves -- the
    # farmer_id in the payload is ignored/overridden for farmer-role
    # callers rather than trusted, otherwise any farmer could submit (and
    # bill) a request under a different farmer's name.
    if current_user.role == models.UserRole.farmer:
        farmer_profile = current_user.farmer_profile
        if not farmer_profile:
            farmer_profile = db.query(models.Farmer).filter(
                (models.Farmer.user_id == current_user.id) |
                (models.Farmer.email == current_user.email)
            ).first()
            if not farmer_profile:
                code = f"FARM-{current_user.id:04d}"
                farmer_profile = models.Farmer(
                    user_id=current_user.id,
                    farmer_code=code,
                    full_name=current_user.full_name or "Farmer User",
                    mobile_number=current_user.mobile_number or "9800000000",
                    email=current_user.email,
                )
                db.add(farmer_profile)
                db.commit()
                db.refresh(farmer_profile)
            else:
                farmer_profile.user_id = current_user.id
                db.commit()
        farmer_id = farmer_profile.id
    else:
        farmer_id = payload.farmer_id

    farmer = db.query(models.Farmer).filter(models.Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(404, "Farmer not found")

    rate = settings.water_rate_per_hour
    if payload.start_time and payload.end_time:
        total_hours, total_amount = compute_hours_and_amount(payload.start_time, payload.end_time, rate)
    else:
        # No time window given -- this is now the normal case. Billing is
        # entirely determined by the Operator's actual Start/Stop times
        # once they act on this request, not by anything the farmer enters.
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
        [models.UserRole.water_operator],
        "New water request",
        f"{farmer.full_name} requested water for {wr.request_date}" + (f" ({wr.crop})" if wr.crop else ""),
    )

    return wr


@router.patch("/{request_id}/status", response_model=schemas.WaterRequestOut)
def update_status(
    request_id: int,
    payload: schemas.WaterRequestStatusUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("water_operator")),
):
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Water request not found")

    wr.status = payload.status
    if payload.operator_id:
        wr.operator_id = payload.operator_id

    # Reschedule support: recompute hours/amount if the time window changes.
    changed_time = False
    if payload.request_date:
        wr.request_date = payload.request_date
        changed_time = True
    if payload.start_time:
        wr.start_time = payload.start_time
        changed_time = True
    if payload.end_time:
        wr.end_time = payload.end_time
        changed_time = True
    if changed_time:
        wr.total_hours, wr.total_amount = compute_hours_and_amount(wr.start_time, wr.end_time, wr.rate_per_hour)

    db.commit()
    db.refresh(wr)
    return wr


@router.get("/{request_id}", response_model=schemas.WaterRequestOut)
def get_request(request_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Water request not found")
    return wr


@router.post("/{request_id}/start", response_model=schemas.WaterRequestOut)
def start_water(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("water_operator")),
):
    """
    Operator presses Start when they physically open the valve/pump for
    this farmer. Records the real start time -- this, not the farmer's
    originally requested window, is what the final bill is based on.
    """
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Water request not found")
    if wr.status not in (models.RequestStatus.pending, models.RequestStatus.approved):
        raise HTTPException(409, f"Cannot start water for a request that is '{wr.status.value}'")
    if wr.actual_start_time:
        raise HTTPException(409, "Water has already been started for this request")

    wr.actual_start_time = dt.datetime.utcnow()
    wr.accumulated_seconds = 0.0
    wr.status = models.RequestStatus.in_progress
    wr.operator_id = current_user.id
    db.commit()
    db.refresh(wr)
    return wr


@router.post("/{request_id}/pause", response_model=schemas.WaterRequestOut)
def pause_water(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("water_operator")),
):
    """
    Operator presses Pause when electricity/power supply cuts off or pump stops unexpectedly.
    Pauses the timer and accumulates active delivery time so far.
    """
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Water request not found")
    if wr.status != models.RequestStatus.in_progress:
        raise HTTPException(409, "Can only pause a water request that is currently in progress")

    now = dt.datetime.utcnow()
    if wr.actual_start_time:
        delta = (now - wr.actual_start_time).total_seconds()
        wr.accumulated_seconds = (wr.accumulated_seconds or 0.0) + delta
        wr.actual_start_time = None

    wr.status = models.RequestStatus.paused
    wr.actual_total_hours = round((wr.accumulated_seconds or 0.0) / 3600.0, 2)
    db.commit()
    db.refresh(wr)
    return wr


@router.post("/{request_id}/resume", response_model=schemas.WaterRequestOut)
def resume_water(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("water_operator")),
):
    """
    Operator presses Resume when electricity/power returns.
    Restarts the active delivery timer.
    """
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Water request not found")
    if wr.status != models.RequestStatus.paused:
        raise HTTPException(409, "Can only resume a paused water request")

    wr.actual_start_time = dt.datetime.utcnow()
    wr.status = models.RequestStatus.in_progress
    db.commit()
    db.refresh(wr)
    return wr


@router.post("/{request_id}/stop", response_model=schemas.WaterRequestOut)
def stop_water(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("water_operator")),
):
    """
    Operator presses Stop when water delivery finishes.
    Computes total active delivery duration (excluding electricity cuts) and rebills the request.
    """
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == request_id).first()
    if not wr:
        raise HTTPException(404, "Water request not found")
    if wr.status not in (models.RequestStatus.in_progress, models.RequestStatus.paused):
        raise HTTPException(409, "Water hasn't been started or is already completed")
    if wr.actual_end_time:
        raise HTTPException(409, "Water has already been stopped for this request")

    now = dt.datetime.utcnow()
    total_sec = wr.accumulated_seconds or 0.0
    if wr.status == models.RequestStatus.in_progress and wr.actual_start_time:
        total_sec += (now - wr.actual_start_time).total_seconds()

    wr.actual_end_time = now
    wr.accumulated_seconds = total_sec
    elapsed_hours = total_sec / 3600.0
    wr.actual_total_hours = round(elapsed_hours, 2)

    # Re-bill on the real, actual active duration.
    wr.total_hours = wr.actual_total_hours
    wr.total_amount = round(wr.actual_total_hours * wr.rate_per_hour, 2)
    wr.status = models.RequestStatus.completed

    db.commit()
    db.refresh(wr)
    return wr
