import time

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

Base = declarative_base()

# How many times (and how long between attempts) to retry the initial
# MySQL connection before giving up. This smooths over the common
# "app starts before the MySQL service is ready" race on first boot /
# container startup, without masking a genuinely misconfigured DB.
_CONNECT_RETRIES = 3
_CONNECT_RETRY_DELAY_SECONDS = 1.5


def _try_connect(engine) -> bool:
    try:
        conn = engine.connect()
        conn.close()
        return True
    except OperationalError:
        return False


def _build_engine():
    """
    Always attempts the configured DATABASE_URL first (retrying a few
    times in case MySQL is still starting up). If it can't be reached:
      - USE_SQLITE_FALLBACK=true  -> fall back to a local SQLite file so
        the app stays runnable for local development/demos.
      - USE_SQLITE_FALLBACK=false -> raise a clear, actionable error
        instead of a bare connection traceback, since the user has
        explicitly opted into requiring a real MySQL connection.
    """
    mysql_engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_recycle=280,  # stay well under MySQL's default wait_timeout
        connect_args={"connect_timeout": 5},
    )

    connected = False
    for attempt in range(1, _CONNECT_RETRIES + 1):
        if _try_connect(mysql_engine):
            connected = True
            break
        if attempt < _CONNECT_RETRIES:
            time.sleep(_CONNECT_RETRY_DELAY_SECONDS)

    if connected:
        print(f"[sichai-pani] Connected to MySQL at {_redact(settings.database_url)}")
        return mysql_engine

    if settings.use_sqlite_fallback:
        print(
            "[sichai-pani] Could not connect to MySQL after "
            f"{_CONNECT_RETRIES} attempts -- falling back to local SQLite "
            "(dev only). Set USE_SQLITE_FALLBACK=false once MySQL is reachable."
        )
        return create_engine("sqlite:///./sichai_pani.db", connect_args={"check_same_thread": False})

    raise RuntimeError(
        "Could not connect to MySQL and USE_SQLITE_FALLBACK is disabled.\n"
        f"  DATABASE_URL = {_redact(settings.database_url)}\n"
        "  Checklist:\n"
        "    1. Is the MySQL server running and reachable on that host/port?\n"
        "    2. Do the username/password/database name in DATABASE_URL match a real account?\n"
        "    3. Does the database itself exist? (see backend/schema.sql)\n"
        "  Or set USE_SQLITE_FALLBACK=true in backend/.env to run locally without MySQL."
    )


def _redact(url: str) -> str:
    """Hides the password portion of a DB URL for safe logging."""
    if "://" not in url or "@" not in url:
        return url
    scheme, rest = url.split("://", 1)
    creds, host_part = rest.split("@", 1)
    user = creds.split(":", 1)[0]
    return f"{scheme}://{user}:****@{host_part}"


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
