import pandas as pd
import numpy as np
from pathlib import Path


# ============================================================
# PATHS
# ============================================================

INPUT_PATH = Path(
    "data/processed/budget_recommendation_dataset.csv"
)

OUTPUT_PATH = Path(
    "data/processed/budget_recommendation_dataset_with_target.csv"
)


# ============================================================
# LOAD DATA
# ============================================================

print("\nLoading budget recommendation dataset...")

df = pd.read_csv(INPUT_PATH)

print(f"Loaded {len(df):,} rows.")
print(f"Columns: {df.columns.tolist()}")


# ============================================================
# VALIDATE REQUIRED COLUMNS
# ============================================================

required_columns = [
    "user_id",
    "month",
    "category",
    "monthly_category_spending",
    "total_expense",
    "income_for_budget",
    "savings_goal",
    "estimated_savings",
    "category_spending_ratio",
    "profile_monthly_expense"
]

missing_columns = [
    col for col in required_columns
    if col not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Missing required columns: {missing_columns}"
    )

print("\nRequired columns validated.")


# ============================================================
# CLEAN NUMERIC COLUMNS
# ============================================================

numeric_columns = [
    "monthly_category_spending",
    "total_expense",
    "income_for_budget",
    "savings_goal",
    "estimated_savings",
    "category_spending_ratio",
    "profile_monthly_expense"
]

for col in numeric_columns:
    df[col] = pd.to_numeric(
        df[col],
        errors="coerce"
    )

df[numeric_columns] = df[numeric_columns].fillna(0)


# ============================================================
# CREATE HISTORICAL CATEGORY SPENDING
# ============================================================

print("\nCalculating historical category spending...")

historical_category_spending = (
    df.groupby(
        ["user_id", "category"],
        as_index=False
    )["monthly_category_spending"]
    .mean()
    .rename(
        columns={
            "monthly_category_spending":
            "historical_category_avg"
        }
    )
)

df = df.merge(
    historical_category_spending,
    on=["user_id", "category"],
    how="left"
)


# ============================================================
# CREATE BASE BUDGET
# ============================================================

print("\nCreating base budget...")


# Use the user's profile expense as the maximum
# overall monthly expense capacity.

df["expense_capacity"] = (
    df["profile_monthly_expense"]
)


# Category budget is based on historical spending.
df["base_category_budget"] = (
    df["historical_category_avg"]
)


# ============================================================
# SAVINGS ADJUSTMENT
# ============================================================

print("Applying savings adjustment...")


# If estimated savings is positive,
# slightly reduce discretionary budget.

df["savings_adjustment_factor"] = np.where(
    df["estimated_savings"] > 0,
    0.90,
    1.00
)


df["adjusted_category_budget"] = (
    df["base_category_budget"]
    * df["savings_adjustment_factor"]
)


# ============================================================
# FINAL TARGET
# ============================================================

df["recommended_budget"] = (
    df["adjusted_category_budget"]
)


# ============================================================
# SAFETY LIMITS
# ============================================================

# Budget cannot be negative.
df["recommended_budget"] = (
    df["recommended_budget"]
    .clip(lower=0)
)


# Budget should not exceed the user's
# profile monthly expense.

df["recommended_budget"] = np.minimum(
    df["recommended_budget"],
    df["profile_monthly_expense"]
)


# ============================================================
# ROUND TARGET
# ============================================================

df["recommended_budget"] = (
    df["recommended_budget"]
    .round(2)
)


# ============================================================
# VALIDATION
# ============================================================

print("\n============================================================")
print("TARGET VALIDATION")
print("============================================================")

print(
    "Target column:",
    "recommended_budget"
)

print(
    "Missing targets:",
    df["recommended_budget"].isna().sum()
)

print(
    "Negative targets:",
    (df["recommended_budget"] < 0).sum()
)

print(
    "Minimum target:",
    df["recommended_budget"].min()
)

print(
    "Maximum target:",
    df["recommended_budget"].max()
)

print(
    "Average target:",
    df["recommended_budget"].mean()
)


# ============================================================
# SAVE DATASET
# ============================================================

df.to_csv(
    OUTPUT_PATH,
    index=False
)

print("\nDataset saved:")
print(OUTPUT_PATH)

print("\nFinal shape:")
print(df.shape)

print("\nFinal columns:")
print(df.columns.tolist())

print("\nFirst 10 target values:")
print(
    df[
        [
            "user_id",
            "month",
            "category",
            "income_for_budget",
            "monthly_category_spending",
            "recommended_budget"
        ]
    ].head(10).to_string(index=False)
)

print("\n============================================================")
print("TARGET CREATION COMPLETED SUCCESSFULLY")
print("============================================================")