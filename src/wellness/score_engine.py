from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any
import pandas as pd
import numpy as np

@dataclass
class WellnessInput:
    monthly_income: float
    monthly_expense: float
    savings_goal: float = 0.0
    current_savings: float = 0.0
    total_debt: float = 0.0
    monthly_debt_payment: float = 0.0
    essential_expense: float = 0.0
    anomaly_count: int = 0
    high_severity_anomalies: int = 0
    medium_severity_anomalies: int = 0
    budget_adherence_pct: float | None = None
    age: int = 30
    financial_goal: str = ""

@dataclass
class WellnessResult:
    overall_score: float
    wellness_level: str
    savings_score: float
    expense_score: float
    budget_score: float
    debt_score: float
    emergency_score: float
    goal_score: float
    anomaly_score: float
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    is_provisional: bool = False
    missing_data: list[str] = field(default_factory=list)
    component_breakdown: dict[str, Any] = field(default_factory=dict)

def _savings_score(savings_rate: float) -> float:
    """savings_rate = (income - expense) / income * 100"""
    if savings_rate < 0:
        return 0.0
    if savings_rate >= 30: return 100.0
    if savings_rate >= 25: return 90.0
    if savings_rate >= 20: return 80.0
    if savings_rate >= 15: return 70.0
    if savings_rate >= 10: return 55.0
    if savings_rate >= 5: return 35.0
    return 15.0

def _expense_score(expense_ratio: float) -> float:
    """expense_ratio = monthly_expense / monthly_income * 100"""
    if expense_ratio <= 50: return 100.0
    if expense_ratio <= 60: return 90.0
    if expense_ratio <= 70: return 75.0
    if expense_ratio <= 80: return 60.0
    if expense_ratio <= 90: return 40.0
    return 20.0

def _budget_score(adherence_pct: float | None) -> tuple[float, bool]:
    if adherence_pct is None:
        return 75.0, True
    if adherence_pct >= 95: return 100.0, False
    if adherence_pct >= 90: return 90.0, False
    if adherence_pct >= 80: return 75.0, False
    if adherence_pct >= 70: return 60.0, False
    if adherence_pct >= 60: return 40.0, False
    return 20.0, False

def _debt_score(monthly_income: float, monthly_debt_payment: float, total_debt: float) -> tuple[float, bool]:
    provisional = False
    if monthly_debt_payment == 0 and total_debt == 0:
        return 100.0, False
    if monthly_debt_payment == 0 and total_debt > 0:
        # Estimate monthly payment as total_debt / 36 (3-year repayment assumption)
        monthly_debt_payment = total_debt / 36
        provisional = True
    if monthly_income <= 0:
        return 50.0, provisional
    dti = (monthly_debt_payment / monthly_income) * 100
    if dti <= 10: base = 100.0
    elif dti <= 15: base = 90.0
    elif dti <= 20: base = 80.0
    elif dti <= 35: base = 65.0
    elif dti <= 50: base = 40.0
    else: base = 20.0
    return min(100.0, max(0.0, base)), provisional

def _emergency_score(current_savings: float, essential_expense: float) -> tuple[float, bool]:
    if essential_expense <= 0:
        return 50.0, True  # provisional — no essential expense data
    months = current_savings / essential_expense
    if months >= 6: return 100.0, False
    if months >= 4: return 85.0, False
    if months >= 3: return 70.0, False
    if months >= 2: return 50.0, False
    if months >= 1: return 30.0, False
    return 10.0, False

def _goal_score(current_savings: float, savings_goal: float) -> float:
    if savings_goal <= 0:
        return 50.0  # neutral
    progress = (current_savings / savings_goal) * 100
    if progress >= 100: return 100.0
    if progress >= 75: return 90.0
    if progress >= 50: return 75.0
    if progress >= 25: return 55.0
    if progress >= 10: return 35.0
    return 15.0

def _anomaly_score_fn(anomaly_count: int, high_sev: int, med_sev: int) -> float:
    if anomaly_count == 0:
        return 100.0
    low_sev = max(0, anomaly_count - high_sev - med_sev)
    risk_index = high_sev * 3.0 + med_sev * 1.5 + low_sev * 0.5
    if risk_index == 0: return 100.0
    if risk_index <= 2: return 90.0
    if risk_index <= 5: return 75.0
    if risk_index <= 10: return 60.0
    if risk_index <= 20: return 40.0
    return 20.0

def _wellness_level(score: float) -> str:
    if score >= 90: return "Excellent"
    if score >= 75: return "Good"
    if score >= 60: return "Fair"
    if score >= 40: return "Needs Improvement"
    return "Critical"

def _generate_recommendations(inp: WellnessInput, scores: dict[str, float]) -> list[str]:
    recs = []
    monthly_income = inp.monthly_income
    monthly_expense = inp.monthly_expense
    
    # Sort by score ascending to prioritize weakest areas
    sorted_components = sorted(scores.items(), key=lambda x: x[1])
    
    for component, score in sorted_components:
        if score >= 70:
            continue
        if component == "savings":
            target_savings = monthly_income * 0.20
            actual_savings = monthly_income - monthly_expense
            shortfall = target_savings - actual_savings
            if shortfall > 0:
                recs.append(f"Increase monthly savings by \u20b9{shortfall:,.0f} to reach a 20% savings rate.")
        elif component == "expense":
            target_expense = monthly_income * 0.70
            excess = monthly_expense - target_expense
            if excess > 0:
                recs.append(f"Reduce discretionary spending by \u20b9{excess:,.0f}/month to bring your expense ratio below 70%.")
        elif component == "budget":
            recs.append("Review your top spending categories — you are consistently exceeding recommended budget allocations.")
        elif component == "debt":
            extra_payment = monthly_income * 0.05
            recs.append(f"Consider paying an extra \u20b9{extra_payment:,.0f}/month toward debt to reduce your debt burden faster.")
        elif component == "emergency":
            target_fund = (inp.essential_expense or monthly_expense * 0.6) * 3
            recs.append(f"Build your emergency fund to at least \u20b9{target_fund:,.0f} (3 months of essential expenses).")
        elif component == "goal":
            if inp.savings_goal > 0 and monthly_income > monthly_expense:
                monthly_saving = monthly_income - monthly_expense
                remaining = max(0, inp.savings_goal - inp.current_savings)
                months_to_goal = remaining / monthly_saving if monthly_saving > 0 else float('inf')
                if months_to_goal < float('inf'):
                    recs.append(f"At your current savings rate, you will reach your goal in approximately {months_to_goal:.0f} months. Consider increasing savings to accelerate progress.")
                else:
                    recs.append("Your current spending exceeds income — you are not making progress toward your financial goal.")
        elif component == "anomaly":
            recs.append(f"{inp.anomaly_count} unusual transaction(s) were detected. Review them in the Upload & Analyze page to ensure accuracy.")
    
    if not recs:
        recs.append("Your financial health is strong. Continue maintaining your current habits.")
    
    return recs[:5]  # Cap at 5 recommendations

WEIGHTS = {
    "savings": 0.20,
    "expense": 0.20,
    "budget": 0.15,
    "debt": 0.15,
    "emergency": 0.10,
    "goal": 0.10,
    "anomaly": 0.10,
}

def calculate_wellness_score(inp: WellnessInput) -> WellnessResult:
    """Calculate the full financial wellness score from a WellnessInput."""
    if inp.monthly_income <= 0:
        raise ValueError("monthly_income must be greater than 0")
    if inp.monthly_expense < 0:
        raise ValueError("monthly_expense cannot be negative")
    
    missing_data = []
    provisional = False
    
    # Derived metrics
    savings_rate = (inp.monthly_income - inp.monthly_expense) / inp.monthly_income * 100
    expense_ratio = inp.monthly_expense / inp.monthly_income * 100
    
    # Component scores
    s_savings = _savings_score(savings_rate)
    s_expense = _expense_score(expense_ratio)
    s_budget, budget_provisional = _budget_score(inp.budget_adherence_pct)
    if budget_provisional:
        missing_data.append("budget_adherence_pct")
        provisional = True
    
    s_debt, debt_provisional = _debt_score(inp.monthly_income, inp.monthly_debt_payment, inp.total_debt)
    if debt_provisional:
        missing_data.append("monthly_debt_payment (estimated from total_debt)")
        provisional = True
    
    s_emergency, emerg_provisional = _emergency_score(inp.current_savings, inp.essential_expense)
    if emerg_provisional:
        missing_data.append("essential_expense")
        provisional = True
    
    s_goal = _goal_score(inp.current_savings, inp.savings_goal)
    if inp.savings_goal == 0:
        missing_data.append("savings_goal")
    
    s_anomaly = _anomaly_score_fn(inp.anomaly_count, inp.high_severity_anomalies, inp.medium_severity_anomalies)
    
    # Weighted final score
    component_scores = {
        "savings": s_savings,
        "expense": s_expense,
        "budget": s_budget,
        "debt": s_debt,
        "emergency": s_emergency,
        "goal": s_goal,
        "anomaly": s_anomaly,
    }
    
    final_score = sum(score * WEIGHTS[name] for name, score in component_scores.items())
    final_score = round(final_score, 1)
    
    # Strengths and weaknesses
    component_labels = {
        "savings": "savings rate",
        "expense": "expense management",
        "budget": "budget adherence",
        "debt": "debt health",
        "emergency": "emergency fund",
        "goal": "goal progress",
        "anomaly": "transaction risk",
    }
    
    strengths = []
    weaknesses = []
    for name, score in component_scores.items():
        label = component_labels[name]
        if score >= 80:
            strengths.append(f"Strong {label} (score: {score:.0f}/100)")
        elif score < 60:
            weaknesses.append(f"Low {label} (score: {score:.0f}/100)")
    
    # Recommendations
    recommendations = _generate_recommendations(inp, component_scores)
    
    # Component breakdown
    breakdown = {
        name: {
            "score": score,
            "weight": WEIGHTS[name],
            "contribution": round(score * WEIGHTS[name], 2),
            "label": component_labels[name],
        }
        for name, score in component_scores.items()
    }
    
    return WellnessResult(
        overall_score=final_score,
        wellness_level=_wellness_level(final_score),
        savings_score=s_savings,
        expense_score=s_expense,
        budget_score=s_budget,
        debt_score=s_debt,
        emergency_score=s_emergency,
        goal_score=s_goal,
        anomaly_score=s_anomaly,
        strengths=strengths,
        weaknesses=weaknesses,
        recommendations=recommendations,
        is_provisional=provisional,
        missing_data=missing_data,
        component_breakdown=breakdown,
    )

def score_from_transactions(
    df: pd.DataFrame,
    monthly_income: float,
    savings_goal: float = 0.0,
    current_savings: float = 0.0,
    total_debt: float = 0.0,
    monthly_debt_payment: float = 0.0,
) -> WellnessResult:
    """Derive a WellnessInput from a transactions DataFrame and score it."""
    ESSENTIAL_CATEGORIES = {
        "Bills & Utilities", "Healthcare", "Groceries", "Insurance",
        "Rent", "Education", "Transport", "Fuel", "Bills",
    }
    
    # Find columns
    type_col = None
    amount_col = None
    cat_col = None
    anomaly_col = None
    
    lower_cols = {c.strip().lower(): c for c in df.columns}
    
    for alias in ["transaction_type", "transaction", "type", "dr/cr"]:
        if alias in lower_cols:
            type_col = lower_cols[alias]
            break
    for alias in ["amount", "transaction amount", "value"]:
        if alias in lower_cols:
            amount_col = lower_cols[alias]
            break
    if "predicted_category" in df.columns:
        cat_col = "predicted_category"
    for alias in ["anomaly_label", "anomaly"]:
        if alias in lower_cols:
            anomaly_col = lower_cols[alias]
            break
    
    monthly_expense = 0.0
    essential_expense = 0.0
    
    if type_col and amount_col:
        type_s = df[type_col].astype(str).str.strip().str.lower()
        amounts = pd.to_numeric(df[amount_col], errors="coerce").fillna(0)
        monthly_expense = float(amounts[type_s.isin({"debit", "dr", "withdrawal"})].sum())
        
        if cat_col:
            essential_mask = df[cat_col].isin(ESSENTIAL_CATEGORIES)
            essential_expense = float(amounts[type_s.isin({"debit", "dr", "withdrawal"}) & essential_mask].sum())
    elif amount_col:
        amounts = pd.to_numeric(df[amount_col], errors="coerce").fillna(0)
        monthly_expense = float(amounts[amounts > 0].sum())
    
    # Anomaly counts
    anomaly_count = 0
    high_sev = 0
    med_sev = 0
    if anomaly_col:
        anomaly_count = int(df[anomaly_col].astype(str).str.contains("Unusual|anomal", case=False, na=False).sum())
    
    # Budget adherence — simple heuristic: % of categories within expected range
    budget_adherence_pct = None
    
    inp = WellnessInput(
        monthly_income=monthly_income,
        monthly_expense=monthly_expense,
        savings_goal=savings_goal,
        current_savings=current_savings,
        total_debt=total_debt,
        monthly_debt_payment=monthly_debt_payment,
        essential_expense=essential_expense,
        anomaly_count=anomaly_count,
        high_severity_anomalies=high_sev,
        medium_severity_anomalies=med_sev,
        budget_adherence_pct=budget_adherence_pct,
    )
    
    return calculate_wellness_score(inp)
