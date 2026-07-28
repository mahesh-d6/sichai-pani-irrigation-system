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
    allow_origins=settings.cors_origins_list,
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
        if db.query(models.User).count() == 0:
            print("[sichai-pani] Auto-seeding initial admin & operator accounts...")
            admin = models.User(
                full_name="System Admin",
                email="admin@sichaipani.com",
                hashed_password=hash_password("Admin@123"),
                role=models.UserRole.super_admin,
                is_email_verified=True,
            )
            operator = models.User(
                full_name="Ramesh Operator",
                email="operator@sichaipani.com",
                hashed_password=hash_password("Operator@123"),
                role=models.UserRole.water_operator,
                is_email_verified=True,
            )
            db.add_all([admin, operator])
            db.commit()

            canal = models.Canal(name="Main Canal North", location="Sector 4")
            db.add(canal)
            db.commit()

            pump = models.Pump(name="Pump Station A", canal_id=canal.id)
            db.add(pump)
            db.commit()
            print("[sichai-pani] Auto-seed complete.")
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
