import os
import time

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

Base = declarative_base()

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
    Builds the database engine.
    1. Checks if a remote DATABASE_URL (MySQL/PostgreSQL) is provided and reachable.
    2. Falls back to a persistent SQLite database in the backend/data/ directory.
    """
    db_url = settings.database_url or ""
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    if ("mysql" in db_url or "postgres" in db_url) and "localhost:3306" not in db_url:
        try:
            connect_args = {"connect_timeout": 5} if "mysql" in db_url else {}
            engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_recycle=280,
                connect_args=connect_args,
            )
            for attempt in range(1, _CONNECT_RETRIES + 1):
                if _try_connect(engine):
                    print(f"[sichai-pani] Connected to database at {_redact(db_url)}")
                    return engine
                if attempt < _CONNECT_RETRIES:
                    time.sleep(_CONNECT_RETRY_DELAY_SECONDS)
        except Exception as e:
            print(f"[sichai-pani] Remote DB connection error: {e}")

    # Fallback to persistent SQLite file database in backend/data/ directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.environ.get("DATA_DIR") or os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    db_file_path = os.path.join(data_dir, "sichai_pani.db")
    sqlite_url = f"sqlite:///{db_file_path}"
    print(f"[sichai-pani] Using persistent SQLite database at: {db_file_path}")
    return create_engine(sqlite_url, connect_args={"check_same_thread": False})


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
