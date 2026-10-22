import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from src.api.auth import COOKIE_NAME, router as auth_router
from src.api.origin import AuthOriginMiddleware, normalize_origins
from src.api.planning import router as planning_router
from src.api.ml import router as ml_router
from src.api.wellness import router as wellness_router
from src.api.transactions import router as financial_router
from src.database.db_connection import engine
from src.database.models import Base
from src.database import financial_models as _financial_models

load_dotenv()
secret = os.getenv("SESSION_SECRET")
if not secret or len(secret) < 32:
    raise RuntimeError("Set SESSION_SECRET to a random value of at least 32 characters")

app = FastAPI(title="MoneyMind AI API")
configured_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")
origins = normalize_origins(
    origin for origin in configured_origins if origin.strip()
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=(
        r"https?://(?:localhost|127\.0\.0\.1|\[::1\])(?::[1-9][0-9]{0,4})?"
        if os.getenv("APP_ENV", "development").lower() not in {"production", "prod"}
        else None
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=secret, session_cookie=COOKIE_NAME, max_age=60 * 60 * 24 * 7, same_site="lax", https_only=os.getenv("COOKIE_SECURE", "false").lower() == "true")
app.add_middleware(
    AuthOriginMiddleware,
    allowed_origins=origins,
    session_cookie=COOKIE_NAME,
    allow_localhost_origins=os.getenv("APP_ENV", "development").lower()
    not in {"production", "prod"},
)
app.include_router(auth_router)
app.include_router(financial_router)
app.include_router(planning_router)
app.include_router(ml_router)
app.include_router(wellness_router)


@app.on_event("startup")
def create_and_extend_schema():
    # create_all creates a missing users table and leaves all existing tables/data intact.
    Base.metadata.create_all(bind=engine)
    # Safe additive PostgreSQL migration for installations with the original users table.
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
        duplicate = connection.execute(text("SELECT 1 FROM users GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1 LIMIT 1")).first()
        if duplicate:
            raise RuntimeError("Cannot normalize users.email: existing case-insensitive duplicate emails must be resolved first")
        connection.execute(text("UPDATE users SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email))"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email))"))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def readiness():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready"}
