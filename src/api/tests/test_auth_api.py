from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from src.api.auth import COOKIE_NAME, get_db, router
from src.api.origin import AuthOriginMiddleware, normalize_origin, normalize_origins
from src.database.models import Base, User


FRONTEND_ORIGINS = normalize_origins(
    ["http://localhost:5173", "http://127.0.0.1:5173"]
)


def make_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    testing_sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_db():
        db = testing_sessions()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.add_middleware(
        SessionMiddleware,
        secret_key="test-only-secret-which-is-long-enough",
        session_cookie=COOKIE_NAME,
        max_age=60 * 60 * 24 * 7,
        same_site="lax",
        https_only=False,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=FRONTEND_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    app.add_middleware(
        AuthOriginMiddleware,
        allowed_origins=FRONTEND_ORIGINS,
        session_cookie=COOKIE_NAME,
    )
    app.include_router(router)
    app.dependency_overrides[get_db] = override_db
    return TestClient(app), testing_sessions, engine


def test_signup_from_configured_frontend_normalizes_and_persists_hash():
    client, sessions, engine = make_client()
    response = client.post(
        "/api/auth/signup",
        json={"name": "  Example User ", "email": "USER@Example.com", "password": "password-123"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Example User"
    assert "password_hash" not in response.json()
    with sessions() as db:
        user = db.query(User).one()
        assert user.email == "user@example.com"
        assert user.password_hash != "password-123"
        assert user.password_hash.startswith("$2")
    engine.dispose()


def test_duplicate_email_and_invalid_signup_are_rejected():
    client, _, engine = make_client()
    payload = {"name": "Example User", "email": "user@example.com", "password": "password-123"}
    assert client.post("/api/auth/signup", json=payload).status_code == 201
    duplicate = client.post("/api/auth/signup", json={**payload, "email": "USER@example.com"})
    assert duplicate.status_code == 409
    assert client.post("/api/auth/signup", json={**payload, "password": "short"}).status_code == 422
    engine.dispose()


def test_login_me_and_logout_session_lifecycle():
    client, _, engine = make_client()
    payload = {"name": "Example User", "email": "user@example.com", "password": "password-123"}
    client.post("/api/auth/signup", json=payload, headers={"Origin": "http://localhost:5173"})
    assert client.get("/api/auth/me").status_code == 401
    assert client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": "wrong-password"},
        headers={"Origin": "http://localhost:5173"},
    ).status_code == 401
    assert client.post(
        "/api/auth/login",
        json={"email": "missing@example.com", "password": "password-123"},
        headers={"Origin": "http://localhost:5173"},
    ).status_code == 401
    authenticated = client.post(
        "/api/auth/login",
        json={"email": "USER@example.com", "password": payload["password"]},
        headers={"Origin": "http://localhost:5173"},
    )
    assert authenticated.status_code == 200
    assert "password_hash" not in authenticated.json()
    session_cookie = authenticated.headers["set-cookie"].lower()
    assert "httponly" in session_cookie
    assert "samesite=lax" in session_cookie
    assert "secure" not in session_cookie
    assert client.get("/api/auth/me").json()["email"] == payload["email"]
    logout_response = client.post(
        "/api/auth/logout", headers={"Origin": "http://localhost:5173"}
    )
    assert logout_response.status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    engine.dispose()


def test_originless_requests_are_allowed_without_a_session_cookie():
    client, _, engine = make_client()
    payload = {"name": "Example User", "email": "user@example.com", "password": "password-123"}
    response = client.post("/api/auth/signup", json=payload)
    assert response.status_code == 201
    assert client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    ).status_code == 200

    # Origin-less requests remain usable until they carry a cookie-authenticated session.
    response = client.post("/api/auth/logout")
    assert response.status_code == 403
    assert response.json()["detail"] == "Origin required for cookie-authenticated requests"
    assert client.get("/api/auth/me").status_code == 200

    response = client.post(
        "/api/auth/logout",
        headers={"Origin": "http://localhost.attacker.test:5173"},
    )
    assert response.status_code == 403
    assert client.get("/api/auth/me").status_code == 200

    response = client.post(
        "/api/auth/logout", headers={"Origin": "http://localhost:5173"}
    )
    assert response.status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    engine.dispose()


def test_untrusted_origin_is_rejected_for_authentication_mutations():
    client, _, engine = make_client()
    response = client.post(
        "/api/auth/signup",
        json={"name": "Example User", "email": "user@example.com", "password": "password-123"},
        headers={"Origin": "http://localhost.attacker.test:5173"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Origin not allowed"
    engine.dispose()


def test_me_rejects_invalid_session_cookie():
    client, _, engine = make_client()
    client.cookies.set(COOKIE_NAME, "not-a-valid-signed-session")
    assert client.get("/api/auth/me").status_code == 401
    engine.dispose()


def test_logout_clears_the_session_cookie():
    client, _, engine = make_client()
    payload = {"name": "Example User", "email": "user@example.com", "password": "password-123"}
    client.post("/api/auth/signup", json=payload)
    client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    response = client.post("/api/auth/logout", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    cleared_cookie = next(
        cookie.lower()
        for cookie in response.headers.get_list("set-cookie")
        if COOKIE_NAME in cookie
    )
    assert "expires=thu, 01 jan 1970 00:00:00 gmt" in cleared_cookie
    assert client.get("/api/auth/me").status_code == 401
    engine.dispose()


def test_cors_preflight_allows_configured_frontend_credentials():
    client, _, engine = make_client()
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    assert response.headers["access-control-allow-credentials"] == "true"
    engine.dispose()


def test_origin_normalization_is_exact_and_rejects_malformed_values():
    assert normalize_origin("HTTP://LOCALHOST:5173/") == "http://localhost:5173"
    assert normalize_origin("http://localhost.attacker.test:5173") not in FRONTEND_ORIGINS
    assert normalize_origin("http://user@localhost:5173") is None
    assert normalize_origin("null") is None
