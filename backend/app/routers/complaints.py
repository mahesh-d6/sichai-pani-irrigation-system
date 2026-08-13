import datetime as dt
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles, STAFF_ROLES
from ..notify import notify_roles

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


@router.get("", response_model=List[schemas.ComplaintOut])
def list_complaints(
    status: Optional[models.ComplaintStatus] = None,
    farmer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Complaint)
    if current_user.role == models.UserRole.farmer:
        # Resolve farmer profile via relationship or DB lookup
        farmer_profile = current_user.farmer_profile
        if not farmer_profile:
            farmer_profile = db.query(models.Farmer).filter(
                (models.Farmer.user_id == current_user.id) |
                (models.Farmer.email == current_user.email)
            ).first()
        if not farmer_profile:
            return []  # No profile yet — return empty, not all complaints
        q = q.filter(models.Complaint.farmer_id == farmer_profile.id)
    if status:
        q = q.filter(models.Complaint.status == status)
    if farmer_id:
        q = q.filter(models.Complaint.farmer_id == farmer_id)
    return q.order_by(models.Complaint.id.desc()).all()


@router.post("", response_model=schemas.ComplaintOut, status_code=201)
def create_complaint(
    payload: schemas.ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Farmers can only file complaints for themselves — resolve from token
    if current_user.role == models.UserRole.farmer:
        farmer_profile = current_user.farmer_profile
        if not farmer_profile:
            farmer_profile = db.query(models.Farmer).filter(
                (models.Farmer.user_id == current_user.id) |
                (models.Farmer.email == current_user.email)
            ).first()
        if not farmer_profile:
            # Auto-create a minimal farmer profile
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
        farmer_id = farmer_profile.id
    else:
        farmer_id = payload.farmer_id
        if not farmer_id:
            raise HTTPException(400, "farmer_id is required for staff complaints")

    farmer = db.query(models.Farmer).filter(models.Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(404, "Farmer not found")

    complaint = models.Complaint(
        farmer_id=farmer_id,
        category=payload.category,
        description=payload.description,
        photo_url=payload.photo_url,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    notify_roles(
        db,
        [models.UserRole.super_admin, models.UserRole.admin],
        "New complaint filed",
        f"{farmer.full_name} filed a {complaint.category} complaint" + (f": {complaint.description[:80]}" if complaint.description else ""),
    )

    return complaint


@router.patch("/{complaint_id}/reply", response_model=schemas.ComplaintOut)
def reply_complaint(
    complaint_id: int,
    payload: schemas.ComplaintReply,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*STAFF_ROLES)),
):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(404, "Complaint not found")
    complaint.admin_reply = payload.admin_reply
    complaint.status = payload.status
    complaint.resolved_at = dt.datetime.utcnow()
    db.commit()
    db.refresh(complaint)
    return complaint
