import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


from .database import Base, engine
from . import models  # noqa: F401  (ensures models are registered on Base)
from .routers import auth, users, farmers, requests, payments, complaints, dashboard, reports
from .routers.misc import settings_router, infra_router, notifications_router, announcements_router
from .config import settings

app = FastAPI(
    title="Sichai Pani - Irrigation Management System",
    description="REST API for the Premium Irrigation (Sichai Pani) Management System",
    version="1.0.0",
)

# CSRF is mitigated via the SameSite cookie / bearer-token model used here
# (no session cookies are used for API auth). XSS/SQLi protection relies on
# React's default output-escaping and SQLAlchemy's parameterized queries.
ALLOWED_ORIGINS = [
    "https://sichai-pani-irrigation-system-1.onrender.com",
    "https://sichai-pani-irrigation-system.onrender.com",
    "https://sichai-pani-backend.onrender.com",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost:8001",
    "http://127.0.0.1:8001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from .database import Base, engine, SessionLocal
from .auth import hash_password

Base.metadata.create_all(bind=engine)

# Security response headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

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

        if db.query(models.Canal).count() == 0:
            canal = models.Canal(name="Main Canal North", location="Sector 4")
            db.add(canal)
            db.commit()
            pump = models.Pump(name="Pump Station A", canal_id=canal.id)
            db.add(pump)

        db.commit()
        print("[sichai-pani] Default accounts verified & active.")
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
app.include_router(announcements_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"[ERROR] Unhandled exception on {request.method} {request.url}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "company": settings.company_name,
        "database": engine.dialect.name,
        "google_signin_configured": bool(settings.google_client_id),
    }

