import secrets
import datetime as dt
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles, STAFF_ROLES, get_or_create_farmer_profile
from ..config import settings
from ..uploads import save_upload
from ..notify import notify_roles

# Methods that go through a real/stubbed payment gateway or a manual
# transfer -- for these we require the farmer to attach proof (screenshot
# of the transaction, bank slip, etc.) since the gateways aren't wired to
# real merchant accounts yet. Cash is collected in person by staff, so no
# proof upload is needed there.
METHODS_REQUIRING_PROOF = {
    models.PaymentMethod.esewa,
    models.PaymentMethod.khalti,
    models.PaymentMethod.fonepay,
    models.PaymentMethod.bank_transfer,
}

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _next_invoice_number(db: Session) -> str:
    count = db.query(models.Payment).count()
    year = dt.date.today().year
    return f"INV-{year}-{count + 1:06d}"


@router.get("", response_model=List[schemas.PaymentOut])
def list_payments(
    farmer_id: Optional[int] = None,
    status: Optional[models.PaymentStatus] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Payment)
    if current_user.role == models.UserRole.farmer:
        farmer_profile = get_or_create_farmer_profile(db, current_user)
        q = q.filter(models.Payment.farmer_id == farmer_profile.id)
    elif farmer_id:
        q = q.filter(models.Payment.farmer_id == farmer_id)
    if status:
        q = q.filter(models.Payment.status == status)
    return q.order_by(models.Payment.id.desc()).all()


@router.post("", response_model=schemas.PaymentOut, status_code=201)
def initiate_payment(
    water_request_id: int = Form(...),
    method: models.PaymentMethod = Form(...),
    notes: Optional[str] = Form(None),
    proof: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Records a payment for a water request. Farmers pay for their own
    requests and must attach proof of payment (screenshot/receipt) for
    every method except cash, which staff record after collecting in
    person. Staff (admin/operator) can also record a payment on a
    farmer's behalf.
    """
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == water_request_id).first()
    if not wr:
        raise HTTPException(404, "Water request not found")

    if current_user.role == models.UserRole.farmer:
        farmer_profile = get_or_create_farmer_profile(db, current_user)
        if wr.farmer_id != farmer_profile.id:
            raise HTTPException(403, "You can only pay for your own water requests")

    is_staff = current_user.role in (models.UserRole.super_admin, models.UserRole.admin, models.UserRole.water_operator)

    if not is_staff and method in METHODS_REQUIRING_PROOF and proof is None:
        raise HTTPException(400, "Please upload proof of payment (screenshot or receipt) for this payment method")

    proof_url = None
    proof_uploaded_at = None
    if proof is not None:
        proof_url = save_upload(proof, "payment_proofs")
        proof_uploaded_at = dt.datetime.utcnow()

    # Staff-recorded payments or Cash payments are marked paid immediately.
    # Farmer-submitted digital payments stay pending until verified by staff.
    initial_status = models.PaymentStatus.paid if (is_staff or method == models.PaymentMethod.cash) else models.PaymentStatus.pending

    payment = models.Payment(
        water_request_id=wr.id,
        farmer_id=wr.farmer_id,
        amount=wr.total_amount,
        method=method,
        status=initial_status,
        transaction_id=secrets.token_hex(8) if method != models.PaymentMethod.cash else None,
        invoice_number=_next_invoice_number(db),
        notes=notes,
        proof_url=proof_url,
        proof_uploaded_at=proof_uploaded_at,
    )
    db.add(payment)

    if payment.status == models.PaymentStatus.paid:
        wr.payment_status = models.PaymentStatus.paid


    db.commit()
    db.refresh(payment)

    if payment.status == models.PaymentStatus.pending:
        farmer_name = db.query(models.Farmer).filter(models.Farmer.id == wr.farmer_id).first()
        notify_roles(
            db,
            [models.UserRole.super_admin, models.UserRole.admin],
            "Payment awaiting verification",
            f"{farmer_name.full_name if farmer_name else 'A farmer'} submitted a {method.value} payment of Rs.{payment.amount} for review.",
        )

    # NOTE: for esewa/khalti/fonepay, this is where you'd call out to the
    # gateway's initiate-payment API and return a redirect URL to the
    # frontend instead of relying on uploaded proof. The /webhook endpoint
    # below is where the gateway's callback would land once configured.
    return payment


@router.post("/{payment_id}/proof", response_model=schemas.PaymentOut)
def upload_payment_proof(
    payment_id: int,
    proof: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Attach or replace the proof-of-payment file on an existing payment."""
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(404, "Payment not found")

    if current_user.role == models.UserRole.farmer:
        if not current_user.farmer_profile or payment.farmer_id != current_user.farmer_profile.id:
            raise HTTPException(403, "You can only upload proof for your own payments")

    payment.proof_url = save_upload(proof, "payment_proofs")
    payment.proof_uploaded_at = dt.datetime.utcnow()
    db.commit()
    db.refresh(payment)
    return payment


@router.post("/webhook/{gateway}")
def payment_webhook(gateway: str, transaction_id: str, status: models.PaymentStatus, db: Session = Depends(get_db)):
    """
    Callback endpoint for eSewa / Khalti / Fonepay to confirm payment status.
    Each gateway has its own signature verification scheme -- verify the
    payload signature here before trusting `status` in production.
    """
    payment = db.query(models.Payment).filter(models.Payment.transaction_id == transaction_id).first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    payment.status = status
    if status == models.PaymentStatus.paid:
        wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == payment.water_request_id).first()
        if wr:
            wr.payment_status = models.PaymentStatus.paid
    db.commit()
    return {"message": "Payment status updated"}


@router.patch("/{payment_id}/status", response_model=schemas.PaymentOut)
def update_payment_status(
    payment_id: int,
    payload: schemas.PaymentStatusUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*STAFF_ROLES)),
):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    payment.status = payload.status
    if payload.transaction_id:
        payment.transaction_id = payload.transaction_id
    if payload.status == models.PaymentStatus.paid:
        wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == payment.water_request_id).first()
        if wr:
            wr.payment_status = models.PaymentStatus.paid
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{payment_id}/receipt.pdf")
def download_receipt(payment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    wr = db.query(models.WaterRequest).filter(models.WaterRequest.id == payment.water_request_id).first()
    farmer = db.query(models.Farmer).filter(models.Farmer.id == payment.farmer_id).first()

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 60

    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, settings.company_name)
    c.setFont("Helvetica", 10)
    y -= 20
    c.drawString(50, y, "Payment Receipt")
    y -= 30

    c.setFont("Helvetica", 11)
    rows = [
        ("Invoice No.", payment.invoice_number or "-"),
        ("Transaction ID", payment.transaction_id or "-"),
        ("Date", payment.payment_date.strftime("%Y-%m-%d %H:%M")),
        ("Farmer", farmer.full_name if farmer else "-"),
        ("Mobile", farmer.mobile_number if farmer else "-"),
        ("Water Date", str(wr.request_date) if wr else "-"),
        ("Time", f"{wr.start_time} - {wr.end_time}" if wr else "-"),
        ("Total Hours", f"{wr.total_hours} hrs" if wr else "-"),
        ("Rate", f"{settings.currency}{wr.rate_per_hour}/hour" if wr else "-"),
        ("Amount", f"{settings.currency}{payment.amount}"),
        ("Method", payment.method.value.replace("_", " ").title()),
        ("Status", payment.status.value.title()),
    ]
    for label, value in rows:
        c.drawString(50, y, f"{label}:")
        c.drawString(220, y, str(value))
        y -= 22

    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=receipt_{payment.invoice_number}.pdf"},
    )
