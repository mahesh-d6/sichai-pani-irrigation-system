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
    if current_user.role == models.UserRole.farmer and current_user.farmer_profile:
        q = q.filter(models.Complaint.farmer_id == current_user.farmer_profile.id)
    if status:
        q = q.filter(models.Complaint.status == status)
    if farmer_id:
        q = q.filter(models.Complaint.farmer_id == farmer_id)
    return q.order_by(models.Complaint.id.desc()).all()


@router.post("", response_model=schemas.ComplaintOut, status_code=201)
def create_complaint(payload: schemas.ComplaintCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Same rule as water requests: a farmer can only ever file a
    # complaint for themselves -- the farmer_id in the payload is
    # ignored/overridden for farmer-role callers rather than trusted.
    data = payload.model_dump()
    if current_user.role == models.UserRole.farmer:
        if not current_user.farmer_profile:
            raise HTTPException(403, "No farmer profile linked to this account")
        data["farmer_id"] = current_user.farmer_profile.id

    farmer = db.query(models.Farmer).filter(models.Farmer.id == data["farmer_id"]).first()
    if not farmer:
        raise HTTPException(404, "Farmer not found")

    complaint = models.Complaint(**data)
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
