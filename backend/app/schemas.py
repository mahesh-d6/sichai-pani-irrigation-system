import datetime as dt
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from .models import UserRole, RequestStatus, PaymentStatus, PaymentMethod, ComplaintStatus, LoginChallengeStatus


# ---------- Shared ----------

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: Optional[str] = None
    username: Optional[str] = None
    mobile_number: Optional[str] = None
    role: UserRole
    is_active: bool
    is_email_verified: bool
    photo_url: Optional[str] = None
    must_change_password: bool = False


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr
    password: str  # current password, required to confirm this is really the account owner


class UpdateProfileRequest(BaseModel):
    full_name: str


class GoogleLoginRequest(BaseModel):
    credential: str  # Google ID token (JWT) from Google Identity Services
    role: str = "farmer"  # which login page this came from: "admin" | "operator" | "farmer"


# ---------- Admin (Sadasya) ----------

class AdminRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def must_be_gmail(cls, v: str) -> str:
        if not v.lower().endswith("@gmail.com"):
            raise ValueError("Admin accounts must use a Gmail address")
        return v


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str
    device_label: Optional[str] = None


class AdminLoginResult(BaseModel):
    """
    Returned by POST /api/auth/admin/login. Exactly one of `token` or
    `pending_challenge_id` is set: if another device already holds the
    session, the login is parked as a pending challenge instead of
    succeeding outright.
    """
    status: str  # "logged_in" | "pending_approval"
    token: Optional[Token] = None
    pending_challenge_id: Optional[str] = None
    message: Optional[str] = None


class LoginChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    public_id: str
    requester_ip: Optional[str] = None
    requester_user_agent: Optional[str] = None
    status: LoginChallengeStatus
    created_at: dt.datetime


class LoginChallengeRespond(BaseModel):
    action: str  # "allow" | "reject"


class LoginChallengeResult(BaseModel):
    status: str  # "pending" | "allowed" | "rejected" | "expired"
    token: Optional[Token] = None


class AdminRegistrationStatus(BaseModel):
    open: bool
    admin_count: int
    max_admins: int


# ---------- Operator ----------

class OperatorLoginRequest(BaseModel):
    email: EmailStr
    password: str


class OperatorCreateRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str


# ---------- Farmer ----------

class FarmerLoginRequest(BaseModel):
    username: str
    password: str


class FarmerCreateByAdmin(BaseModel):
    username: str
    full_name: str
    mobile_number: str
    temp_password: str
    security_question_1: str
    security_answer_1: str
    security_question_2: str
    security_answer_2: str
    security_question_3: str
    security_answer_3: str
    father_name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    village: Optional[str] = None
    land_area: Optional[float] = None
    crop_type: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if not v or not str(v).strip():
            return None
        return v.strip().lower()


class ForceChangePasswordRequest(BaseModel):
    new_password: str


class ForgotPasswordQuestionsOut(BaseModel):
    username: str
    questions: List[str]


class VerifySecurityAnswersRequest(BaseModel):
    username: str
    answer_1: str
    answer_2: str
    answer_3: str


class VerifySecurityAnswersResult(BaseModel):
    reset_token: str


class ResetPasswordWithTokenRequest(BaseModel):
    reset_token: str
    new_password: str


# ---------- Login activity log ----------

class LoginLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: Optional[int] = None
    role: Optional[str] = None
    action: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[str] = None
    created_at: dt.datetime


# ---------- Farmers (profile) ----------

class FarmerBase(BaseModel):
    full_name: str
    father_name: Optional[str] = None
    mobile_number: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    village: Optional[str] = None
    land_area: Optional[float] = None
    crop_type: Optional[str] = None
    photo_url: Optional[str] = None
    map_latitude: Optional[float] = None
    map_longitude: Optional[float] = None
    documents: Optional[str] = None


class FarmerUpdate(FarmerBase):
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None


class FarmerOut(FarmerBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    farmer_code: str
    is_active: bool
    created_at: dt.datetime
    username: Optional[str] = None


# ---------- Canal / Pump ----------

class CanalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    location: Optional[str] = None


class PumpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    canal_id: Optional[int] = None


# ---------- Water Requests ----------

class WaterRequestCreate(BaseModel):
    farmer_id: int
    request_date: dt.date
    start_time: Optional[dt.time] = None
    end_time: Optional[dt.time] = None
    crop: Optional[str] = None
    canal_id: Optional[int] = None
    pump_id: Optional[int] = None
    remarks: Optional[str] = None


class WaterRequestStatusUpdate(BaseModel):
    status: RequestStatus
    operator_id: Optional[int] = None
    request_date: Optional[dt.date] = None
    start_time: Optional[dt.time] = None
    end_time: Optional[dt.time] = None


class WaterRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    farmer_id: int
    operator_id: Optional[int] = None
    request_date: dt.date
    start_time: Optional[dt.time] = None
    end_time: Optional[dt.time] = None
    total_hours: float
    crop: Optional[str] = None
    canal_id: Optional[int] = None
    pump_id: Optional[int] = None
    remarks: Optional[str] = None
    status: RequestStatus
    rate_per_hour: float
    total_amount: float
    payment_status: PaymentStatus
    created_at: dt.datetime
    actual_start_time: Optional[dt.datetime] = None
    actual_end_time: Optional[dt.datetime] = None
    actual_total_hours: Optional[float] = None


# ---------- Payments ----------

class PaymentCreate(BaseModel):
    water_request_id: int
    method: PaymentMethod
    notes: Optional[str] = None


class PaymentStatusUpdate(BaseModel):
    status: PaymentStatus
    transaction_id: Optional[str] = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    water_request_id: int
    farmer_id: int
    amount: float
    method: PaymentMethod
    status: PaymentStatus
    transaction_id: Optional[str] = None
    invoice_number: Optional[str] = None
    payment_date: dt.datetime
    notes: Optional[str] = None
    proof_url: Optional[str] = None
    proof_uploaded_at: Optional[dt.datetime] = None


# ---------- Complaints ----------

class ComplaintCreate(BaseModel):
    farmer_id: int
    category: str
    description: Optional[str] = None
    photo_url: Optional[str] = None


class ComplaintReply(BaseModel):
    admin_reply: str
    status: ComplaintStatus = ComplaintStatus.resolved


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    farmer_id: int
    category: str
    description: Optional[str] = None
    photo_url: Optional[str] = None
    status: ComplaintStatus
    admin_reply: Optional[str] = None
    created_at: dt.datetime
    resolved_at: Optional[dt.datetime] = None


# ---------- Dashboard ----------

class DashboardStats(BaseModel):
    total_farmers: int
    active_water_requests: int
    todays_schedule: int
    total_revenue: float
    water_used_today_hours: float
    monthly_income: float
    pending_payments: float
    active_pumps: int
    open_complaints: int
    unread_notifications: int


class ChartPoint(BaseModel):
    label: str
    value: float


# ---------- Notifications ----------

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    message: str
    is_read: bool
    created_at: dt.datetime


# ---------- Settings & Announcements ----------

class SettingUpdate(BaseModel):
    key: str
    value: str


class AnnouncementCreate(BaseModel):
    text_en: str
    text_ne: str


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    text_en: str
    text_ne: str
    is_active: bool
    created_at: dt.datetime

