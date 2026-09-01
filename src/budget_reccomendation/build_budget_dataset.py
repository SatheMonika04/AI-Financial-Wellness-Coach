import os
import numpy as np
import pandas as pd


# ============================================================
# STEP 2 - BUILD BUDGET RECOMMENDATION DATASET
# ============================================================


# ============================================================
# 1. FILE PATHS
# ============================================================

CATEGORY_PATH = "data/processed/monthly_category_spending.csv"

FINANCIAL_PATH = "data/processed/monthly_financial_metrics.csv"

PROFILE_PATH = "datasets/master/user_profiles.csv"

OUTPUT_DIR = "data/processed"

OUTPUT_PATH = os.path.join(
    OUTPUT_DIR,
    "budget_recommendation_dataset.csv"
)


# ============================================================
# 2. LOAD DATASETS
# ============================================================

print("\nLoading datasets...")

category_spending = pd.read_csv(CATEGORY_PATH)

financial_metrics = pd.read_csv(FINANCIAL_PATH)

user_profiles = pd.read_csv(PROFILE_PATH)


print(
    f"Category spending rows : {len(category_spending):,}"
)

print(
    f"Financial metric rows  : {len(financial_metrics):,}"
)

print(
    f"User profile rows      : {len(user_profiles):,}"
)


# ============================================================
# 3. VALIDATE REQUIRED COLUMNS
# ============================================================

category_columns = [
    "user_id",
    "month",
    "category",
    "monthly_category_spending",
    "total_expense",
    "monthly_income"
]

financial_columns = [
    "user_id",
    "month",
    "total_income",
    "total_expense",
    "total_savings",
    "savings_rate"
]

profile_columns = [
    "user_id",
    "age",
    "occupation",
    "monthly_income",
    "monthly_expense",
    "savings_goal",
    "financial_goal",
    "credit_score",
    "total_debt"
]


for column in category_columns:

    if column not in category_spending.columns:

        raise ValueError(
            f"Missing column in monthly_category_spending.csv: {column}"
        )


for column in financial_columns:

    if column not in financial_metrics.columns:

        raise ValueError(
            f"Missing column in monthly_financial_metrics.csv: {column}"
        )


for column in profile_columns:

    if column not in user_profiles.columns:

        raise ValueError(
            f"Missing column in user_profiles.csv: {column}"
        )


print("\nColumn validation passed.")


# ============================================================
# 4. STANDARDIZE MONTH
# ============================================================

category_spending["month"] = (
    pd.to_datetime(category_spending["month"])
    .dt.to_period("M")
    .astype(str)
)

financial_metrics["month"] = (
    pd.to_datetime(financial_metrics["month"])
    .dt.to_period("M")
    .astype(str)
)


# ============================================================
# 5. RENAME PROFILE COLUMNS
# ============================================================

print("\nPreparing user profiles...")

user_profiles = user_profiles.rename(
    columns={
        "monthly_income": "profile_monthly_income",
        "monthly_expense": "profile_monthly_expense"
    }
)


# ============================================================
# 6. MERGE FINANCIAL METRICS
# ============================================================

print("\nMerging financial metrics...")

financial_data = financial_metrics[
    [
        "user_id",
        "month",
        "total_income",
        "total_expense",
        "total_savings",
        "savings_rate"
    ]
].copy()


category_spending = category_spending.merge(
    financial_data,
    on=["user_id", "month"],
    how="left",
    suffixes=("", "_financial")
)


print(
    "Rows after financial merge:",
    len(category_spending)
)


# ============================================================
# 7. MERGE USER PROFILES
# ============================================================

print("\nMerging user profiles...")

profile_data = user_profiles[
    [
        "user_id",
        "age",
        "occupation",
        "profile_monthly_income",
        "profile_monthly_expense",
        "savings_goal",
        "financial_goal",
        "credit_score",
        "total_debt"
    ]
].copy()


category_spending = category_spending.merge(
    profile_data,
    on="user_id",
    how="left"
)


print(
    "Rows after profile merge:",
    len(category_spending)
)


# ============================================================
# 8. CHECK MERGED COLUMNS
# ============================================================

print("\nColumns after merging:")

print(
    category_spending.columns.tolist()
)


# ============================================================
# 9. CREATE INCOME FOR BUDGET
# ============================================================

print("\nCreating income_for_budget...")

category_spending["monthly_income"] = pd.to_numeric(
    category_spending["monthly_income"],
    errors="coerce"
)

category_spending["profile_monthly_income"] = pd.to_numeric(
    category_spending["profile_monthly_income"],
    errors="coerce"
)


category_spending["income_for_budget"] = np.where(

    category_spending["monthly_income"].fillna(0) > 0,

    category_spending["monthly_income"],

    category_spending["profile_monthly_income"]

)


# ============================================================
# 10. CATEGORY PERCENTAGE OF INCOME
# ============================================================

print("\nCalculating percentage_of_income...")

category_spending["percentage_of_income"] = np.where(

    category_spending["income_for_budget"] > 0,

    (
        category_spending["monthly_category_spending"]
        /
        category_spending["income_for_budget"]
    ) * 100,

    np.nan

)


# ============================================================
# 11. CATEGORY PERCENTAGE OF EXPENSES
# ============================================================

print("\nCalculating percentage_of_expenses...")

category_spending["percentage_of_expenses"] = np.where(

    category_spending["total_expense"] > 0,

    (
        category_spending["monthly_category_spending"]
        /
        category_spending["total_expense"]
    ) * 100,

    0

)


# ============================================================
# 12. ESTIMATED SAVINGS
# ============================================================

print("\nCalculating savings features...")

category_spending["estimated_savings"] = (

    category_spending["income_for_budget"]

    -

    category_spending["total_expense"]

)


category_spending["estimated_savings_rate"] = np.where(

    category_spending["income_for_budget"] > 0,

    (
        category_spending["estimated_savings"]
        /
        category_spending["income_for_budget"]
    ) * 100,

    0

)


# ============================================================
# 13. CATEGORY SPENDING RATIO
# ============================================================

category_spending["category_spending_ratio"] = np.where(

    category_spending["income_for_budget"] > 0,

    (
        category_spending["monthly_category_spending"]
        /
        category_spending["income_for_budget"]
    ),

    0

)


# ============================================================
# 14. DEBT TO INCOME RATIO
# ============================================================

category_spending["debt_to_income_ratio"] = np.where(

    category_spending["profile_monthly_income"] > 0,

    (
        category_spending["total_debt"]
        /
        (
            category_spending["profile_monthly_income"]
            * 12
        )
    ),

    0

)


# ============================================================
# 15. EXPENSE TO INCOME RATIO
# ============================================================

category_spending["expense_to_income_ratio"] = np.where(

    category_spending["income_for_budget"] > 0,

    (
        category_spending["total_expense"]
        /
        category_spending["income_for_budget"]
    ),

    0

)


# ============================================================
# 16. FINAL COLUMN ORDER
# ============================================================

final_columns = [

    "user_id",

    "month",

    "category",

    "monthly_category_spending",

    "total_expense",

    "monthly_income",

    "total_income",

    "total_savings",

    "savings_rate",

    "profile_monthly_income",

    "profile_monthly_expense",

    "income_for_budget",

    "percentage_of_income",

    "percentage_of_expenses",

    "estimated_savings",

    "estimated_savings_rate",

    "category_spending_ratio",

    "age",

    "occupation",

    "savings_goal",

    "financial_goal",

    "credit_score",

    "total_debt",

    "debt_to_income_ratio",

    "expense_to_income_ratio"

]


budget_dataset = category_spending[
    final_columns
].copy()


# ============================================================
# 17. SORT DATA
# ============================================================

budget_dataset = budget_dataset.sort_values(

    by=[
        "user_id",
        "month",
        "category"
    ]

).reset_index(drop=True)


# ============================================================
# 18. VALIDATION
# ============================================================

print("\n" + "=" * 60)

print("FINAL DATASET VALIDATION")

print("=" * 60)


print(
    "Rows:",
    len(budget_dataset)
)

print(
    "Columns:",
    len(budget_dataset.columns)
)

print(
    "Users:",
    budget_dataset["user_id"].nunique()
)

print(
    "Categories:",
    budget_dataset["category"].nunique()
)

print(
    "Months:",
    budget_dataset["month"].nunique()
)


print("\nDuplicate rows:")

print(
    budget_dataset.duplicated().sum()
)


print("\nMissing values:")

missing_values = budget_dataset.isna().sum()

print(
    missing_values[missing_values > 0]
)


print("\nInvalid spending:")

print(
    (
        budget_dataset["monthly_category_spending"] < 0
    ).sum()
)


# ============================================================
# 19. SAVE DATASET
# ============================================================

os.makedirs(
    OUTPUT_DIR,
    exist_ok=True
)


budget_dataset.to_csv(
    OUTPUT_PATH,
    index=False
)


print("\nBudget recommendation dataset saved:")

print(
    OUTPUT_PATH
)


# ============================================================
# 20. PREVIEW
# ============================================================

print("\nFirst 10 rows:")

print(
    budget_dataset.head(10).to_string(
        index=False
    )
)


print("\n" + "=" * 60)

print("STEP 2 COMPLETED SUCCESSFULLY")

print("=" * 60)