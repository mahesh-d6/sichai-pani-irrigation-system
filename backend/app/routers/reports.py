import csv
import io
import datetime as dt
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user, require_roles, STAFF_ROLES

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/water-history.csv")
def water_history_csv(
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*STAFF_ROLES)),
):
    q = db.query(models.WaterRequest)
    if date_from:
        q = q.filter(models.WaterRequest.request_date >= date_from)
    if date_to:
        q = q.filter(models.WaterRequest.request_date <= date_to)
    rows = q.order_by(models.WaterRequest.request_date).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Date", "Farmer ID", "Start Time", "End Time", "Total Hours",
        "Rate", "Total Amount", "Payment Status", "Operator ID", "Status",
    ])
    for r in rows:
        writer.writerow([
            r.request_date, r.farmer_id, r.start_time, r.end_time, r.total_hours,
            r.rate_per_hour, r.total_amount, r.payment_status.value, r.operator_id or "", r.status.value,
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=water_history.csv"},
    )


@router.get("/water-history.xlsx")
def water_history_xlsx(
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*STAFF_ROLES)),
):
    from openpyxl import Workbook

    q = db.query(models.WaterRequest)
    if date_from:
        q = q.filter(models.WaterRequest.request_date >= date_from)
    if date_to:
        q = q.filter(models.WaterRequest.request_date <= date_to)
    rows = q.order_by(models.WaterRequest.request_date).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Water History"
    ws.append(["Date", "Farmer ID", "Start", "End", "Hours", "Rate", "Amount", "Payment Status", "Status"])
    for r in rows:
        ws.append([
            str(r.request_date), r.farmer_id, str(r.start_time), str(r.end_time),
            r.total_hours, r.rate_per_hour, r.total_amount, r.payment_status.value, r.status.value,
        ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=water_history.xlsx"},
    )


@router.get("/outstanding-payments")
def outstanding_payments(db: Session = Depends(get_db), _=Depends(require_roles(*STAFF_ROLES))):
    rows = (
        db.query(models.WaterRequest)
        .filter(models.WaterRequest.payment_status == models.PaymentStatus.pending)
        .order_by(models.WaterRequest.request_date)
        .all()
    )
    return [
        {
            "request_id": r.id,
            "farmer_id": r.farmer_id,
            "date": str(r.request_date),
            "amount": r.total_amount,
        }
        for r in rows
    ]
