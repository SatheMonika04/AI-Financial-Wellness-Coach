import os
import numpy as np
import pandas as pd
import sklearn
import matplotlib.pyplot as plt
import seaborn as sns


# ============================================================
# CONFIGURATION
# ============================================================

INPUT_PATH = (
    "data/master/"
    "Master_featured_indian_financial_transactions.csv"
)

USER_PROFILE_OUTPUT = (
    "datasets/master/user_profiles.csv"
)

TRANSACTION_OUTPUT = (
    "data/processed/transactions_with_users.csv"
)

DOCUMENTATION_OUTPUT = (
    "reports/synthetic_user_profile_data_note.md"
)

NUMBER_OF_USERS = 20

RANDOM_SEED = 42

np.random.seed(RANDOM_SEED)


# ============================================================
# CREATE DIRECTORIES
# ============================================================

os.makedirs(
    "datasets/master",
    exist_ok=True
)

os.makedirs(
    "data/processed",
    exist_ok=True
)

os.makedirs(
    "reports",
    exist_ok=True
)


# ============================================================
# LOAD MASTER TRANSACTION DATA
# ============================================================

print("\nLoading transaction dataset...")

df = pd.read_csv(INPUT_PATH)

print(
    f"Loaded {len(df):,} transactions."
)


# ============================================================
# BASIC VALIDATION
# ============================================================

EXPECTED_COLUMNS = [
    "transaction_id",
    "transaction_date",
    "transaction_time",
    "merchant",
    "description",
    "amount",
    "currency",
    "payment_method",
    "transaction_type",
    "category",
    "city",
    "state",
    "country",
    "day",
    "week",
    "month",
    "weekend",
    "merchant_freq",
    "avg_expense",
    "rolling_avg",
    "month_end",
    "salary_week",
    "festival_season"
]

missing_columns = [
    col
    for col in EXPECTED_COLUMNS
    if col not in df.columns
]

if missing_columns:
    raise ValueError(
        "Missing expected columns: "
        + str(missing_columns)
    )


# ============================================================
# VALIDATE ROW COUNT
# ============================================================

if len(df) != 7000:

    print(
        f"WARNING: Expected approximately 7,000 rows "
        f"but found {len(df):,}."
    )

else:

    print(
        "Row-count validation passed: 7,000 rows."
    )


# ============================================================
# DATE CONVERSION
# ============================================================

df["transaction_date"] = pd.to_datetime(
    df["transaction_date"],
    errors="coerce"
)

if df["transaction_date"].isna().any():

    raise ValueError(
        "Some transaction dates could not be parsed."
    )


# ============================================================
# NUMERIC VALIDATION
# ============================================================

df["amount"] = pd.to_numeric(
    df["amount"],
    errors="coerce"
)

if df["amount"].isna().any():

    raise ValueError(
        "Some transaction amounts are invalid."
    )


if (df["amount"] < 0).any():

    raise ValueError(
        "Negative transaction amounts detected."
    )


# ============================================================
# NORMALIZE TEXT COLUMNS
# ============================================================

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

df["city"] = (
    df["city"]
    .astype(str)
    .str.strip()
)


# ============================================================
# DISPLAY DATASET INFORMATION
# ============================================================

print("\nDataset shape:")
print(df.shape)

print("\nTransaction types:")
print(
    df["transaction_type"].value_counts()
)

print("\nCategories:")
print(
    df["category"].value_counts()
)

print("\nCities:")
print(
    df["city"].value_counts()
)


# ============================================================
# CHECK FOR EXISTING USER_ID
# ============================================================

if "user_id" in df.columns:

    raise ValueError(
        "The master dataset already contains user_id. "
        "Do not run synthetic user assignment blindly."
    )

print(
    "\nNo user_id found. "
    "Synthetic user assignment will be created."
)


# ============================================================
# DETERMINE CITY DISTRIBUTION
# ============================================================

city_counts = (
    df["city"]
    .value_counts()
    .sort_values(
        ascending=False
    )
)

cities = city_counts.index.tolist()

print(
    f"\nFound {len(cities)} cities."
)


# ============================================================
# CREATE 20 SYNTHETIC USERS
# ============================================================

"""
The transaction dataset contains 15 cities.

We create 20 users.

The five cities with the highest transaction volume
receive two synthetic users each.

The remaining ten cities receive one synthetic user each.

This prevents one synthetic user from receiving an
unreasonably large number of transactions.
"""

top_cities = set(
    city_counts.head(5).index
)


user_city_mapping = []

user_number = 1

for city in cities:

    if city in top_cities:

        users_for_city = 2

    else:

        users_for_city = 1

    for _ in range(users_for_city):

        user_id = (
            f"U{str(user_number).zfill(4)}"
        )

        user_city_mapping.append(
            {
                "user_id": user_id,
                "city": city
            }
        )

        user_number += 1


user_city_df = pd.DataFrame(
    user_city_mapping
)


# ============================================================
# VALIDATE USER COUNT
# ============================================================

if len(user_city_df) != NUMBER_OF_USERS:

    raise ValueError(
        f"Expected {NUMBER_OF_USERS} users "
        f"but created {len(user_city_df)}."
    )


print(
    f"\nCreated {len(user_city_df)} "
    "synthetic users."
)


print("\nSynthetic user-city mapping:")
print(user_city_df.to_string(index=False))


# ============================================================
# ASSIGN TRANSACTIONS TO USERS
# ============================================================

"""
Assignment strategy:

1. Transactions are grouped by city.
2. Within each city they are sorted by date and transaction_id.
3. Transactions are distributed in round-robin order
   among the synthetic users assigned to that city.

This is intentionally deterministic.

Example:

Bengaluru
---------
Transaction 1 -> U0001
Transaction 2 -> U0002
Transaction 3 -> U0001
Transaction 4 -> U0002

This gives both synthetic users a similar time coverage
and prevents one user from receiving all transactions.
"""

df = df.sort_values(
    by=[
        "city",
        "transaction_date",
        "transaction_id"
    ]
).reset_index(drop=True)


df["user_id"] = None


for city, city_transactions in df.groupby(
    "city",
    sort=False
):

    city_users = (
        user_city_df[
            user_city_df["city"] == city
        ]["user_id"]
        .tolist()
    )

    row_indices = city_transactions.index

    for position, row_index in enumerate(
        row_indices
    ):

        assigned_user = city_users[
            position % len(city_users)
        ]

        df.loc[
            row_index,
            "user_id"
        ] = assigned_user


# ============================================================
# VALIDATE USER ASSIGNMENT
# ============================================================

if df["user_id"].isna().any():

    raise ValueError(
        "Some transactions were not assigned "
        "to a synthetic user."
    )


if df["user_id"].nunique() != NUMBER_OF_USERS:

    raise ValueError(
        "Not all synthetic users received transactions."
    )


print(
    "\nAll transactions successfully assigned "
    "to synthetic users."
)


# ============================================================
# CREATE YEAR-MONTH COLUMN
# ============================================================

df["year_month"] = (
    df["transaction_date"]
    .dt.to_period("M")
)


# ============================================================
# IDENTIFY SALARY TRANSACTIONS
# ============================================================

salary_mask = (
    df["category"].str.lower().eq("salary")
    &
    df["transaction_type"].eq("Credit")
)


salary_transactions = df[
    salary_mask
].copy()


print(
    f"\nSalary transactions found: "
    f"{len(salary_transactions)}"
)


# ============================================================
# SALARY SANITY CHECK
# ============================================================

print(
    "\nSalary amount statistics:"
)

print(
    salary_transactions["amount"]
    .describe()
)


"""
We do NOT remove unusual salary transactions.

They remain in the transaction dataset because the
master dataset should be preserved.

For profile estimation, however, we use robust statistics
such as the median rather than the mean.
"""


# ============================================================
# CALCULATE USER SALARY STATISTICS
# ============================================================

salary_user_stats = (
    salary_transactions
    .groupby("user_id")["amount"]
    .agg(
        salary_count="count",
        median_salary_payment="median"
    )
    .reset_index()
)


# ============================================================
# CALCULATE CITY SALARY STATISTICS
# ============================================================

salary_city_stats = (
    salary_transactions
    .groupby("city")["amount"]
    .median()
    .to_dict()
)


global_salary_median = (
    salary_transactions["amount"]
    .median()
)


# ============================================================
# ESTIMATE MONTHLY INCOME
# ============================================================

"""
Observed salary transactions occur approximately every
two weeks in the dataset.

Therefore:

Estimated monthly income =
median salary payment × 26 / 12

26 = approximate number of biweekly payments per year
12 = months per year

If a synthetic user has too few salary records,
the city-level median salary is used.

This is an estimation assumption and is documented later.
"""

salary_user_stats["monthly_income"] = (
    salary_user_stats[
        "median_salary_payment"
    ]
    * (26 / 12)
)


# ============================================================
# MERGE USER-CITY INFORMATION
# ============================================================

profile_df = user_city_df.merge(
    salary_user_stats[
        [
            "user_id",
            "salary_count",
            "monthly_income"
        ]
    ],
    on="user_id",
    how="left"
)


# ============================================================
# FILL USERS WITH FEW/NO SALARY RECORDS
# ============================================================

def get_city_salary(city):

    return salary_city_stats.get(
        city,
        global_salary_median
    )


profile_df["city_salary_median"] = (
    profile_df["city"]
    .apply(get_city_salary)
)


# Use city median for users with fewer than 3 salary records.

profile_df.loc[
    profile_df["salary_count"].fillna(0) < 3,
    "monthly_income"
] = (
    profile_df.loc[
        profile_df["salary_count"].fillna(0) < 3,
        "city_salary_median"
    ]
    * (26 / 12)
)


# Fallback if income is still missing.

profile_df["monthly_income"] = (
    profile_df["monthly_income"]
    .fillna(
        global_salary_median * (26 / 12)
    )
)


# ============================================================
# ROUND MONTHLY INCOME
# ============================================================

profile_df["monthly_income"] = (
    profile_df["monthly_income"]
    .round(-2)
)


# ============================================================
# CALCULATE MONTHLY EXPENSES
# ============================================================

"""
Only Debit transactions are treated as expenses.

Salary Credit transactions are NOT expenses.
"""

expense_transactions = df[
    df["transaction_type"].eq("Debit")
].copy()


monthly_user_expenses = (
    expense_transactions
    .groupby(
        ["user_id", "year_month"]
    )["amount"]
    .sum()
    .reset_index()
)


monthly_expense_median = (
    monthly_user_expenses
    .groupby("user_id")["amount"]
    .median()
    .rename(
        "monthly_expense"
    )
    .reset_index()
)


profile_df = profile_df.merge(
    monthly_expense_median,
    on="user_id",
    how="left"
)


# ============================================================
# FALLBACK EXPENSE CALCULATION
# ============================================================

global_monthly_expense = (
    monthly_user_expenses["amount"]
    .median()
)


profile_df["monthly_expense"] = (
    profile_df["monthly_expense"]
    .fillna(
        global_monthly_expense
    )
)


profile_df["monthly_expense"] = (
    profile_df["monthly_expense"]
    .round(-2)
)


# ============================================================
# GENERATE AGE
# ============================================================

"""
Age is synthetic because the transaction dataset does not
contain demographic information.

Age range:
22–60 years
"""

profile_df["age"] = np.random.randint(
    22,
    61,
    size=len(profile_df)
)


# ============================================================
# GENERATE OCCUPATION
# ============================================================

occupations = [
    "Software Engineer",
    "Teacher",
    "Doctor",
    "Business Owner",
    "Accountant",
    "Government Employee",
    "Marketing Professional",
    "Bank Employee",
    "Freelancer",
    "Consultant"
]


profile_df["occupation"] = np.random.choice(
    occupations,
    size=len(profile_df)
)


# ============================================================
# GENERATE SAVINGS GOAL
# ============================================================

"""
Savings goal is synthetic.

We generate a target between 10% and 25%
of monthly income.
"""

savings_ratio = np.random.uniform(
    0.10,
    0.25,
    size=len(profile_df)
)


profile_df["savings_goal"] = (
    profile_df["monthly_income"]
    * savings_ratio
).round(-2)


# ============================================================
# GENERATE FINANCIAL GOAL
# ============================================================

financial_goals = [
    "Emergency Fund",
    "Buy a House",
    "Buy a Car",
    "Higher Education",
    "Retirement",
    "Debt Repayment",
    "Travel",
    "Business Investment"
]


profile_df["financial_goal"] = np.random.choice(
    financial_goals,
    size=len(profile_df)
)


# ============================================================
# GENERATE TOTAL DEBT
# ============================================================

"""
Debt is synthetic.

Debt is generated between 0 and approximately
12 months of income.

This creates variation between low-debt and
high-debt users.
"""

debt_ratio = np.random.uniform(
    0.0,
    1.0,
    size=len(profile_df)
)


profile_df["total_debt"] = (
    profile_df["monthly_income"]
    * 12
    * debt_ratio
).round(-2)


# ============================================================
# GENERATE CREDIT SCORE
# ============================================================

"""
Credit score is synthetic.

We make it loosely related to debt burden so that
the generated profile is internally more realistic.

This is NOT a real credit-scoring model.
"""

debt_to_income = (
    profile_df["total_debt"]
    /
    (
        profile_df["monthly_income"]
        * 12
    )
)


credit_score = (
    820
    - (debt_to_income * 180)
    + np.random.normal(
        0,
        20,
        size=len(profile_df)
    )
)


profile_df["credit_score"] = (
    credit_score
    .clip(550, 850)
    .round()
    .astype(int)
)


# ============================================================
# SELECT REQUIRED PROFILE COLUMNS
# ============================================================

USER_PROFILE_COLUMNS = [
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


user_profiles = profile_df[
    USER_PROFILE_COLUMNS
].copy()


# ============================================================
# VALIDATE USER PROFILE DATA
# ============================================================

print(
    "\nUser profile dataset shape:"
)

print(
    user_profiles.shape
)


print(
    "\nUser profile columns:"
)

print(
    user_profiles.columns.tolist()
)


# Check duplicate IDs

duplicate_ids = (
    user_profiles["user_id"]
    .duplicated()
    .sum()
)

if duplicate_ids > 0:

    raise ValueError(
        f"Found {duplicate_ids} duplicate user IDs."
    )


# Check missing values

missing_values = (
    user_profiles
    .isna()
    .sum()
)


print(
    "\nMissing values:"
)

print(
    missing_values
)


if missing_values.sum() > 0:

    raise ValueError(
        "Missing values detected in user profiles."
    )


# Check numeric values

numeric_columns = [
    "age",
    "monthly_income",
    "monthly_expense",
    "savings_goal",
    "credit_score",
    "total_debt"
]


for column in numeric_columns:

    if (
        user_profiles[column] < 0
    ).any():

        raise ValueError(
            f"Negative values detected in {column}."
        )


# Check credit score

if not (
    user_profiles["credit_score"]
    .between(550, 850)
    .all()
):

    raise ValueError(
        "Credit scores outside 550–850 detected."
    )


# ============================================================
# ADD PROFILE VALIDATION METRICS
# ============================================================

user_profiles["estimated_savings"] = (
    user_profiles["monthly_income"]
    -
    user_profiles["monthly_expense"]
)


user_profiles["estimated_savings_rate"] = np.where(
    user_profiles["monthly_income"] > 0,
    (
        user_profiles["estimated_savings"]
        /
        user_profiles["monthly_income"]
    ) * 100,
    0
)


# ============================================================
# DISPLAY PROFILE SUMMARY
# ============================================================

print(
    "\nGenerated synthetic user profiles:"
)

print(
    user_profiles.to_string(index=False)
)


print(
    "\nIncome summary:"
)

print(
    user_profiles["monthly_income"]
    .describe()
)


print(
    "\nExpense summary:"
)

print(
    user_profiles["monthly_expense"]
    .describe()
)


# ============================================================
# SAVE USER PROFILES
# ============================================================

user_profiles[
    USER_PROFILE_COLUMNS
].to_csv(
    USER_PROFILE_OUTPUT,
    index=False
)


print(
    "\nUser profiles saved to:"
)

print(
    USER_PROFILE_OUTPUT
)


# ============================================================
# SAVE USER-LINKED TRANSACTIONS
# ============================================================

"""
Remove the temporary year_month column before saving.

The original transaction columns remain unchanged,
with only the synthetic user_id added.
"""

transactions_with_users = df.drop(
    columns=["year_month"]
)


transactions_with_users.to_csv(
    TRANSACTION_OUTPUT,
    index=False
)


print(
    "\nUser-linked transactions saved to:"
)

print(
    TRANSACTION_OUTPUT
)


# ============================================================
# TRANSACTION ASSIGNMENT VALIDATION
# ============================================================

print(
    "\nTransaction count per user:"
)

transaction_counts = (
    transactions_with_users
    .groupby("user_id")
    .size()
    .sort_index()
)

print(
    transaction_counts
)


# ============================================================
# USER-CITY VALIDATION
# ============================================================

user_city_check = (
    transactions_with_users
    .groupby("user_id")["city"]
    .nunique()
)


if (
    user_city_check > 1
).any():

    raise ValueError(
        "A synthetic user has transactions "
        "from multiple cities."
    )


print(
    "\nCity consistency check passed."
)


# ============================================================
# WRITE DOCUMENTATION
# ============================================================

documentation = f"""
# Synthetic User Profile Dataset

## Purpose

This dataset was created for the AI Financial Wellness Coach
project because the original transaction dataset does not
contain a `user_id` or real user-profile information.

## Source Dataset

Input:

`data/master/Master_featured_indian_financial_transactions.csv`

The source transaction dataset contains approximately
7,000 synthetic financial transactions.

## Synthetic User Generation

A total of {NUMBER_OF_USERS} synthetic users were generated.

The source dataset contains multiple cities. The five cities
with the highest transaction volumes were assigned two
synthetic users each. The remaining cities were assigned
one synthetic user each.

Transactions were assigned within each city using a
deterministic round-robin strategy after sorting by
transaction date and transaction ID.

This creates a reproducible synthetic linkage between
transactions and users.

## Important Data Limitation

These users are NOT real customers.

The generated `user_id` values are artificial identifiers
created only for application development, testing and
demonstration.

The original transaction dataset is synthetic as well.

Therefore:

- `user_id` is synthetic.
- `age` is synthetic.
- `occupation` is synthetic.
- `savings_goal` is synthetic.
- `financial_goal` is synthetic.
- `total_debt` is synthetic.
- `credit_score` is synthetic.

Income and monthly expense estimates are derived from the
synthetic transaction data assigned to each user.

## Monthly Income Assumption

Salary transactions in the source data appear at roughly
biweekly intervals.

Therefore estimated monthly income is calculated using:

    median salary payment × 26 / 12

where:

- 26 = approximate biweekly payments per year
- 12 = months per year

For users with fewer than three salary transactions,
the city-level median salary payment is used.

Median values are used rather than means because the salary
data contains unusually small and unusually large values.

## Monthly Expense

Monthly expense is calculated from Debit transactions.

For each user:

1. Transactions are grouped by year and month.
2. Debit amounts are summed.
3. The median monthly expense is used as the user's
   representative monthly expense.

## Credit Score

Credit scores are synthetic.

They are loosely related to the generated debt-to-income
burden and include controlled random variation.

They must NOT be interpreted as real credit scores.

## Reproducibility

Random seed:

    {RANDOM_SEED}

Running the script with the same input dataset and random seed
should produce reproducible synthetic profile values.

## Output Files

### User profiles

`datasets/master/user_profiles.csv`

Columns:

- user_id
- age
- occupation
- monthly_income
- monthly_expense
- savings_goal
- financial_goal
- credit_score
- total_debt

### User-linked transactions

`data/processed/transactions_with_users.csv`

This file contains the original transaction fields plus
the synthetic `user_id`.

## Intended Use

These datasets are intended for:

- Budget Recommendation
- Financial Health Score
- Spending Analysis
- Spending Alerts
- Forecast integration
- Frontend demonstration
- Backend API testing

They must not be presented as real customer financial data.
"""


with open(
    DOCUMENTATION_OUTPUT,
    "w",
    encoding="utf-8"
) as file:

    file.write(
        documentation.strip()
    )


print(
    "\nDocumentation saved to:"
)

print(
    DOCUMENTATION_OUTPUT
)


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "=" * 60)

print(
    "STEP 1 COMPLETED SUCCESSFULLY"
)

print("=" * 60)

print(
    f"Original transactions : {len(df):,}"
)

print(
    f"Synthetic users       : "
    f"{len(user_profiles)}"
)

print(
    f"Profile output        : "
    f"{USER_PROFILE_OUTPUT}"
)

print(
    f"Transaction output    : "
    f"{TRANSACTION_OUTPUT}"
)

print(
    f"Documentation         : "
    f"{DOCUMENTATION_OUTPUT}"
)

print("=" * 60)