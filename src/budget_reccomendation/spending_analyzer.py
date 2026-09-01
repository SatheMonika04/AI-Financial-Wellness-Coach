import os
import pandas as pd
import numpy as np


# ============================================================
# CONFIGURATION
# ============================================================

INPUT_PATH = (
    "data/processed/"
    "transactions_with_users.csv"
)

OUTPUT_PATH = (
    "data/processed/"
    "monthly_financial_metrics.csv"
)


# ============================================================
# CREATE OUTPUT DIRECTORY
# ============================================================

os.makedirs(
    "data/processed",
    exist_ok=True
)


# ============================================================
# LOAD TRANSACTION DATA
# ============================================================

print("\nLoading transaction data...")

df = pd.read_csv(INPUT_PATH)

print(
    f"Loaded {len(df):,} transactions."
)


# ============================================================
# VALIDATE REQUIRED COLUMNS
# ============================================================

required_columns = [
    "user_id",
    "transaction_date",
    "amount",
    "transaction_type"
]

missing_columns = [
    column
    for column in required_columns
    if column not in df.columns
]

if missing_columns:

    raise ValueError(
        "Missing required columns: "
        + str(missing_columns)
    )


# ============================================================
# DATA TYPE CONVERSION
# ============================================================

df["transaction_date"] = pd.to_datetime(
    df["transaction_date"],
    errors="coerce"
)

df["amount"] = pd.to_numeric(
    df["amount"],
    errors="coerce"
)


# ============================================================
# CHECK INVALID VALUES
# ============================================================

if df["transaction_date"].isna().any():

    raise ValueError(
        "Invalid transaction dates found."
    )


if df["amount"].isna().any():

    raise ValueError(
        "Invalid transaction amounts found."
    )


# ============================================================
# NORMALIZE TRANSACTION TYPE
# ============================================================

df["transaction_type"] = (
    df["transaction_type"]
    .astype(str)
    .str.strip()
    .str.title()
)


# ============================================================
# CHECK USER IDs
# ============================================================

if df["user_id"].isna().any():

    raise ValueError(
        "Transactions with missing user_id detected."
    )


print(
    f"Unique users: {df['user_id'].nunique()}"
)


# ============================================================
# CREATE YEAR-MONTH
# ============================================================

df["month"] = (
    df["transaction_date"]
    .dt.to_period("M")
    .astype(str)
)


# ============================================================
# IDENTIFY INCOME AND EXPENSE TRANSACTIONS
# ============================================================

"""
Project rule:

Credit → Income
Debit  → Expense

We calculate income and expenses from the transaction
records rather than copying values from user_profiles.csv.
"""

df["income_amount"] = np.where(
    df["transaction_type"].eq("Credit"),
    df["amount"],
    0
)


df["expense_amount"] = np.where(
    df["transaction_type"].eq("Debit"),
    df["amount"],
    0
)


# ============================================================
# CALCULATE MONTHLY METRICS
# ============================================================

monthly_metrics = (
    df
    .groupby(
        [
            "user_id",
            "month"
        ],
        as_index=False
    )
    .agg(
        total_income=(
            "income_amount",
            "sum"
        ),
        total_expense=(
            "expense_amount",
            "sum"
        )
    )
)


# ============================================================
# CALCULATE SAVINGS
# ============================================================

monthly_metrics["total_savings"] = (
    monthly_metrics["total_income"]
    -
    monthly_metrics["total_expense"]
)


# ============================================================
# CALCULATE SAVINGS RATE
# ============================================================

monthly_metrics["savings_rate"] = np.where(

    monthly_metrics["total_income"] > 0,

    (
        monthly_metrics["total_savings"]
        /
        monthly_metrics["total_income"]
    ) * 100,

    0
)


# ============================================================
# ROUND FINANCIAL VALUES
# ============================================================

monthly_metrics["total_income"] = (
    monthly_metrics["total_income"]
    .round(2)
)

monthly_metrics["total_expense"] = (
    monthly_metrics["total_expense"]
    .round(2)
)

monthly_metrics["total_savings"] = (
    monthly_metrics["total_savings"]
    .round(2)
)

monthly_metrics["savings_rate"] = (
    monthly_metrics["savings_rate"]
    .round(2)
)


# ============================================================
# SORT DATA
# ============================================================

monthly_metrics = (
    monthly_metrics
    .sort_values(
        by=[
            "user_id",
            "month"
        ]
    )
    .reset_index(drop=True)
)


# ============================================================
# VALIDATE OUTPUT
# ============================================================

expected_columns = [
    "user_id",
    "month",
    "total_income",
    "total_expense",
    "total_savings",
    "savings_rate"
]


if (
    monthly_metrics.columns.tolist()
    != expected_columns
):

    raise ValueError(
        "Output columns do not match expected structure."
    )


# ============================================================
# CHECK SAVINGS CALCULATION
# ============================================================

calculated_savings = (
    monthly_metrics["total_income"]
    -
    monthly_metrics["total_expense"]
)


if not np.allclose(
    monthly_metrics["total_savings"],
    calculated_savings,
    atol=0.01
):

    raise ValueError(
        "Savings calculation validation failed."
    )


# ============================================================
# CHECK SAVINGS RATE CALCULATION
# ============================================================

income_mask = (
    monthly_metrics["total_income"] > 0
)


calculated_rate = (
    monthly_metrics.loc[
        income_mask,
        "total_savings"
    ]
    /
    monthly_metrics.loc[
        income_mask,
        "total_income"
    ]
) * 100


if not np.allclose(
    monthly_metrics.loc[
        income_mask,
        "savings_rate"
    ],
    calculated_rate,
    atol=0.02
):

    raise ValueError(
        "Savings rate calculation validation failed."
    )


# ============================================================
# DISPLAY RESULTS
# ============================================================

print(
    "\nMonthly financial metrics:"
)

print(
    monthly_metrics.head(20).to_string(
        index=False
    )
)


# ============================================================
# SUMMARY STATISTICS
# ============================================================

print("\nSummary:")

print(
    f"Number of users: "
    f"{monthly_metrics['user_id'].nunique()}"
)

print(
    f"Number of user-month records: "
    f"{len(monthly_metrics):,}"
)

print(
    f"Average monthly income: "
    f"₹{monthly_metrics['total_income'].mean():,.2f}"
)

print(
    f"Average monthly expense: "
    f"₹{monthly_metrics['total_expense'].mean():,.2f}"
)

print(
    f"Average monthly savings: "
    f"₹{monthly_metrics['total_savings'].mean():,.2f}"
)

print(
    f"Average savings rate: "
    f"{monthly_metrics['savings_rate'].mean():.2f}%"
)


# ============================================================
# SAVE OUTPUT
# ============================================================

monthly_metrics.to_csv(
    OUTPUT_PATH,
    index=False
)


print(
    "\nMonthly metrics saved successfully:"
)

print(
    OUTPUT_PATH
)


# ============================================================
# FINAL VALIDATION
# ============================================================

saved_df = pd.read_csv(
    OUTPUT_PATH
)

if len(saved_df) != len(monthly_metrics):

    raise ValueError(
        "Saved file row count does not match "
        "calculated data."
    )


print("\n" + "=" * 60)

print(
    "STEP 2 COMPLETED SUCCESSFULLY"
)

print("=" * 60)

print(
    f"Transactions analyzed : {len(df):,}"
)

print(
    f"Users analyzed        : "
    f"{df['user_id'].nunique()}"
)

print(
    f"User-month records    : "
    f"{len(monthly_metrics):,}"
)

print(
    f"Output                : "
    f"{OUTPUT_PATH}"
)

print("=" * 60)