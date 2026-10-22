from __future__ import annotations

from datetime import datetime, timedelta, time
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.auth import current_user, get_db
from src.database.financial_models import FinancialBudget, FinancialTransaction, SavingsGoal, UserPreferences
from src.database.models import User
from src.wellness.score_engine import WellnessInput, calculate_wellness_score, WEIGHTS

router = APIRouter(prefix="/api/wellness", tags=["wellness"])


@router.get("/score")
def wellness_score(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    now = datetime.now()
    start = (now - timedelta(days=92)).replace(hour=0, minute=0, second=0, microsecond=0)
    transactions = db.scalars(
        select(FinancialTransaction).where(
            FinancialTransaction.user_id == user.id,
            FinancialTransaction.transaction_date >= start,
            FinancialTransaction.transaction_date <= now,
        )
    ).all()
    pref = db.get(UserPreferences, user.id)
    profile = pref.profile if pref else {}
    goals = db.scalars(select(SavingsGoal).where(SavingsGoal.user_id == user.id)).all()
    budgets = db.scalars(select(FinancialBudget).where(FinancialBudget.user_id == user.id)).all()

    incomes = sum((Decimal(row.amount) for row in transactions if row.transaction_type == "income"), Decimal(0))
    expenses = sum((Decimal(row.amount) for row in transactions if row.transaction_type == "expense"), Decimal(0))
    declared_income = Decimal(str(profile.get("monthlyIncome") or 0))
    monthly_income = float(declared_income if declared_income > 0 else incomes / Decimal(3))
    monthly_expenses = float(expenses / Decimal(3))
    if monthly_income <= 0:
        return {
            "overall": None,
            "level": "Insufficient data",
            "components": [],
            "factors": [],
            "recommendations": [],
            "source": "calculation",
            "message": "Add monthly income or income transactions to calculate wellness.",
        }

    emergency = next((goal for goal in goals if goal.goal_type == "emergency"), None)
    total_debt = profile.get("totalDebt")
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    current_category_spend: dict[str, Decimal] = {}
    for row in transactions:
        if row.transaction_type == "expense" and row.transaction_date >= current_month_start:
            current_category_spend[row.category] = current_category_spend.get(row.category, Decimal(0)) + Decimal(row.amount)
    budget_limit_map = {row.category: Decimal(row.monthly_limit) for row in budgets if Decimal(row.monthly_limit) > 0}
    adherence = (
        100.0 * sum(current_category_spend.get(category, Decimal(0)) <= limit for category, limit in budget_limit_map.items()) / len(budget_limit_map)
        if budget_limit_map else None
    )
    essentials = {"Housing", "Groceries", "Healthcare", "Utilities", "Education", "Transportation"}
    essential_monthly = sum(
        (Decimal(row.amount) for row in transactions if row.transaction_type == "expense" and row.category in essentials),
        Decimal(0),
    ) / Decimal(3)

    result = calculate_wellness_score(
        WellnessInput(
            monthly_income=monthly_income,
            monthly_expense=monthly_expenses,
            savings_goal=float(emergency.target_amount) if emergency else 0,
            current_savings=float(emergency.current_amount) if emergency else 0,
            total_debt=float(total_debt or 0),
            essential_expense=float(essential_monthly),
            budget_adherence_pct=adherence,
            anomaly_count=0,
        )
    )
    missing = set()
    if adherence is None:
        missing.add("budget")
    if total_debt is None:
        missing.add("debt")
    if emergency is None:
        missing.update({"emergency", "goal"})
    # Anomaly analysis is opt-in on the alert page; do not imply that zero means none exist.
    missing.add("anomaly")
    components = []
    included_weight = 0.0
    weighted_score = 0.0
    labels = {"savings": "Savings rate", "expense": "Expense ratio", "budget": "Budget adherence", "debt": "Debt", "emergency": "Emergency fund", "goal": "Savings goals", "anomaly": "Anomaly review"}
    for key, breakdown in result.component_breakdown.items():
        unavailable = key in missing
        score = None if unavailable else float(breakdown["score"])
        weight = float(breakdown["weight"])
        if score is not None:
            included_weight += weight
            weighted_score += score * weight
        detail = "Not provided" if unavailable else f"Score {score:.0f}/100 from your saved financial records."
        if key == "savings" and declared_income <= 0:
            detail += " Monthly income is estimated from the last three months of saved income transactions."
        components.append({"key": key, "label": labels.get(key, key.title()), "score": score, "weight": weight, "detail": detail})

    overall = round(weighted_score / included_weight, 1) if included_weight else None
    level = "Insufficient data" if overall is None else "Excellent" if overall >= 90 else "Good" if overall >= 75 else "Fair" if overall >= 60 else "Needs attention"
    scored = [(item["label"], item["score"]) for item in components if item["score"] is not None]
    factors = [
        {"label": label, "impact": "positive" if score >= 80 else "negative", "detail": f"Calculated component score: {score:.0f}/100."}
        for label, score in scored if score >= 80 or score < 60
    ]
    recommendations = []
    for text in result.recommendations:
        if "budget" in missing and "budget" in text.lower():
            continue
        recommendations.append({"title": text.split(".")[0], "detail": text, "impact": "medium"})
    return {
        "overall": overall,
        "level": level,
        "components": components,
        "factors": factors,
        "recommendations": recommendations,
        "source": "calculation",
        "period": {"start": start.date().isoformat(), "end": now.date().isoformat(), "months": 3},
    }
