from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, TypeAdapter, ValidationError, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.api.auth import current_user, get_db
from src.database.financial_models import FinancialBudget, FinancialTransaction, SavingsGoal, UserPreferences
from src.database.models import User

router = APIRouter(prefix="/api", tags=["financial planning"])
EXPENSE_CATEGORIES = {
    "Housing", "Groceries", "Transportation", "Dining", "Shopping", "Healthcare",
    "Utilities", "Entertainment", "Education", "Other",
}
GOAL_TYPES = {"emergency", "gadget", "education", "travel", "savings", "other"}
DEFAULT_SETTINGS = {
    "currency": "INR", "theme": "light",
    "notifications": {"anomalyAlerts": False, "budgetAlerts": False, "weeklySummary": False, "goalReminders": False},
    "privacy": {"persistLocally": True, "shareAnonymized": False},
    "financial": {"monthStartDay": 1, "lowConfidenceThreshold": 0.7},
}


class BudgetInput(BaseModel):
    monthlyLimit: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class BudgetOutput(BaseModel):
    category: str
    monthlyLimit: float
    spent: float
    remaining: float
    percentUsed: float


class GoalInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=2, max_length=50)
    type: str = Field(alias="type")
    targetAmount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currentAmount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    targetDate: date
    completed: bool = False

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least two characters")
        return value

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        if value not in GOAL_TYPES:
            raise ValueError("Choose a supported goal type")
        return value

    @field_validator("targetDate")
    @classmethod
    def future_deadline(cls, value: date) -> date:
        if value <= date.today():
            raise ValueError("Target date must be in the future")
        return value

    @model_validator(mode="after")
    def current_not_over_target(self):
        if self.currentAmount > self.targetAmount:
            raise ValueError("Current amount cannot exceed target amount")
        if self.completed and self.currentAmount < self.targetAmount:
            raise ValueError("Completed goals must have reached their target")
        return self


class GoalOutput(BaseModel):
    id: str
    name: str
    type: str
    targetAmount: float
    currentAmount: float
    targetDate: str
    completed: bool
    createdAt: str


class PreferenceInput(BaseModel):
    profile: dict[str, Any] = Field(max_length=30)
    settings: dict[str, Any]


def _budget_output(db: Session, user_id: int, budget: FinancialBudget) -> BudgetOutput:
    now = datetime.now()
    start = datetime.combine(now.date().replace(day=1), time.min)
    spent = db.scalar(
        select(func.coalesce(func.sum(FinancialTransaction.amount), 0)).where(
            FinancialTransaction.user_id == user_id,
            FinancialTransaction.category == budget.category,
            FinancialTransaction.transaction_type == "expense",
            FinancialTransaction.transaction_date >= start,
        )
    ) or Decimal("0")
    limit = Decimal(budget.monthly_limit)
    used = Decimal(spent)
    return BudgetOutput(
        category=budget.category,
        monthlyLimit=float(limit),
        spent=float(used),
        remaining=float(limit - used),
        percentUsed=float(used / limit) if limit else (1.0 if used else 0.0),
    )


def _goal_output(goal: SavingsGoal) -> GoalOutput:
    return GoalOutput(
        id=str(goal.id), name=goal.name, type=goal.goal_type,
        targetAmount=float(goal.target_amount), currentAmount=float(goal.current_amount),
        targetDate=goal.target_date.isoformat(), completed=goal.completed,
        createdAt=goal.created_at.date().isoformat(),
    )


@router.get("/budgets", response_model=list[BudgetOutput])
def list_budgets(user: User = Depends(current_user), db: Session = Depends(get_db)):
    budgets = db.scalars(select(FinancialBudget).where(FinancialBudget.user_id == user.id)).all()
    return [_budget_output(db, user.id, item) for item in budgets]


@router.put("/budgets/{category}", response_model=BudgetOutput)
def put_budget(category: str, payload: BudgetInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=422, detail="Choose a supported expense category")
    row = db.scalar(select(FinancialBudget).where(FinancialBudget.user_id == user.id, FinancialBudget.category == category))
    if row is None:
        row = FinancialBudget(user_id=user.id, category=category, monthly_limit=payload.monthlyLimit)
        db.add(row)
    else:
        row.monthly_limit = payload.monthlyLimit
    db.commit()
    db.refresh(row)
    return _budget_output(db, user.id, row)


@router.delete("/budgets/{category}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(category: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(FinancialBudget).where(FinancialBudget.user_id == user.id, FinancialBudget.category == category))
    if row is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(row)
    db.commit()


@router.get("/goals", response_model=list[GoalOutput])
def list_goals(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [_goal_output(goal) for goal in db.scalars(select(SavingsGoal).where(SavingsGoal.user_id == user.id).order_by(SavingsGoal.created_at.desc())).all()]


def _apply_goal(row: SavingsGoal, payload: GoalInput) -> None:
    row.name = payload.name
    row.goal_type = payload.type
    row.target_amount = payload.targetAmount
    row.current_amount = payload.currentAmount
    row.target_date = payload.targetDate
    row.completed = payload.completed


@router.post("/goals", response_model=GoalOutput, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = SavingsGoal(user_id=user.id)
    _apply_goal(row, payload)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _goal_output(row)


@router.patch("/goals/{goal_id}", response_model=GoalOutput)
def update_goal(goal_id: int, payload: GoalInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id))
    if row is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    _apply_goal(row, payload)
    db.commit()
    db.refresh(row)
    return _goal_output(row)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id))
    if row is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(row)
    db.commit()


@router.get("/preferences")
def get_preferences(user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(UserPreferences, user.id)
    profile = dict(row.profile) if row else {}
    profile.setdefault("name", user.username)
    profile.setdefault("email", user.email)
    profile.setdefault("monthlyIncome", 0)
    return {"profile": profile, "settings": row.settings if row else DEFAULT_SETTINGS}


@router.put("/preferences")
def put_preferences(payload: PreferenceInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = payload.profile
    name = profile.get("name", user.username)
    if not isinstance(name, str) or not 2 <= len(name.strip()) <= 100:
        raise HTTPException(status_code=422, detail="Name must contain between 2 and 100 characters")
    income = profile.get("monthlyIncome", 0)
    if not isinstance(income, (int, float)) or income < 0:
        raise HTTPException(status_code=422, detail="Monthly income must be non-negative")
    email = profile.get("email", user.email)
    try:
        email = str(TypeAdapter(EmailStr).validate_python(email)).lower()
    except ValidationError:
        raise HTTPException(status_code=422, detail="Enter a valid email address") from None
    settings = payload.settings
    if settings.get("currency") not in {"INR", "USD", "EUR"} or settings.get("theme") not in {"light", "dark"}:
        raise HTTPException(status_code=422, detail="Invalid currency or theme preference")
    if not isinstance(settings.get("notifications"), dict) or not isinstance(settings.get("privacy"), dict) or not isinstance(settings.get("financial"), dict):
        raise HTTPException(status_code=422, detail="Settings structure is invalid")
    row = db.get(UserPreferences, user.id)
    profile = {**profile, "email": email, "name": name.strip()}
    if row is None:
        row = UserPreferences(user_id=user.id, profile=profile, settings=settings)
        db.add(row)
    else:
        row.profile = profile
        row.settings = settings
    user.username = name.strip()
    user.email = email
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Preference update conflicted; retry") from None
    return {"profile": row.profile, "settings": row.settings}
