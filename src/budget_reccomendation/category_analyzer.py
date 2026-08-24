"""
category_analyzer.py

STEP 3: Monthly Category-Level Spending

Calculates per user and month:

- spending by category
- percentage of income
- percentage of total expenses

Input:
    data/processed/transactions_with_users.csv

Output:
    data/processed/monthly_category_spending.csv
"""

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
    "monthly_category_spending.csv"
)


# ============================================================
# CATEGORY MAPPING
# ============================================================

"""
Mapping source categories to application categories.

Source categories:
    Bills
    Entertainment
    Food
    Fuel
    Groceries
    Insurance
    Investment
    Miscellaneous
    Other
    Rent
    Salary
    Shopping
    Subscription

Application categories:
    Food
    Groceries
    Transport
    Shopping
    Entertainment
    Bills 
    Healthcare
    Subscriptions
    Other
"""




APPLICATION_CATEGORIES = [
    "Food",
    "Groceries",
    "Transport",
    "Shopping",
    "Entertainment",
    "Bills",
    "Healthcare",
    "Subscriptions",
    "Other"
]

CATEGORY_MAPPING = {
    "Food": "Food",
    "Groceries": "Groceries",
    "Fuel": "Transport",
    "Shopping": "Shopping",
    "Entertainment": "Entertainment",
    "Subscription": "Subscriptions",
    "Bills": "Bills",
    "Rent": "Bills",
    "Insurance": "Other",
    "Investment": "Other",
    "Miscellaneous": "Other",
    "Other": "Other",
    "Healthcare": "Healthcare",
    "Salary": "Salary"
}

# ============================================================
# CREATE OUTPUT DIRECTORY
# ============================================================

os.makedirs(
    "data/processed",
    exist_ok=True
)


# ============================================================
# LOAD DATA
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
    "transaction_type",
    "category"
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
# DATA CLEANING
# ============================================================

df["transaction_date"] = pd.to_datetime(
    df["transaction_date"],
    errors="coerce"
)

df["amount"] = pd.to_numeric(
    df["amount"],
    errors="coerce"
)

df["transaction_type"] = (
    df["transaction_type"]
    .astype(str)
    .str.strip()
    .str.title()
)

df["category"] = (
    df["category"]
    .astype(str)
    .str.strip()
)


# ============================================================
# VALIDATE DATA
# ============================================================

if df["transaction_date"].isna().any():

    raise ValueError(
        "Invalid transaction dates found."
    )


if df["amount"].isna().any():

    raise ValueError(
        "Invalid transaction amounts found."
    )


if df["user_id"].isna().any():

    raise ValueError(
        "Transactions with missing user_id found."
    )


# ============================================================
# CREATE MONTH
# ============================================================

df["month"] = (
    df["transaction_date"]
    .dt.to_period("M")
    .astype(str)
)


# ============================================================
# CHECK UNKNOWN CATEGORIES
# ============================================================

source_categories = set(
    df["category"].unique()
)

unknown_categories = (
    source_categories
    -
    set(CATEGORY_MAPPING.keys())
)

if unknown_categories:

    raise ValueError(
        "Unknown source categories found: "
        + str(unknown_categories)
    )


# ============================================================
# MAP SOURCE CATEGORIES
# ============================================================

df["application_category"] = (
    df["category"]
    .map(CATEGORY_MAPPING)
)


# ============================================================
# KEEP ONLY EXPENSE TRANSACTIONS
# ============================================================

"""
Income transactions such as Salary are not spending.

Therefore they are excluded from category-level
spending calculations.
"""
# ============================================================
# CALCULATE MONTHLY INCOME
# ============================================================
print("\nCalculating monthly income...")

monthly_income = (
    df[
        (df["transaction_type"] == "Credit") &
        (df["category"] == "Salary")
    ]
    .groupby(
        ["user_id", "month"],
        as_index=False
    )
    .agg(
        monthly_income=("amount", "sum")
    )
)

print("\nMonthly income:")
print(monthly_income.head(20).to_string(index=False))

print(f"\nIncome rows: {len(monthly_income)}")

expenses = df[
    df["transaction_type"] == "Debit"
].copy()


print(
    f"Expense transactions: "
    f"{len(expenses):,}"
)

# ============================================================
# CATEGORY-LEVEL SPENDING
# ============================================================

category_spending = (
    expenses
    .groupby(
        ["user_id", "month", "category"],
        as_index=False
    )
    .agg(
        monthly_category_spending=("amount", "sum")
    )
)

# Calculate total monthly expenses
monthly_expenses = (
    expenses
    .groupby(
        ["user_id", "month"],
        as_index=False
    )
    .agg(
        total_expense=("amount", "sum")
    )
)

# Merge total expenses
category_spending = category_spending.merge(
    monthly_expenses,
    on=["user_id", "month"],
    how="left"
)

# Merge monthly income
category_spending = category_spending.merge(
    monthly_income,
    on=["user_id", "month"],
    how="left"
)

print(category_spending.columns.tolist())

# Calculate percentage of income
category_spending["percentage_of_income"] = np.where(
    category_spending["monthly_income"] > 0,
    (
        category_spending["monthly_category_spending"]
        / category_spending["monthly_income"]
    ) * 100,
    np.nan
)

# Calculate percentage of expenses
category_spending["percentage_of_expenses"] = np.where(
    category_spending["total_expense"] > 0,
    (
        category_spending["monthly_category_spending"]
        / category_spending["total_expense"]
    ) * 100,
    np.nan
)

print("\nCategory-level spending:")
print(
    category_spending.head(20).to_string(index=False)
)

# ============================================================
# SAVE OUTPUT
# ============================================================

OUTPUT_PATH = "data/processed/monthly_category_spending.csv"

category_spending.to_csv(
    OUTPUT_PATH,
    index=False
)

print("\nCategory-level spending saved:")
print(OUTPUT_PATH)

print("\n============================================================")
print("STEP 3 COMPLETED SUCCESSFULLY")
