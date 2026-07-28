"""
Central application configuration.

All values are read from environment variables (see .env.example).
For local development where a MySQL server isn't available, the app
automatically falls back to a SQLite file database so the API is
still runnable out of the box. Set USE_SQLITE_FALLBACK=false and
provide a real DATABASE_URL to run against MySQL.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://sichai_user:sichai_pass@localhost:3306/sichai_pani"
    use_sqlite_fallback: bool = True

    jwt_secret_key: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Comma-separated list of allowed frontend origins for CORS. Defaults
    # to local dev ports; set this to your real deployed frontend URL(s)
    # in production, e.g. "https://sichaipani.example.com".
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    water_rate_per_hour: float = 200.0
    currency: str = "Rs."
    company_name: str = "Sichai Pani Irrigation Services"

    esewa_merchant_id: str = ""
    khalti_secret_key: str = ""
    fonepay_merchant_id: str = ""

    google_client_id: str = ""
    # When true, allow a development bypass that skips verifying Google ID
    # tokens and accepts any credential string. DO NOT enable in production.
    allow_google_signin_dev: bool = True

    # File uploads (payment proofs, complaint photos, farmer documents).
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 5

    # Admin (Sadasya) account cap -- once this many admin/super_admin
    # accounts exist, the public admin-registration option disappears.
    max_admin_accounts: int = 3

    # Failed-login lockout, applied to all three roles.
    max_failed_login_attempts: int = 5
    lockout_minutes: int = 15

    # Minimum password strength (applies to admin registration, farmer
    # password changes/resets, and operator password changes).
    min_password_length: int = 8


settings = Settings()
