import secrets
import datetime as dt
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import (
    hash_password, verify_password, create_access_token,
    validate_strong_password, new_session_id, normalize_username,
)
from ..deps import get_current_user, require_roles, get_client_ip, ADMIN_ROLES
from ..config import settings
from ..notify import notify_user, notify_roles

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory reset-token store for the farmer "forgot password" flow.
# Production: persist tokens in DB/Redis with expiry and single-use enforcement.
_reset_tokens: dict[str, int] = {}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _log(db: Session, user_id, role, action: str, request: Request, details: str = None):
    entry = models.LoginLog(
        user_id=user_id,
        role=role,
        action=action,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", "")[:255],
        details=details,
    )
    db.add(entry)
    db.commit()


def _check_lockout(user: models.User):
    if user.locked_until and user.locked_until > dt.datetime.utcnow():
        remaining = int((user.locked_until - dt.datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(
            status.HTTP_423_LOCKED,
            f"Too many failed attempts. Try again in {remaining} minute(s).",
        )


def _register_failed_attempt(db: Session, user: models.User):
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    if user.failed_login_attempts >= settings.max_failed_login_attempts:
        user.locked_until = dt.datetime.utcnow() + dt.timedelta(minutes=settings.lockout_minutes)
    db.commit()


def _register_successful_login(db: Session, user: models.User, request: Request):
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = dt.datetime.utcnow()
    user.last_login_ip = get_client_ip(request)
    db.commit()


# ---------------------------------------------------------------------------
# Admin (Sadasya)
# ---------------------------------------------------------------------------

@router.get("/admin/registration-status", response_model=schemas.AdminRegistrationStatus)
def admin_registration_status(db: Session = Depends(get_db)):
    count = db.query(models.User).filter(models.User.role.in_(list(ADMIN_ROLES))).count()
    return schemas.AdminRegistrationStatus(
        open=count < settings.max_admin_accounts,
        admin_count=count,
        max_admins=settings.max_admin_accounts,
    )


@router.post("/admin/register", response_model=schemas.Token, status_code=201)
def admin_register(payload: schemas.AdminRegisterRequest, request: Request, db: Session = Depends(get_db)):
    count = db.query(models.User).filter(models.User.role.in_(list(ADMIN_ROLES))).count()
    if count >= settings.max_admin_accounts:
        raise HTTPException(403, f"Only {settings.max_admin_accounts} Admin accounts are allowed. Registration is closed.")

    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(400, "An account with this email already exists")

    validate_strong_password(payload.password)

    # The very first admin becomes super_admin (full control); the rest
    # are regular admins -- both count toward the same 4-account cap.
    role = models.UserRole.super_admin if count == 0 else models.UserRole.admin

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=role,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    session_id = new_session_id()
    user.active_session_id = session_id
    _register_successful_login(db, user, request)
    _log(db, user.id, role.value, "admin_registered", request)

    token = create_access_token(subject=str(user.id), extra={"role": user.role.value, "session_id": session_id})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


def _issue_admin_session_or_challenge(user: models.User, request: Request, db: Session) -> "schemas.AdminLoginResult":
    """
    Used by both password login and Google Sign-In for Admin accounts.

    Admin accounts now allow multiple simultaneous devices, same as
    Operator -- signing in never force-logs-out another device. Instead,
    every successful sign-in sends the account owner a notification (IP
    + time) so they always have visibility into new activity, without
    the friction of blocking a legitimate login and waiting for another
    device to approve it. If a sign-in genuinely wasn't them, "Log Out
    Other Devices" in Settings immediately invalidates every other
    session -- that's still fully supported, just opt-in instead of
    blocking by default.
    """
    _register_successful_login(db, user, request)
    _log(db, user.id, user.role.value, "login_success", request)

    notify_user(
        db, user.id,
        "New sign-in to your Admin account",
        f"Your account was just signed into from IP {get_client_ip(request)}. "
        "If this wasn't you, use \"Log Out Other Devices\" in Settings right away.",
    )

    # `active_session_id` stays None until "Log Out Other Devices" is used
    # for the first time -- at that point it becomes the one value that
    # matters, and every token minted before that moment (which carries
    # None/a stale value) stops matching and is logged out on its next
    # request. Until then, every device's token carries whatever the
    # current value is, so nothing ever conflicts.
    token = create_access_token(
        subject=str(user.id), extra={"role": user.role.value, "session_id": user.active_session_id or ""}
    )
    return schemas.AdminLoginResult(status="logged_in", token=schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user)))


@router.post("/admin/login", response_model=schemas.AdminLoginResult)
def admin_login(payload: schemas.AdminLoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.email == payload.email, models.User.role.in_(list(ADMIN_ROLES))
    ).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    _check_lockout(user)

    if not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        _register_failed_attempt(db, user)
        _log(db, user.id, user.role.value, "login_failed", request)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    return _issue_admin_session_or_challenge(user, request, db)


@router.get("/admin/login-challenges", response_model=List[schemas.LoginChallengeOut])
def list_my_login_challenges(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
):
    """The currently-logged-in Admin polls this to see pending login and Google sign-in requests."""
    return (
        db.query(models.LoginChallenge)
        .filter(models.LoginChallenge.status == models.LoginChallengeStatus.pending)
        .order_by(models.LoginChallenge.id.desc())
        .all()
    )


@router.post("/admin/login-challenges/{public_id}/respond")
def respond_to_login_challenge(
    public_id: str,
    payload: schemas.LoginChallengeRespond,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
):
    challenge = db.query(models.LoginChallenge).filter(
        models.LoginChallenge.public_id == public_id,
    ).first()
    if not challenge:
        raise HTTPException(404, "Login request not found")
    if challenge.status != models.LoginChallengeStatus.pending:
        raise HTTPException(409, "This login request has already been resolved")

    target_user = challenge.user

    if payload.action == "allow":
        if target_user:
            target_user.active_session_id = new_session_id()
            if not target_user.google_id:
                target_user.google_id = f"google-auth-approved-{target_user.id}"
        challenge.status = models.LoginChallengeStatus.allowed
        _log(db, current_user.id, current_user.role.value, "login_challenge_allowed", request, details=f"{public_id} for user {target_user.id if target_user else 'unknown'}")
    elif payload.action == "reject":
        challenge.status = models.LoginChallengeStatus.rejected
        _log(db, current_user.id, current_user.role.value, "login_challenge_rejected", request, details=f"{public_id} for user {target_user.id if target_user else 'unknown'}")
    else:
        raise HTTPException(400, "action must be 'allow' or 'reject'")

    challenge.resolved_at = dt.datetime.utcnow()
    db.commit()
    return {"message": f"Login request {payload.action}ed."}


@router.get("/admin/login-challenges/{public_id}/result", response_model=schemas.LoginChallengeResult)
def poll_login_challenge_result(public_id: str, db: Session = Depends(get_db)):
    """
    Polled (unauthenticated, by design -- this device doesn't have a
    token yet) by the device that's waiting for approval.
    """
    challenge = db.query(models.LoginChallenge).filter(models.LoginChallenge.public_id == public_id).first()
    if not challenge:
        raise HTTPException(404, "Login request not found")

    if challenge.status == models.LoginChallengeStatus.pending:
        return schemas.LoginChallengeResult(status="pending")

    if challenge.status == models.LoginChallengeStatus.allowed:
        user = challenge.user
        # The active_session_id was already set by the 'allow' action;
        # mint the token for it now so the waiting device becomes the
        # one true active session.
        token = create_access_token(
            subject=str(user.id), extra={"role": user.role.value, "session_id": user.active_session_id}
        )
        return schemas.LoginChallengeResult(
            status="allowed",
            token=schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user)),
        )

    return schemas.LoginChallengeResult(status=challenge.status.value)


@router.post("/admin/logout-others")
def logout_other_admin_devices(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
):
    """Proactively invalidates any other session and issues this device a fresh one."""
    session_id = new_session_id()
    current_user.active_session_id = session_id
    db.commit()
    _log(db, current_user.id, current_user.role.value, "logout_other_devices", request)
    token = create_access_token(
        subject=str(current_user.id), extra={"role": current_user.role.value, "session_id": session_id}
    )
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(current_user))


# ---------------------------------------------------------------------------
# Operator
# ---------------------------------------------------------------------------

@router.post("/operator/login", response_model=schemas.Token)
def operator_login(payload: schemas.OperatorLoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.email == payload.email, models.User.role == models.UserRole.water_operator
    ).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    _check_lockout(user)

    if not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        _register_failed_attempt(db, user)
        _log(db, user.id, user.role.value, "login_failed", request)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    # Operator accounts are allowed on multiple devices at once -- no
    # session/device tracking beyond the normal JWT expiry.
    _register_successful_login(db, user, request)
    _log(db, user.id, user.role.value, "login_success", request)

    token = create_access_token(subject=str(user.id), extra={"role": user.role.value})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


# ---------------------------------------------------------------------------
# Farmer
# ---------------------------------------------------------------------------

@router.post("/farmer/login", response_model=schemas.Token)
def farmer_login(payload: schemas.FarmerLoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.username == normalize_username(payload.username), models.User.role == models.UserRole.farmer
    ).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    _check_lockout(user)

    if not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        _register_failed_attempt(db, user)
        _log(db, user.id, user.role.value, "login_failed", request)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    _register_successful_login(db, user, request)
    _log(db, user.id, user.role.value, "login_success", request)

    token = create_access_token(subject=str(user.id), extra={"role": user.role.value})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/farmer/force-change-password")
def farmer_force_change_password(
    payload: schemas.ForceChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Called right after a farmer's first login while must_change_password
    is still true. (Also safe to call any other time -- it's just a
    password change that additionally clears the flag.)
    """
    validate_strong_password(payload.new_password)
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()
    _log(db, current_user.id, current_user.role.value, "password_changed", request, details="forced_first_login")
    return {"message": "Password updated. You can now use the dashboard."}


@router.get("/farmer/forgot-password/questions", response_model=schemas.ForgotPasswordQuestionsOut)
def get_security_questions(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.username == normalize_username(username), models.User.role == models.UserRole.farmer
    ).first()
    if not user or not user.security_question_1:
        raise HTTPException(404, "No account with security questions found for that username")
    return schemas.ForgotPasswordQuestionsOut(
        username=username,
        questions=[user.security_question_1, user.security_question_2, user.security_question_3],
    )


@router.post("/farmer/forgot-password/verify", response_model=schemas.VerifySecurityAnswersResult)
def verify_security_answers(payload: schemas.VerifySecurityAnswersRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.username == normalize_username(payload.username), models.User.role == models.UserRole.farmer
    ).first()
    if not user or not user.security_answer_1_hash:
        raise HTTPException(404, "Account not found")

    def norm(a: str) -> str:
        return a.strip().lower()

    ok = (
        verify_password(norm(payload.answer_1), user.security_answer_1_hash)
        and verify_password(norm(payload.answer_2), user.security_answer_2_hash)
        and verify_password(norm(payload.answer_3), user.security_answer_3_hash)
    )
    if not ok:
        _log(db, user.id, user.role.value, "security_answers_failed", request)
        raise HTTPException(400, "One or more answers are incorrect")

    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = user.id
    _log(db, user.id, user.role.value, "security_answers_verified", request)
    return schemas.VerifySecurityAnswersResult(reset_token=token)


@router.post("/farmer/forgot-password/reset")
def reset_password_with_token(payload: schemas.ResetPasswordWithTokenRequest, request: Request, db: Session = Depends(get_db)):
    user_id = _reset_tokens.pop(payload.reset_token, None)
    if not user_id:
        raise HTTPException(400, "Invalid or expired reset token")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    validate_strong_password(payload.new_password)
    user.hashed_password = hash_password(payload.new_password)
    user.must_change_password = False
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    _log(db, user.id, user.role.value, "password_reset_via_security_questions", request)
    return {"message": "Password has been reset. You can now log in."}


# ---------------------------------------------------------------------------
# Shared account actions (all roles)
# ---------------------------------------------------------------------------

@router.post("/change-password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(payload.old_password, current_user.hashed_password or ""):
        raise HTTPException(400, "Old password is incorrect")
    validate_strong_password(payload.new_password)
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()
    _log(db, current_user.id, current_user.role.value, "password_changed", request)
    return {"message": "Password changed successfully"}


@router.post("/change-email")
def change_email(
    payload: schemas.ChangeEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Lets any logged-in user (Admin, Operator, or Farmer) update the email
    on their own account. Requires the current password to confirm it's
    really the account owner, since a compromised session changing the
    email first is a classic way to hijack an account's recovery path.
    """
    if not verify_password(payload.password, current_user.hashed_password or ""):
        raise HTTPException(400, "Password is incorrect")

    new_email = payload.new_email.strip().lower()
    existing = db.query(models.User).filter(models.User.email == new_email, models.User.id != current_user.id).first()
    if existing:
        raise HTTPException(400, "That email is already in use by another account")

    old_email = current_user.email
    current_user.email = new_email
    current_user.is_email_verified = False  # would need re-verification in a real email-sending setup
    # Keep the linked Farmer profile's email in sync so staff views stay consistent.
    if current_user.role == models.UserRole.farmer and current_user.farmer_profile:
        current_user.farmer_profile.email = new_email
    db.commit()
    _log(db, current_user.id, current_user.role.value, "email_changed", request, details=f"{old_email} -> {new_email}")
    return {"message": "Email updated successfully", "email": new_email}


@router.post("/google", response_model=schemas.AdminLoginResult)
def google_login(payload: schemas.GoogleLoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Google Sign-In for any of the three roles, but it only ever logs
    into an EXISTING account -- it never creates one. Accounts are always
    provisioned first through their normal path (Admin self-registers up
    to the 3-account cap; Operator and Farmer accounts are created by an
    Admin), and Google Sign-In is just an alternate way to authenticate
    into that same account afterwards, matched by email on first use.

    Response shape matches admin/login's (status "logged_in" or
    "pending_approval") so the frontend can handle all three roles the
    same way -- for Operator/Farmer, status is always "logged_in".
    """
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    if settings.google_client_id:
        try:
            idinfo = google_id_token.verify_oauth2_token(
                payload.credential, google_requests.Request(), settings.google_client_id
            )
            google_id = idinfo["sub"]
            email = idinfo.get("email")
            picture = idinfo.get("picture")
            full_name = idinfo.get("name") or (email.split("@")[0].capitalize() if email else "Google User")
        except Exception:
            try:
                idinfo = google_id_token.verify_oauth2_token(
                    payload.credential, google_requests.Request(), clock_skew_in_seconds=10
                )
                google_id = idinfo["sub"]
                email = idinfo.get("email")
                picture = idinfo.get("picture")
                full_name = idinfo.get("name") or (email.split("@")[0].capitalize() if email else "Google User")
            except Exception as e:
                if settings.allow_google_signin_dev:
                    google_id = str(payload.credential)
                    email = f"{google_id}@dev.local"
                    picture = None
                    full_name = "Dev Google User"
                else:
                    raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Could not verify Google credential: {str(e)}")
    else:
        try:
            idinfo = google_id_token.verify_oauth2_token(
                payload.credential, google_requests.Request(), clock_skew_in_seconds=10
            )
            google_id = idinfo["sub"]
            email = idinfo.get("email")
            picture = idinfo.get("picture")
            full_name = idinfo.get("name") or (email.split("@")[0].capitalize() if email else "Google User")
        except Exception:
            if not settings.allow_google_signin_dev:
                raise HTTPException(
                    status.HTTP_501_NOT_IMPLEMENTED,
                    "Google Sign-In is not configured. Set GOOGLE_CLIENT_ID in the backend environment.",
                )
            google_id = str(payload.credential)
            email = f"{google_id}@dev.local"
            picture = None
            full_name = "Dev Google User"

    role_to_filter = {
        "admin": models.User.role.in_(list(ADMIN_ROLES)),
        "operator": models.User.role == models.UserRole.water_operator,
        "farmer": models.User.role == models.UserRole.farmer,
    }
    role_label = {"admin": "Admin (Adaksha)", "operator": "Operator", "farmer": "Farmer"}
    if payload.role not in role_to_filter:
        raise HTTPException(400, "Unknown role")

    user = db.query(models.User).filter(models.User.google_id == google_id, role_to_filter[payload.role]).first()
    if not user and email:
        user = db.query(models.User).filter(models.User.email == email, role_to_filter[payload.role]).first()

    if not user:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Access denied. No {role_label[payload.role]} account is linked to this Google email ({email or google_id}). "
            "Only pre-authorized accounts can sign in via Google.",
        )

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    # If the user's Google account is NOT linked (unlinked or purged), require Admin Approval!
    if not user.google_id:
        pub_id = secrets.token_urlsafe(16)
        challenge = models.LoginChallenge(
            public_id=pub_id,
            user_id=user.id,
            status=models.LoginChallengeStatus.pending,
            requester_ip=get_client_ip(request),
            requester_user_agent=request.headers.get("user-agent", "")[:250],
        )
        db.add(challenge)
        db.commit()

        # Notify Super Admins
        admins = db.query(models.User).filter(models.User.role.in_(list(ADMIN_ROLES))).all()
        for a in admins:
            notify_user(
                db, a.id,
                "🔐 Pending Google Login Approval Request",
                f"User '{user.full_name}' ({email or user.email}) requested Google Sign-in approval from IP {get_client_ip(request)}.",
            )

        _log(db, user.id, user.role.value, "google_approval_requested", request, details=pub_id)

        return schemas.AdminLoginResult(
            status="pending_approval",
            pending_challenge_id=pub_id,
            message="Google Sign-in requires Admin approval. Request sent to Admin.",
        )

    if picture and not user.photo_url:
        user.photo_url = picture
    db.commit()

    if user.role in ADMIN_ROLES:
        return _issue_admin_session_or_challenge(user, request, db)

    _register_successful_login(db, user, request)
    _log(db, user.id, user.role.value, "login_success", request, details="google")
    token = create_access_token(subject=str(user.id), extra={"role": user.role.value})
    return schemas.AdminLoginResult(status="logged_in", token=schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user)))


@router.post("/unlink-google")
def unlink_google_account(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Unlinks/deletes the Google account ID associated with the logged in user."""
    current_user.google_id = None
    db.commit()
    db.refresh(current_user)
    _log(db, current_user.id, current_user.role.value, "google_unlinked", request)
    return {"message": "Google account unlinked successfully."}


@router.post("/admin/purge-all-google-links")
def purge_all_non_default_google_links(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
):
    """
    Purges/unlinks Google accounts for all users except the primary default Super Admin.
    Any unlinked account attempting Google login will require Admin approval.
    """
    first_admin = db.query(models.User).filter(models.User.role == models.UserRole.super_admin).order_by(models.User.id.asc()).first()
    first_admin_id = first_admin.id if first_admin else current_user.id

    users_to_purge = db.query(models.User).filter(models.User.id != first_admin_id, models.User.google_id.isnot(None)).all()
    count = len(users_to_purge)
    for u in users_to_purge:
        u.google_id = None

    db.commit()
    _log(db, current_user.id, current_user.role.value, "purge_all_google_links", request, details=f"Purged {count} accounts")
    return {"message": f"Successfully unlinked {count} Google accounts. Future Google logins will require Admin approval."}


@router.post("/admin/unlink-user-google/{user_id}")
def unlink_user_google_by_admin(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.google_id = None
    db.commit()
    _log(db, current_user.id, current_user.role.value, "admin_unlinked_user_google", request, details=f"User ID {user_id}")
    return {"message": f"Google account unlinked for user {user.full_name}. Future Google logins will require Admin approval."}


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/profile", response_model=schemas.UserOut)
def update_profile(
    payload: schemas.UpdateProfileRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Lets any logged-in user (Admin, Operator, or Farmer) rename their own account."""
    new_name = payload.full_name.strip()
    if not new_name:
        raise HTTPException(400, "Name cannot be empty")

    old_name = current_user.full_name
    current_user.full_name = new_name
    # Keep the linked Farmer profile's name in sync so staff views stay consistent.
    if current_user.role == models.UserRole.farmer and current_user.farmer_profile:
        current_user.farmer_profile.full_name = new_name
    db.commit()
    db.refresh(current_user)
    _log(db, current_user.id, current_user.role.value, "profile_updated", request, details=f"{old_name} -> {new_name}")
    return current_user


@router.get("/login-logs", response_model=List[schemas.LoginLogOut])
def list_login_logs(
    db: Session = Depends(get_db),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    """Admin-only view of login activity across all users."""
    return db.query(models.LoginLog).order_by(models.LoginLog.id.desc()).limit(500).all()
