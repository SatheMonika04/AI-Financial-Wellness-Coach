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

A total of 20 synthetic users were generated.

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

    42

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