from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles, ADMIN_ROLES
from ..auth import hash_password, validate_strong_password, normalize_username

router = APIRouter(prefix="/api/farmers", tags=["farmers"])


@router.get("", response_model=List[schemas.FarmerOut])
def list_farmers(
    search: Optional[str] = Query(None, description="Search by name, phone or village"),
    village: Optional[str] = None,
    include_inactive: bool = Query(False, description="Also include deactivated (soft-deleted) farmers"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # A farmer calling this only ever sees their own record -- otherwise
    # every farmer could browse every other farmer's name, phone number,
    # village, and land details via this same endpoint.
    if current_user.role == models.UserRole.farmer:
        if not current_user.farmer_profile:
            return []
        return [current_user.farmer_profile]

    q = db.query(models.Farmer)
    if not include_inactive:
        q = q.filter(models.Farmer.is_active.is_(True))
    if search:
        like = f"%{search}%"
        q = q.filter(
            (models.Farmer.full_name.ilike(like))
            | (models.Farmer.mobile_number.ilike(like))
            | (models.Farmer.village.ilike(like))
        )
    if village:
        q = q.filter(models.Farmer.village == village)
    return q.order_by(models.Farmer.id.desc()).all()


from sqlalchemy.exc import IntegrityError

@router.post("", response_model=schemas.FarmerOut, status_code=201)
def create_farmer(
    payload: schemas.FarmerCreateByAdmin,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    """
    Farmer accounts can only be created by an Admin. The admin sets a
    username, a temporary password (which the farmer must change on
    first login), and three security questions/answers used for the
    "forgot password" flow.
    """
    normalized_username = normalize_username(payload.username)
    if db.query(models.User).filter(models.User.username == normalized_username).first():
        raise HTTPException(400, f"The username '{normalized_username}' is already taken. Please choose another username.")
    
    clean_email = payload.email.strip().lower() if (payload.email and payload.email.strip()) else None
    if clean_email and db.query(models.User).filter(models.User.email == clean_email).first():
        raise HTTPException(400, f"An account with email '{clean_email}' already exists.")

    clean_mobile = payload.mobile_number.strip()
    if clean_mobile and db.query(models.User).filter(models.User.mobile_number == clean_mobile).first():
        raise HTTPException(400, f"An account with mobile number '{clean_mobile}' already exists.")

    validate_strong_password(payload.temp_password)

    def norm(a: str) -> str:
        return (a or "answer").strip().lower()

    q1 = payload.security_question_1 or "What is your Name?"
    q2 = payload.security_question_2 or "What is your Village?"
    q3 = payload.security_question_3 or "What is your Crop?"

    user = models.User(
        full_name=payload.full_name.strip(),
        username=normalized_username,
        email=clean_email,
        mobile_number=clean_mobile,
        hashed_password=hash_password(payload.temp_password),
        role=models.UserRole.farmer,
        must_change_password=True,
        security_question_1=q1,
        security_answer_1_hash=hash_password(norm(payload.security_answer_1)),
        security_question_2=q2,
        security_answer_2_hash=hash_password(norm(payload.security_answer_2)),
        security_question_3=q3,
        security_answer_3_hash=hash_password(norm(payload.security_answer_3)),
    )
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError as err:
        db.rollback()
        err_msg = str(err.orig) if hasattr(err, "orig") else str(err)
        if "username" in err_msg.lower():
            raise HTTPException(400, f"Username '{normalized_username}' is already taken.")
        if "mobile" in err_msg.lower() or "phone" in err_msg.lower():
            raise HTTPException(400, f"Mobile number '{clean_mobile}' is already registered.")
        if "email" in err_msg.lower():
            raise HTTPException(400, f"Email address '{clean_email}' is already registered.")
        raise HTTPException(400, f"Could not create user: {err_msg}")

    from sqlalchemy import func
    next_id = (db.query(func.max(models.Farmer.id)).scalar() or 0) + 1
    farmer = models.Farmer(
        user_id=user.id,
        farmer_code=f"FARM-{next_id:05d}",
        full_name=payload.full_name.strip(),
        father_name=payload.father_name.strip() if payload.father_name else None,
        mobile_number=clean_mobile,
        email=clean_email,
        address=payload.address.strip() if payload.address else None,
        village=payload.village.strip() if payload.village else None,
        land_area=payload.land_area,
        crop_type=payload.crop_type.strip() if payload.crop_type else None,
    )
    try:
        db.add(farmer)
        db.commit()
        db.refresh(farmer)
    except IntegrityError as err:
        db.rollback()
        raise HTTPException(400, "Could not save farmer profile due to duplicate code or database constraint.")
    
    return farmer


@router.get("/{farmer_id}", response_model=schemas.FarmerOut)
def get_farmer(farmer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    farmer = db.query(models.Farmer).filter(models.Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(404, "Farmer not found")
    return farmer


@router.put("/{farmer_id}", response_model=schemas.FarmerOut)
def update_farmer(
    farmer_id: int,
    payload: schemas.FarmerUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    farmer = db.query(models.Farmer).filter(models.Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(404, "Farmer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(farmer, field, value)
    db.commit()
    db.refresh(farmer)
    return farmer


@router.delete("/{farmer_id}", status_code=204)
def delete_farmer(
    farmer_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("super_admin", "admin")),
):
    farmer = db.query(models.Farmer).filter(models.Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(404, "Farmer not found")
    farmer.is_active = False
    db.commit()
    return None


@router.delete("/{farmer_id}/permanent")
def permanently_delete_farmer(
    farmer_id: int,
    force: bool = Query(
        False,
        description="Also delete this farmer's water requests, payments, and complaints. Cannot be undone.",
    ),
    db: Session = Depends(get_db),
    _=Depends(require_roles("super_admin")),
):
    """
    Irreversibly removes a farmer row from the database (unlike the plain
    DELETE above, which just deactivates them). Restricted to super_admin
    since it destroys billing/audit history rather than just hiding it.

    Refuses by default if the farmer has any water requests, payments, or
    complaints on record -- pass ?force=true to delete those too. Without
    `force`, deleting a farmer with related records would either violate a
    foreign-key constraint (MySQL) or leave orphaned rows behind (SQLite),
    so we check first and give a clear count instead of a raw DB error.
    """
    farmer = db.query(models.Farmer).filter(models.Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(404, "Farmer not found")

    request_count = db.query(models.WaterRequest).filter(models.WaterRequest.farmer_id == farmer_id).count()
    payment_count = db.query(models.Payment).filter(models.Payment.farmer_id == farmer_id).count()
    complaint_count = db.query(models.Complaint).filter(models.Complaint.farmer_id == farmer_id).count()

    if (request_count or payment_count or complaint_count) and not force:
        raise HTTPException(
            409,
            f"This farmer has {request_count} water request(s), {payment_count} payment(s), and "
            f"{complaint_count} complaint(s) on record. Permanently deleting the farmer would erase "
            "that history too. Pass ?force=true to delete everything, or use the regular 'Remove' "
            "action instead to deactivate the farmer while keeping their history.",
        )

    if force:
        db.query(models.Payment).filter(models.Payment.farmer_id == farmer_id).delete(synchronize_session=False)
        db.query(models.WaterRequest).filter(models.WaterRequest.farmer_id == farmer_id).delete(synchronize_session=False)
        db.query(models.Complaint).filter(models.Complaint.farmer_id == farmer_id).delete(synchronize_session=False)

    name, code = farmer.full_name, farmer.farmer_code
    db.delete(farmer)
    db.commit()
    return {"message": f"{name} ({code}) was permanently deleted."}
