import json
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Literal

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.auth import current_user, get_db
from src.database.models import User
from src.database.financial_models import FinancialAnomalyReview, FinancialBudget, FinancialTransaction, UserPreferences
from src.anomaly.pipeline import predict_anomalies
from src.Forecating.spending_forecasting_pipeline import MIN_DAYS_NEEDED
from src.Expense_Categorization.expense_categorization_pipeline_v2 import categorize_dataframe

router = APIRouter(prefix="/api/ml", tags=["machine learning"])
MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "expense_classifier_pipeline_v6.pkl"
CATEGORIES = {
    "Bills": "Utilities", "Entertainment": "Entertainment", "Food": "Dining",
    "Fuel": "Transportation", "Groceries": "Groceries", "Healthcare": "Healthcare",
    "Insurance": "Other", "Miscellaneous": "Other", "Other": "Other",
    "Personal Transfer": "Other", "Rent": "Housing", "Salary": "Income",
    "Shopping": "Shopping", "Subscription": "Entertainment", "Transport": "Transportation",
    "Travel": "Other", "Investment": "Other",
}
REVIEW_LABELS = {"Insurance", "Miscellaneous", "Personal Transfer", "Travel", "Investment"}
ANOMALY_ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "anomaly" / "artifacts"
BUDGET_MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "budget_recommendation_model.pkl"


class CategorizationItem(BaseModel):
    description: str = Field(max_length=2000)
    amount: float = Field(gt=0, le=1_000_000_000)
    type: Literal["income", "expense"]
    paymentMethod: str | None = Field(default=None, max_length=40)


class CategorizationRequest(BaseModel):
    items: list[CategorizationItem] = Field(min_length=1, max_length=1000)


class CategoryPrediction(BaseModel):
    predictedCategory: str
    confidence: float
    needsReview: bool


class AnomalyRunRequest(BaseModel):
    transaction_ids: list[str] = Field(min_length=1, max_length=500)


class AnomalyResult(BaseModel):
    id: str
    flagged: bool
    score: float
    threshold: float
    severity: Literal["low", "medium", "high"]
    reasons: list[str]
    reviewStatus: Literal["new", "reviewed", "dismissed"]
    reviewHistory: list[dict]
    detectedAt: str
    source: Literal["model"]


class AnomalyRunResponse(BaseModel):
    analyzed: int
    flagged: int
    ranAt: str
    source: Literal["model"]
    results: list[AnomalyResult]


class AnomalyReviewInput(BaseModel):
    status: Literal["reviewed", "dismissed"]
    note: str | None = Field(default=None, max_length=500)


class ForecastRequest(BaseModel):
    horizonDays: int = Field(default=30, ge=1, le=90)


@lru_cache(maxsize=2)
def _load_budget_model(path: str):
    import joblib

    return joblib.load(path)


@router.post("/categorize", response_model=list[CategoryPrediction])
def categorize(
    payload: CategorizationRequest,
    _user: User = Depends(current_user),
    _db: Session = Depends(get_db),
) -> list[CategoryPrediction]:
    if not MODEL_PATH.is_file():
        raise HTTPException(status_code=503, detail="Expense categorization model artifact is unavailable")
    data = pd.DataFrame(
        [
            {
                "description": item.description,
                "amount": item.amount,
                "transaction_type": "Credit" if item.type == "income" else "Debit",
                "payment_method": item.paymentMethod or "Unknown",
            }
            for item in payload.items
        ]
    )
    try:
        result = categorize_dataframe(data, model_path=MODEL_PATH)
    except (FileNotFoundError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=503, detail=f"Categorization is unavailable: {exc}") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Categorization model could not process this request") from None

    predictions: list[CategoryPrediction] = []
    for _, row in result.iterrows():
        label = str(row.get("model_prediction", row["predicted_category"]))
        confidence = float(row.get("category_confidence", 0.0))
        predictions.append(
            CategoryPrediction(
                predictedCategory=CATEGORIES.get(label, "Other"),
                confidence=confidence,
                needsReview=confidence < 0.6 or label in REVIEW_LABELS or label not in CATEGORIES,
            )
        )
    return predictions


@router.post("/anomalies", response_model=AnomalyRunResponse)
def detect_anomalies(
    payload: AnomalyRunRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> AnomalyRunResponse:
    if any(not value.isdigit() for value in payload.transaction_ids):
        raise HTTPException(status_code=422, detail="Transaction IDs must be numeric")
    try:
        transactions = db.scalars(
            select(FinancialTransaction).where(
                FinancialTransaction.user_id == user.id,
                FinancialTransaction.id.in_([int(value) for value in payload.transaction_ids]),
            ).order_by(FinancialTransaction.transaction_date.asc())
        ).all()
    except ValueError:
        raise HTTPException(status_code=422, detail="Transaction IDs must be numeric") from None
    if not transactions:
        return AnomalyRunResponse(analyzed=0, flagged=0, ranAt=datetime.utcnow().isoformat(), source="model", results=[])
    frame = pd.DataFrame(
        [
            {
                "transaction_id": str(row.id),
                "transaction_date": row.transaction_date.date().isoformat(),
                "transaction_time": row.transaction_date.time().isoformat(timespec="seconds"),
                "merchant": row.merchant,
                "description": row.description,
                "amount": float(row.amount),
                "category": row.category,
                "payment_method": row.payment_method or "Unknown",
            }
            for row in transactions
        ]
    )
    try:
        predicted = predict_anomalies(frame, artifact_dir=ANOMALY_ARTIFACT_DIR)
        threshold = float(json.loads((ANOMALY_ARTIFACT_DIR / "threshold.json").read_text(encoding="utf-8"))["threshold"])
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Anomaly detection model artifacts are unavailable") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Anomaly detection could not process these transactions") from None
    reviews = {
        str(review.transaction_id): review
        for review in db.scalars(
            select(FinancialAnomalyReview).where(
                FinancialAnomalyReview.user_id == user.id,
                FinancialAnomalyReview.transaction_id.in_([row.id for row in transactions]),
            )
        ).all()
    }
    results: list[AnomalyResult] = []
    for _, prediction in predicted.iterrows():
        tx_id = str(prediction["transaction_id"])
        score = float(prediction["anomaly_score"])
        flagged = prediction["anomaly_label"] == "Unusual Transaction"
        ratio = score / threshold if threshold > 0 else 0.0
        severity: Literal["low", "medium", "high"] = "high" if ratio >= 2 else "medium" if ratio >= 1.25 else "low"
        review = reviews.get(tx_id)
        history = []
        if review:
            history = [{"at": review.updated_at.isoformat(timespec="minutes"), "action": review.review_status, "note": review.note}]
        results.append(
            AnomalyResult(
                id=tx_id, flagged=flagged, score=score, threshold=threshold, severity=severity,
                reasons=[str(prediction["anomaly_explanation"])] if flagged else [],
                reviewStatus=review.review_status if review else "new", reviewHistory=history,
                detectedAt=datetime.utcnow().isoformat(timespec="minutes"), source="model",
            )
        )
    return AnomalyRunResponse(
        analyzed=len(results), flagged=sum(item.flagged for item in results),
        ranAt=datetime.utcnow().isoformat(timespec="seconds"), source="model", results=results,
    )


@router.patch("/anomalies/{transaction_id}/review", status_code=204)
def update_anomaly_review(
    transaction_id: int,
    payload: AnomalyReviewInput,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    transaction = db.scalar(
        select(FinancialTransaction).where(
            FinancialTransaction.id == transaction_id,
            FinancialTransaction.user_id == user.id,
        )
    )
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    row = db.scalar(
        select(FinancialAnomalyReview).where(
            FinancialAnomalyReview.user_id == user.id,
            FinancialAnomalyReview.transaction_id == transaction_id,
        )
    )
    if row is None:
        row = FinancialAnomalyReview(user_id=user.id, transaction_id=transaction_id, review_status=payload.status, note=payload.note)
        db.add(row)
    else:
        row.review_status = payload.status
        row.note = payload.note
    db.commit()


@router.post("/forecast")
def forecast(
    payload: ForecastRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    today = date.today()
    rows = db.scalars(
        select(FinancialTransaction).where(
            FinancialTransaction.user_id == user.id,
            FinancialTransaction.transaction_type == "expense",
            FinancialTransaction.transaction_date <= datetime.combine(today, time.max),
        ).order_by(FinancialTransaction.transaction_date.asc())
    ).all()
    generated = datetime.utcnow().isoformat(timespec="seconds")
    dates = [row.transaction_date.date() for row in rows]
    history_days = (max(dates) - min(dates)).days + 1 if dates else 0
    common = {
        "source": "calculation",
        "generatedAt": generated,
        "horizonDays": payload.horizonDays,
        "minHistoryDays": MIN_DAYS_NEEDED,
        "history": {"start": min(dates).isoformat() if dates else None, "end": max(dates).isoformat() if dates else None, "days": history_days},
        "points": [],
        "featuresUsed": ["56-day daily expense history", "weekday averages", "overall daily average"],
    }
    if history_days < MIN_DAYS_NEEDED:
        return {**common, "status": "insufficient_data", "categoryForecasts": [], "explanation": f"At least {MIN_DAYS_NEEDED} calendar days of expense history are required."}
    if max(dates) < today - timedelta(days=30):
        return {
            **common,
            "status": "insufficient_data",
            "categoryForecasts": [],
            "explanation": "Recent expense activity is needed; the latest recorded expense is more than 30 days old.",
        }

    # The available serialized model predicts a centered smoothed historical target,
    # not future daily spending. Use a transparent weekday baseline until a suitable
    # future-horizon model is trained, rather than labeling its output as a forecast.
    window_start = today - timedelta(days=55)
    daily_spending = {window_start + timedelta(days=offset): 0.0 for offset in range(56)}
    category_spending: dict[str, float] = {}
    for row in rows:
        transaction_day = row.transaction_date.date()
        if transaction_day in daily_spending:
            daily_spending[transaction_day] += float(row.amount)
        if transaction_day >= today - timedelta(days=29):
            category_spending[row.category] = category_spending.get(row.category, 0.0) + float(row.amount)

    daily_values = list(daily_spending.values())
    overall_average = sum(daily_values) / len(daily_values)
    weekday_values = {
        weekday: [amount for day, amount in daily_spending.items() if day.weekday() == weekday]
        for weekday in range(7)
    }

    def predict_day(day: date) -> float:
        weekday_history = weekday_values[day.weekday()]
        weekday_average = sum(weekday_history) / len(weekday_history)
        # Blend weekday behavior with the overall baseline to reduce noisy spikes.
        return round(max(0.0, 0.7 * weekday_average + 0.3 * overall_average), 2)

    points = [
        {"date": (today + timedelta(days=offset)).isoformat(), "predicted": predict_day(today + timedelta(days=offset))}
        for offset in range(1, payload.horizonDays + 1)
    ]
    next_30_total = sum(predict_day(today + timedelta(days=offset)) for offset in range(1, 31))
    category_total = sum(category_spending.values())
    category_forecasts = [
        {
            "category": category,
            "last30": round(amount, 2),
            "next30": round(next_30_total * amount / category_total, 2) if category_total else 0.0,
        }
        for category, amount in sorted(category_spending.items())
    ]
    return {
        **common,
        "status": "ready",
        "points": points,
        "categoryForecasts": category_forecasts,
        "explanation": "Projection uses the last 56 calendar days, blending each weekday's average with the overall daily average. Category projections use the last 30 days' spending mix. This is a historical baseline, not an ML model prediction.",
    }


@router.get("/budget-recommendations")
def budget_recommendations(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    if not BUDGET_MODEL_PATH.is_file():
        raise HTTPException(status_code=503, detail="Budget recommendation model artifact is unavailable")
    preference = db.get(UserPreferences, user.id)
    profile = preference.profile if preference else {}
    required = ("age", "occupation", "savingsGoal", "financialGoal", "creditScore", "totalDebt")
    missing = [key for key in required if profile.get(key) is None or profile.get(key) == ""]
    if missing:
        raise HTTPException(status_code=422, detail=f"Complete these profile fields before requesting model recommendations: {', '.join(missing)}")
    txs = db.scalars(
        select(FinancialTransaction).where(
            FinancialTransaction.user_id == user.id,
            FinancialTransaction.transaction_date >= datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=92),
        )
    ).all()
    months = 3
    category_totals: dict[str, float] = {}
    for row in txs:
        if row.transaction_type == "expense":
            category_totals[row.category] = category_totals.get(row.category, 0.0) + float(row.amount)
    monthly_category_spend = {category: amount / months for category, amount in category_totals.items()}
    monthly_expenses = sum(monthly_category_spend.values())
    monthly_income = float(profile.get("monthlyIncome") or 0)
    if monthly_income <= 0:
        income_total = sum(float(row.amount) for row in txs if row.transaction_type == "income")
        monthly_income = income_total / months
    if monthly_income <= 0:
        raise HTTPException(status_code=422, detail="Set monthly income or add income transactions before requesting recommendations")
    monthly_savings_goal = float(profile["savingsGoal"])
    if not isinstance(profile["occupation"], str) or not isinstance(profile["financialGoal"], str):
        raise HTTPException(status_code=422, detail="Occupation and financial goal must be text")
    try:
        age = int(profile["age"])
        credit_score = int(profile["creditScore"])
        total_debt = float(profile["totalDebt"])
        if not 18 <= age <= 120 or credit_score < 0 or total_debt < 0 or monthly_savings_goal < 0:
            raise ValueError
        model = _load_budget_model(str(BUDGET_MODEL_PATH.resolve()))
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Budget recommendation model artifact is unavailable") from None
    except Exception:
        raise HTTPException(status_code=422, detail="Financial profile values are invalid") from None
    import pandas as pd

    category_names = {
        "Housing": "Rent", "Groceries": "Groceries", "Transportation": "Transport",
        "Dining": "Food", "Shopping": "Shopping", "Healthcare": "Healthcare",
        "Utilities": "Bills", "Entertainment": "Entertainment", "Education": "Other", "Other": "Other",
    }
    stored_budgets = {
        row.category: float(row.monthly_limit)
        for row in db.scalars(select(FinancialBudget).where(FinancialBudget.user_id == user.id)).all()
    }
    recommended = []
    occupation = profile["occupation"].strip()
    for category, model_category in category_names.items():
        actual = monthly_category_spend.get(category, 0.0)
        ratio = actual / monthly_income
        features = pd.DataFrame([{
            "monthly_category_spending": actual,
            "income_for_budget": monthly_income,
            "percentage_of_income": ratio * 100,
            "percentage_of_expenses": actual / monthly_expenses * 100 if monthly_expenses else 0,
            "category_spending_ratio": ratio,
            "age": age,
            "occupation": occupation,
            "savings_goal": monthly_savings_goal,
            "financial_goal": profile["financialGoal"],
            "credit_score": credit_score,
            "total_debt": total_debt,
            "debt_to_income_ratio": total_debt / (monthly_income * 12),
            "expense_to_income_ratio": monthly_expenses / monthly_income,
            "category": model_category,
        }])
        try:
            proposed = max(0.0, float(model.predict(features)[0]))
        except Exception:
            raise HTTPException(status_code=503, detail="Budget model could not process the saved profile and transaction data") from None
        recommended.append({
            "category": category,
            "actual": round(actual, 2),
            "current": stored_budgets.get(category, 0.0),
            "recommended": round(proposed, 2),
            "explanation": f"Model estimate uses your three-month average spending of {actual:.2f}, monthly income, saved profile inputs, and the model's training-time category features.",
        })
    return {"recommendations": recommended, "generatedAt": datetime.utcnow().isoformat(timespec="seconds"), "source": "model"}
