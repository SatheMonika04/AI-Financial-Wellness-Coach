from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.middleware.sessions import SessionMiddleware

from src.api.auth import COOKIE_NAME, get_db, router as auth_router
from src.api.origin import AuthOriginMiddleware
from src.api.planning import router as planning_router
from src.api import ml as ml_api
from src.api.wellness import router as wellness_router
from src.api.transactions import router as financial_router
from src.database.financial_models import FinancialBudget, FinancialTransaction, SavingsGoal, UserPreferences
from src.database.models import Base


def make_financial_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_db():
        db = sessions()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.add_middleware(
        SessionMiddleware,
        secret_key="test-only-secret-which-is-long-enough",
        session_cookie=COOKIE_NAME,
    )
    app.add_middleware(
        AuthOriginMiddleware,
        allowed_origins={"http://localhost:5173"},
        session_cookie=COOKIE_NAME,
    )
    app.include_router(auth_router)
    app.include_router(financial_router)
    app.include_router(planning_router)
    app.include_router(ml_api.router)
    app.include_router(wellness_router)
    app.dependency_overrides[get_db] = override_db
    return TestClient(app), sessions, engine


def register_and_login(client: TestClient, email: str):
    origin = {"Origin": "http://localhost:5173"}
    payload = {"name": "Test User", "email": email, "password": "password-123"}
    assert client.post("/api/auth/signup", json=payload, headers=origin).status_code == 201
    assert client.post(
        "/api/auth/login",
        json={"email": email, "password": payload["password"]},
        headers=origin,
    ).status_code == 200
    return origin


def test_transaction_import_list_and_dashboard_are_user_scoped():
    client, sessions, engine = make_financial_client()
    origin = register_and_login(client, "first@example.com")
    assert client.get("/api/transactions").status_code == 200

    payload = {
        "rows": [
            {
                "key": "row-1",
                "date": "2026-10-01T12:00:00",
                "merchant": "Market",
                "description": "Grocery purchase",
                "amount": "125.50",
                "type": "expense",
                "category": "Groceries",
            },
            {
                "key": "row-2",
                "date": "2026-10-02T12:00:00",
                "merchant": "Employer",
                "description": "Salary",
                "amount": "1000.00",
                "type": "income",
                "category": "Income",
            },
        ]
    }
    imported = client.post("/api/transactions/import", json=payload, headers=origin)
    assert imported.status_code == 200
    assert imported.json()["importedRows"] == 2
    assert client.post("/api/transactions/import", json=payload, headers=origin).json()[
        "duplicateRowsSkipped"
    ] == 2

    summary = client.get("/api/dashboard/summary").json()
    assert summary["income"] == 1000
    assert summary["expenses"] == 125.5
    assert summary["netCashFlow"] == 874.5
    assert summary["transactionCount"] == 2

    with sessions() as db:
        transaction_id = db.query(FinancialTransaction).first().id

    register_and_login(client, "second@example.com")
    assert client.get("/api/transactions").json()["total"] == 0
    # Foreign transaction IDs are reported as not found, preventing ownership disclosure.
    assert client.get(f"/api/transactions/{transaction_id}").status_code == 404
    engine.dispose()


def test_statement_upload_requires_authentication_and_import_reports_invalid_rows():
    client, _, engine = make_financial_client()
    file = {"file": ("statement.csv", b"Date,Description,Amount\n2026-10-01,Coffee,4.50\n", "text/csv")}
    assert client.post("/api/statements/upload", files=file).status_code == 401

    origin = register_and_login(client, "upload@example.com")
    response = client.post("/api/statements/upload", files=file, headers=origin)
    assert response.status_code == 200
    assert response.json()["rows"] == [["2026-10-01", "Coffee", "4.50"]]

    imported = client.post(
        "/api/transactions/import",
        json={"rows": [{"date": "not-a-date", "amount": -1}]},
        headers=origin,
    )
    assert imported.status_code == 200
    assert imported.json()["invalidRows"] == 1
    assert imported.json()["importedRows"] == 0
    engine.dispose()


def test_budget_goal_and_preferences_are_persistent_and_user_scoped():
    client, sessions, engine = make_financial_client()
    origin = register_and_login(client, "planner@example.com")
    budget = client.put(
        "/api/budgets/Groceries", json={"monthlyLimit": 5000}, headers=origin
    )
    assert budget.status_code == 200
    assert budget.json()["monthlyLimit"] == 5000
    assert client.get("/api/budgets").json()[0]["category"] == "Groceries"

    goal = client.post(
        "/api/goals",
        json={
            "name": "Emergency savings",
            "type": "emergency",
            "targetAmount": 20000,
            "currentAmount": 2000,
            "targetDate": "2030-01-01",
            "completed": False,
        },
        headers=origin,
    )
    assert goal.status_code == 201
    goal_id = goal.json()["id"]
    assert client.get("/api/goals").json()[0]["id"] == goal_id
    assert client.patch(
        f"/api/goals/{goal_id}",
        json={**goal.json(), "currentAmount": 20000, "completed": True},
        headers=origin,
    ).status_code == 200

    prefs = client.put(
        "/api/preferences",
        json={
            "profile": {"name": "Planner", "email": "planner@example.com", "monthlyIncome": 50000, "city": "Pune"},
            "settings": {
                "currency": "INR", "theme": "dark",
                "notifications": {"anomalyAlerts": True, "budgetAlerts": False, "weeklySummary": False, "goalReminders": False},
                "privacy": {"persistLocally": False, "shareAnonymized": False},
                "financial": {"monthStartDay": 1, "lowConfidenceThreshold": 0.7},
            },
        },
        headers=origin,
    )
    assert prefs.status_code == 200
    assert client.get("/api/preferences").json()["profile"]["monthlyIncome"] == 50000

    register_and_login(client, "other-planner@example.com")
    assert client.get("/api/budgets").json() == []
    assert client.get("/api/goals").json() == []
    assert client.get("/api/preferences").json()["profile"]["monthlyIncome"] == 0
    assert client.patch(
        f"/api/goals/{goal_id}",
        json={**goal.json(), "currentAmount": 20000, "completed": True},
        headers={"Origin": "http://localhost:5173"},
    ).status_code == 404
    assert client.delete(
        "/api/budgets/Groceries", headers={"Origin": "http://localhost:5173"}
    ).status_code == 404

    with sessions() as db:
        assert db.query(FinancialBudget).count() == 1
        assert db.query(SavingsGoal).count() == 1
        assert db.query(UserPreferences).count() == 1
    engine.dispose()


def test_categorization_model_inference_and_missing_artifact(monkeypatch, tmp_path):
    client, _, engine = make_financial_client()
    origin = register_and_login(client, "categorize@example.com")
    response = client.post(
        "/api/ml/categorize",
        json={"items": [{"description": "restaurant dinner", "amount": 87.45, "type": "expense"}]},
        headers=origin,
    )
    assert response.status_code == 200
    prediction = response.json()[0]
    assert prediction["predictedCategory"] in {
        "Housing", "Groceries", "Transportation", "Dining", "Shopping", "Healthcare",
        "Utilities", "Entertainment", "Education", "Other", "Income",
    }
    assert 0 <= prediction["confidence"] <= 1

    monkeypatch.setattr(ml_api, "MODEL_PATH", tmp_path / "missing-model.pkl")
    unavailable = client.post(
        "/api/ml/categorize",
        json={"items": [{"description": "dinner", "amount": 20, "type": "expense"}]},
        headers=origin,
    )
    assert unavailable.status_code == 503
    engine.dispose()


def test_anomaly_model_results_and_reviews_are_user_scoped(monkeypatch, tmp_path):
    client, _, engine = make_financial_client()
    origin = register_and_login(client, "anomaly@example.com")
    imported = client.post(
        "/api/transactions/import",
        json={"rows": [{
            "key": "test", "date": "2026-10-01T23:10:00", "merchant": "First Shop",
            "description": "Late purchase", "amount": "2500", "type": "expense",
            "category": "Shopping",
        }]},
        headers=origin,
    )
    transaction_id = imported.json()["transactions"][0]["id"]
    result = client.post(
        "/api/ml/anomalies",
        json={"transaction_ids": [transaction_id]},
        headers=origin,
    )
    assert result.status_code == 200, result.text
    assert result.json()["analyzed"] == 1
    assert result.json()["results"][0]["source"] == "model"
    reviewed = client.patch(
        f"/api/ml/anomalies/{transaction_id}/review",
        json={"status": "reviewed", "note": "Checked against receipt"},
        headers=origin,
    )
    assert reviewed.status_code == 204
    result = client.post(
        "/api/ml/anomalies", json={"transaction_ids": [transaction_id]}, headers=origin
    )
    assert result.json()["results"][0]["reviewStatus"] == "reviewed"
    monkeypatch.setattr(ml_api, "ANOMALY_ARTIFACT_DIR", tmp_path / "missing")
    unavailable = client.post(
        "/api/ml/anomalies", json={"transaction_ids": [transaction_id]}, headers=origin
    )
    assert unavailable.status_code == 503
    engine.dispose()


def test_wellness_uses_saved_user_data_and_marks_missing_factors():
    client, _, engine = make_financial_client()
    origin = register_and_login(client, "wellness@example.com")
    result = client.get("/api/wellness/score")
    assert result.status_code == 200
    assert result.json()["overall"] is None
    assert result.json()["level"] == "Insufficient data"

    client.put(
        "/api/preferences",
        json={
            "profile": {"name": "Wellness", "email": "wellness@example.com", "monthlyIncome": 50000},
            "settings": {
                "currency": "INR", "theme": "light",
                "notifications": {}, "privacy": {}, "financial": {},
            },
        },
        headers=origin,
    )
    result = client.get("/api/wellness/score")
    assert result.status_code == 200
    data = result.json()
    assert data["overall"] is not None
    assert data["source"] == "calculation"
    components = {item["key"]: item for item in data["components"]}
    assert components["anomaly"]["score"] is None
    assert components["budget"]["score"] is None
    engine.dispose()


def test_budget_recommendation_requires_real_profile_inputs_and_runs_saved_model():
    client, _, engine = make_financial_client()
    origin = register_and_login(client, "budget-model@example.com")
    assert client.get("/api/ml/budget-recommendations").status_code == 422
    client.put(
        "/api/preferences",
        json={
            "profile": {
                "name": "Budget User", "email": "budget-model@example.com", "monthlyIncome": 65000,
                "age": 35, "occupation": "Teacher", "savingsGoal": 10000,
                "financialGoal": "Emergency savings", "creditScore": 720, "totalDebt": 0,
            },
            "settings": {
                "currency": "INR", "theme": "light",
                "notifications": {}, "privacy": {}, "financial": {},
            },
        },
        headers=origin,
    )
    response = client.get("/api/ml/budget-recommendations")
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["source"] == "model"
    assert len(result["recommendations"]) == 10
    assert all(item["recommended"] >= 0 for item in result["recommendations"])
    engine.dispose()


def test_forecast_returns_historical_baseline_for_daily_kpis():
    client, _, engine = make_financial_client()
    origin = register_and_login(client, "forecast@example.com")
    imported = client.post(
        "/api/transactions/import",
        json={"rows": [
            {"key": "early", "date": "2026-06-01T10:00:00", "merchant": "Shop", "description": "Purchase", "amount": 100, "type": "expense", "category": "Shopping"},
            {"key": "late", "date": "2026-10-01T10:00:00", "merchant": "Shop", "description": "Purchase", "amount": 120, "type": "expense", "category": "Shopping"},
        ]},
        headers=origin,
    )
    assert imported.json()["importedRows"] == 2
    response = client.post("/api/ml/forecast", json={"horizonDays": 30}, headers=origin)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "ready"
    assert result["source"] == "calculation"
    assert len(result["points"]) == 30
    assert all(point["predicted"] >= 0 for point in result["points"])
    assert "historical baseline" in result["explanation"]
    engine.dispose()
