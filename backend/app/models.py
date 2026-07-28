import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date, Time,
    ForeignKey, Text, Enum
)
from sqlalchemy.orm import relationship
from .database import Base


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    water_operator = "water_operator"
    farmer = "farmer"
    guest = "guest"


# Roles that count toward the 3-account Admin (Sadasya) cap.
ADMIN_ROLE_VALUES = ("super_admin", "admin")


class RequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    rescheduled = "rescheduled"
    in_progress = "in_progress"  # operator has pressed Start, water is flowing
    completed = "completed"      # operator has pressed Stop


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class PaymentMethod(str, enum.Enum):
    esewa = "esewa"
    khalti = "khalti"
    fonepay = "fonepay"
    bank_transfer = "bank_transfer"
    cash = "cash"


class ComplaintStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class LoginChallengeStatus(str, enum.Enum):
    pending = "pending"
    allowed = "allowed"
    rejected = "rejected"
    expired = "expired"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=True)
    username = Column(String(50), unique=True, index=True, nullable=True)  # farmer login handle, set by admin
    mobile_number = Column(String(20), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    google_id = Column(String(255), unique=True, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.farmer, nullable=False)
    is_active = Column(Boolean, default=True)
    is_email_verified = Column(Boolean, default=False)
    photo_url = Column(String(500), nullable=True)

    # Forces the change-password screen before anything else is usable --
    # set true whenever an admin hands out a temporary password.
    must_change_password = Column(Boolean, default=False)

    # Security questions (farmers only) for the "forgot password" flow.
    # Answers are stored hashed, same as passwords -- never compared in plaintext.
    security_question_1 = Column(String(255), nullable=True)
    security_answer_1_hash = Column(String(255), nullable=True)
    security_question_2 = Column(String(255), nullable=True)
    security_answer_2_hash = Column(String(255), nullable=True)
    security_question_3 = Column(String(255), nullable=True)
    security_answer_3_hash = Column(String(255), nullable=True)

    # Failed-login lockout.
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)

    # Single-device enforcement for Admin accounts: whichever device most
    # recently logged in (or was approved via a login challenge) holds
    # this token; any other device's existing JWT stops validating the
    # moment this changes, since get_current_user checks it on every call.
    active_session_id = Column(String(64), nullable=True)

    last_login_at = Column(DateTime, nullable=True)
    last_login_ip = Column(String(64), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    farmer_profile = relationship("Farmer", back_populates="user", uselist=False)


class LoginChallenge(Base):
    """
    Created when a second device tries to log in to an Admin account that
    already has an active session elsewhere. The already-logged-in device
    polls for these and can Allow / Reject / (or just proactively Log Out
    Other Devices, which doesn't need this table at all).
    """
    __tablename__ = "login_challenges"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(LoginChallengeStatus), default=LoginChallengeStatus.pending)
    requester_ip = Column(String(64), nullable=True)
    requester_user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    user = relationship("User")


class LoginLog(Base):
    """Login/logout activity log for all three roles."""
    __tablename__ = "login_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role = Column(String(30), nullable=True)
    action = Column(String(50), nullable=False)  # login_success, login_failed, locked_out, logout, password_changed, ...
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    farmer_code = Column(String(30), unique=True, index=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    father_name = Column(String(150), nullable=True)
    mobile_number = Column(String(20), nullable=False)
    email = Column(String(150), nullable=True)
    address = Column(String(255), nullable=True)
    village = Column(String(150), nullable=True)
    land_area = Column(Float, nullable=True)  # in bigha/acre
    crop_type = Column(String(100), nullable=True)
    photo_url = Column(String(500), nullable=True)
    map_latitude = Column(Float, nullable=True)
    map_longitude = Column(Float, nullable=True)
    documents = Column(Text, nullable=True)  # comma separated file paths / JSON
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="farmer_profile")
    requests = relationship("WaterRequest", back_populates="farmer")
    complaints = relationship("Complaint", back_populates="farmer")

    @property
    def username(self):
        return self.user.username if self.user else None


class Canal(Base):
    __tablename__ = "canals"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    location = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)


class Pump(Base):
    __tablename__ = "pumps"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    canal_id = Column(Integer, ForeignKey("canals.id"), nullable=True)
    is_active = Column(Boolean, default=True)


class WaterRequest(Base):
    __tablename__ = "water_requests"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    request_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=True)   # legacy/unused now -- Operator's actual start/stop is the only real timing
    end_time = Column(Time, nullable=True)
    total_hours = Column(Float, nullable=False, default=0)  # requested hours (billing estimate)
    crop = Column(String(100), nullable=True)
    canal_id = Column(Integer, ForeignKey("canals.id"), nullable=True)
    pump_id = Column(Integer, ForeignKey("pumps.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    status = Column(Enum(RequestStatus), default=RequestStatus.pending)
    rate_per_hour = Column(Float, nullable=False, default=200.0)
    total_amount = Column(Float, nullable=False, default=0)  # billed amount -- actual hours once completed
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Filled in by the Operator's Start/Stop buttons -- this is the real,
    # actual water-delivery window, which is what billing and every
    # dashboard should show once it exists (falls back to the farmer's
    # requested start_time/end_time/total_hours until then).
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    actual_total_hours = Column(Float, nullable=True)

    farmer = relationship("Farmer", back_populates="requests")
    canal = relationship("Canal")
    pump = relationship("Pump")
    payments = relationship("Payment", back_populates="water_request")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    water_request_id = Column(Integer, ForeignKey("water_requests.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    amount = Column(Float, nullable=False)
    method = Column(Enum(PaymentMethod), nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    transaction_id = Column(String(150), unique=True, nullable=True)
    payment_date = Column(DateTime, default=datetime.utcnow)
    invoice_number = Column(String(50), unique=True, nullable=True)
    notes = Column(Text, nullable=True)
    proof_url = Column(String(500), nullable=True)  # farmer-uploaded proof of payment (screenshot/receipt)
    proof_uploaded_at = Column(DateTime, nullable=True)

    water_request = relationship("WaterRequest", back_populates="payments")
    farmer = relationship("Farmer")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    category = Column(String(100), nullable=False)  # Leakage / No Water / Late Supply / Broken Canal / Other
    description = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.open)
    admin_reply = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    farmer = relationship("Farmer", back_populates="complaints")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
