import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from . import models  # noqa: F401  (ensures models are registered on Base)
from .routers import auth, users, farmers, requests, payments, complaints, dashboard, reports
from .routers.misc import settings_router, infra_router, notifications_router
from .config import settings

app = FastAPI(
    title="Sichai Pani - Irrigation Management System",
    description="REST API for the Premium Irrigation (Sichai Pani) Management System",
    version="1.0.0",
)

# CSRF is mitigated via the SameSite cookie / bearer-token model used here
# (no session cookies are used for API auth). XSS/SQLi protection relies on
# React's default output-escaping and SQLAlchemy's parameterized queries.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .database import Base, engine, SessionLocal
from .auth import hash_password

Base.metadata.create_all(bind=engine)

def auto_seed():
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.email == "admin@sichaipani.com").first()
        if not admin:
            print("[sichai-pani] Creating default admin account (admin@sichaipani.com)...")
            admin = models.User(
                full_name="System Admin",
                email="admin@sichaipani.com",
                hashed_password=hash_password("Admin@123"),
                role=models.UserRole.super_admin,
                is_email_verified=True,
                is_active=True,
                failed_login_attempts=0,
                locked_until=None,
            )
            db.add(admin)
        else:
            # Ensure password is reset to Admin@123 and unlock account
            admin.hashed_password = hash_password("Admin@123")
            admin.is_active = True
            admin.failed_login_attempts = 0
            admin.locked_until = None

        operator = db.query(models.User).filter(models.User.email == "operator@sichaipani.com").first()
        if not operator:
            print("[sichai-pani] Creating default operator account (operator@sichaipani.com)...")
            operator = models.User(
                full_name="Ramesh Operator",
                email="operator@sichaipani.com",
                hashed_password=hash_password("Operator@123"),
                role=models.UserRole.water_operator,
                is_email_verified=True,
                is_active=True,
                failed_login_attempts=0,
                locked_until=None,
            )
            db.add(operator)
        else:
            operator.hashed_password = hash_password("Operator@123")
            operator.is_active = True
            operator.failed_login_attempts = 0
            operator.locked_until = None

        if db.query(models.Canal).count() == 0:
            canal = models.Canal(name="Main Canal North", location="Sector 4")
            db.add(canal)
            db.commit()
            pump = models.Pump(name="Pump Station A", canal_id=canal.id)
            db.add(pump)

        db.commit()
        print("[sichai-pani] Default accounts verified, reset & active.")
    except Exception as e:
        print(f"[sichai-pani] Auto-seed warning: {e}")
    finally:
        db.close()

auto_seed()

# Serve uploaded files (payment proofs, complaint photos, farmer documents)
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(farmers.router)
app.include_router(requests.router)
app.include_router(payments.router)
app.include_router(complaints.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(settings_router)
app.include_router(infra_router)
app.include_router(notifications_router)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "company": settings.company_name,
        "database": engine.dialect.name,
        "google_signin_configured": bool(settings.google_client_id),
    }
