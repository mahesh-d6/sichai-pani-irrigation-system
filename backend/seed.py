"""
Populates the database with just the Admin and Operator accounts needed to
start using the app. No farmers are pre-created -- per the system's rules,
every Farmer account must be created by an Admin through the app itself
(Farmers page -> Add Farmer), so the farmer list starts empty.

Run with: python seed.py
"""
from app.database import Base, engine, SessionLocal
from app import models
from app.auth import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.query(models.User).count() == 0:
    print("Seeding starter accounts...")

    # First Admin (Sadasya) account -- becomes super_admin. Up to 2 more
    # Admin accounts can register themselves at /login/admin/register
    # before the system closes admin registration (max 3 total).
    admin = models.User(
        full_name="System Admin",
        email="admin@sichaipani.com",
        hashed_password=hash_password("Admin@123"),
        role=models.UserRole.super_admin,
        is_email_verified=True,
    )
    # The one and only Operator account -- created here the same way an
    # Admin would create it via POST /api/users/operator.
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

    print("Seed complete. No farmers were created -- add them from the Farmers page after logging in as Admin.")
    print("Admin (Sadasya) login:  admin@sichaipani.com / Admin@123")
    print("Operator login:         operator@sichaipani.com / Operator@123")
else:
    print("Database already has data, skipping seed.")

db.close()
