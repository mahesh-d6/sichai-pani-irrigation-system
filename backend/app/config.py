"""
Central application configuration.

All values are read from environment variables (see .env.example).
For local development where a MySQL server isn't available, the app
automatically falls back to a SQLite file database so the API is
still runnable out of the box. Set USE_SQLITE_FALLBACK=false and
provide a real DATABASE_URL to run against MySQL or Oracle.
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://sichai_user:sichai_pass@localhost:3306/sichai_pani"
    use_sqlite_fallback: bool = True

    jwt_secret_key: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Comma-separated list of allowed frontend origins for CORS.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost,http://127.0.0.1,https://sichai-pani-irrigation-system-1.onrender.com"

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
    allow_google_signin_dev: bool = True

    # File uploads (payment proofs, complaint photos, farmer documents).
    upload_dir_name: str = "uploads"

    @property
    def upload_dir(self) -> str:
        data_dir = os.environ.get("DATA_DIR")
        if data_dir:
            path = os.path.join(data_dir, self.upload_dir_name)
            os.makedirs(path, exist_ok=True)
            return path
        return self.upload_dir_name

    max_upload_size_mb: int = 5

    # Admin (Adaksha) account cap
    max_admin_accounts: int = 3

    # Failed-login lockout, applied to all three roles.
    max_failed_login_attempts: int = 5
    lockout_minutes: int = 15

    # Minimum password strength
    min_password_length: int = 8


settings = Settings()
