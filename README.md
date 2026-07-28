# Sichai Pani — Irrigation Management System

A full-stack irrigation (water-request, billing, and payment) management
system: React + TypeScript + Tailwind frontend, FastAPI backend, MySQL
database schema, JWT auth, and role-based access control.

## What's included and working

- **Auth**: register/login with email or mobile, JWT tokens, remember-me,
  **change password** (Settings page, or `POST /api/auth/change-password`),
  forgot/reset password, role-based access control (Super Admin, Admin,
  Water Operator, Farmer, Guest).
- **Google Sign-In**: real Google Identity Services integration —
  configured out of the box with the client ID below. Falls back to a
  clearly-labeled dev button automatically if no client ID is set.
- **Farmers**: full CRUD, search by name/phone/village, farmer codes.
- **Water requests**: farmers request water with date/start/end time,
  crop, canal, pump, remarks. **Hours and price are calculated
  automatically** — both live in the UI as you pick times, and again
  authoritatively on the server (`compute_hours_and_amount` in
  `backend/app/routers/requests.py`) — at a configurable rate
  (`Rs.200/hour` by default). Admins approve/reject/reschedule and assign
  an operator; rescheduling recalculates the bill.
- **Payments**: eSewa / Khalti / Fonepay / bank transfer / cash. Farmers
  pay for their own outstanding requests from the Payments page ("Pay
  Now") and **must upload proof of payment** (a screenshot or PDF
  receipt) for every method except cash — cash is collected in person and
  recorded by staff. Staff review the proof and mark it verified (paid)
  or reject it from the same page. Cash marks itself paid immediately.
  The other methods are otherwise stubbed as pending-until-webhook
  (`/api/payments/webhook/{gateway}`) — that's where you'd verify each
  gateway's callback signature and call their real initiate-payment API
  once you have merchant credentials. PDF receipts generate on demand.
- **Complaints**: farmers file (leakage, no water, late supply, broken
  canal, other), staff reply and resolve.
- **Farmer login**: a separate, farmer-branded login page at `/farmer/login`
  with three ways in — password, mobile OTP, or Google — plus a
  self-registration page at `/farmer/register`. Staff (Admin/Operator) sign
  in at `/login`, which links across to the farmer page and vice versa.
- **Nepali language**: a language switcher (sidebar, login pages, and
  Settings) toggles the whole UI chrome between English and Nepali —
  navigation, login/registration screens, and dashboard labels are all
  translated (`frontend/src/i18n/translations.ts`). The choice persists
  in the browser.
- **Dashboard**: live stats (farmers, active requests, today's schedule,
  revenue, water used, monthly income, pending payments, active pumps,
  complaints, notifications) plus water-usage and revenue charts.
- **Reports**: water history as CSV or Excel, outstanding payments list.
- **Settings**: company name, water rate, currency, language (admin-only),
  plus change-password (all roles) — stored in the `settings` table.
- **File uploads**: payment proofs (and any future complaint photos /
  farmer documents) are saved under `backend/uploads/` and served at
  `/uploads/...`. Only `.jpg .jpeg .png .webp .pdf` up to 5MB are
  accepted.
- **Security**: JWT auth, bcrypt password hashing, role checks on every
  mutating endpoint, parameterized queries via SQLAlchemy (SQL-injection
  safe), CORS locked to the frontend origin, upload allow-list + size cap.
- **UI**: glassmorphism cards, blue/green irrigation theme, dark mode,
  responsive layout, Framer Motion transitions.

## What's scaffolded but needs real credentials/integration

These are structured so wiring them up is a matter of adding API keys,
not redesigning anything:

- Mobile OTP (`/api/auth/otp/*`) — needs an SMS gateway (Sparrow SMS,
  Twilio, etc.); currently prints the OTP to the server log.
- Payment gateways (eSewa/Khalti/Fonepay) — needs each gateway's merchant
  credentials and their initiate/verify API calls; proof-upload + manual
  staff verification stands in for this until then.
- Email sending for verification/reset links — currently logs to console
  instead of sending mail.
- QR codes, PWA/offline support, weather API, SMS/email notification
  delivery — not built in this pass; the data model (settings,
  notifications tables) supports adding them.

## Running it locally

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # already filled in with a working Google client ID below
python seed.py            # creates tables + demo data
uvicorn app.main:app --reload --port 8001
```

The backend targets MySQL (`DATABASE_URL` in `.env`). On startup it tries
that connection a few times (to survive MySQL still starting up), and:
- if it connects, it uses MySQL and prints `Connected to MySQL at ...`
- if it can't connect and `USE_SQLITE_FALLBACK=true`, it falls back to a
  local `sichai_pani.db` SQLite file so you can still run the app
- if it can't connect and `USE_SQLITE_FALLBACK=false` (the shipped
  default), it fails fast with a clear checklist instead of a bare
  traceback — check MySQL is running, the credentials in `DATABASE_URL`
  are correct, and the database itself exists (see `schema.sql`)

Demo logins after seeding:
- Admin: `admin@sichaipani.com` / `Admin@123`
- Operator: `operator@sichaipani.com` / `Operator@123`
- Farmer: `farmer@sichaipani.com` / `Farmer@123` (has one outstanding
  unpaid water request pre-loaded, so you can try "Pay Now" immediately)

API docs: `http://localhost:8001/docs`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # already points at http://127.0.0.1:8001
npm run dev
```

Opens at `http://localhost:5173`.

### Google Sign-In

A working client ID is already set in both `backend/.env`
(`GOOGLE_CLIENT_ID`) and `frontend/.env` (`VITE_GOOGLE_CLIENT_ID`):

```
689098637340-sh3f1per7t6lk73ueopffqcl2ba2he47.apps.googleusercontent.com
```

With that in place, the login pages render a real "Continue with Google"
button and the backend verifies real Google ID tokens
(`/api/auth/google`) — no dev bypass is used. Make sure
`http://localhost:5173` (and any other origin you serve the frontend
from) is added under **Authorized JavaScript origins** in the Google
Cloud Console for this client ID, or Google will reject the sign-in at
the browser level before it ever reaches the backend.

If you ever need to run without Google configured (e.g. a fresh clone
before setting `VITE_GOOGLE_CLIENT_ID`), the frontend automatically shows
a labeled "Continue with Google (dev)" button instead, and the backend
accepts it only while `ALLOW_GOOGLE_SIGNIN_DEV=true` **and**
`GOOGLE_CLIENT_ID` is empty — never enable the dev bypass in production.

## Project structure

```
backend/
  app/
    main.py          FastAPI app, CORS, static /uploads mount, router registration
    config.py         Environment-driven settings
    database.py       SQLAlchemy engine (MySQL w/ retry, SQLite dev fallback)
    models.py          All tables: users, farmers, water_requests, payments
                       (incl. proof_url), complaints, notifications, settings,
                       audit_logs, canals, pumps
    schemas.py         Pydantic request/response models
    auth.py            Password hashing + JWT
    deps.py            get_current_user / require_roles (RBAC)
    uploads.py          Shared file-upload helper (validation + safe storage)
    routers/
      auth.py          Register, login, change-password, OTP, Google, password reset
      users.py          Admin user management
      farmers.py         Farmer CRUD + search
      requests.py         Water requests + the hour/price calculator
      payments.py          Payments + proof upload, gateway webhook stub, PDF receipts
      complaints.py         Complaint filing + replies
      dashboard.py          Stats + chart data
      reports.py             CSV/Excel export
      misc.py                 Settings, canals/pumps, notifications
  schema.sql          Reference MySQL DDL
  seed.py             Demo data loader
  requirements.txt
  uploads/            Uploaded proof/photo files land here (created automatically)

frontend/
  src/
    pages/            Login, Dashboard, Farmers, WaterRequests, Payments
                       (Pay Now + proof upload + staff verify), Complaints,
                       Reports, Settings (change password)
    components/        Layout (sidebar/topbar/dark mode), StatCard, GoogleButton
    context/            AuthContext (JWT storage, login/logout)
    services/api.ts      Axios client with auth interceptor
```

## Configurable water rate

The rate is defined in `backend/.env` as `WATER_RATE_PER_HOUR` (default
`200`) and applied automatically to every new request:

```
total_hours   = (end_time - start_time), rounded to the nearest quarter hour
total_amount  = total_hours × rate_per_hour
```
