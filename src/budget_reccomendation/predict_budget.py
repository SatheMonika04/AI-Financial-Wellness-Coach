from pathlib import Path
import joblib
import pandas as pd


# ============================================================
# STEP 1: PROJECT PATH
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "budget_recommendation_model.pkl"
)


# ============================================================
# STEP 2: CHECK MODEL
# ============================================================

print("Loading budget recommendation model...")

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found at:\n{MODEL_PATH}"
    )

pipeline = joblib.load(MODEL_PATH)

print("Model loaded successfully.")


# ============================================================
# STEP 3: GET USER INPUT
# ============================================================

print("\nEnter financial information")


monthly_category_spending = float(
    input("Monthly category spending: ")
)

monthly_income = float(
    input("Monthly income: ")
)

percentage_of_expenses = float(
    input("Percentage of expenses: ")
)

age = int(
    input("Age: ")
)

occupation = input(
    "Occupation: "
).strip()

savings_goal = float(
    input("Savings goal: ")
)

financial_goal = input(
    "Financial goal: "
).strip()

credit_score = int(
    input("Credit score: ")
)

total_debt = float(
    input("Total debt: ")
)

expense_to_income_ratio = float(
    input("Expense to income ratio: ")
)

category = input(
    "Category: "
).strip()


# ============================================================
# STEP 4: NORMALIZE CATEGORY
# ============================================================

category_map = {
    "bills": "Bills",
    "entertainment": "Entertainment",
    "food": "Food",
    "fuel": "Fuel",
    "groceries": "Groceries",
    "healthcare": "Healthcare",
    "insurance": "Insurance",
    "miscellaneous": "Miscellaneous",
    "other": "Other",
    "shopping": "Shopping",
    "subscription": "Subscription",
    "subscriptions": "Subscription",
    "transport": "Transport",
    "travel": "Travel"
}

category_key = category.lower()

if category_key in category_map:
    category = category_map[category_key]
else:
    category = category.title()


# ============================================================
# STEP 5: VALIDATE NUMERIC INPUTS
# ============================================================

if monthly_income <= 0:
    raise ValueError(
        "Monthly income must be greater than 0."
    )

if monthly_category_spending < 0:
    raise ValueError(
        "Monthly category spending cannot be negative."
    )

if savings_goal < 0:
    raise ValueError(
        "Savings goal cannot be negative."
    )

if total_debt < 0:
    raise ValueError(
        "Total debt cannot be negative."
    )

if credit_score < 0:
    raise ValueError(
        "Credit score cannot be negative."
    )


# ============================================================
# STEP 6: CALCULATE DERIVED FEATURES
# ============================================================

income_for_budget = monthly_income

percentage_of_income = (
    monthly_category_spending
    / monthly_income
) * 100

category_spending_ratio = (
    monthly_category_spending
    / monthly_income
)

# Training dataset uses annual income for debt-to-income ratio.
annual_income = monthly_income * 12

if annual_income > 0:
    debt_to_income_ratio = (
        total_debt
        / annual_income
    )
else:
    debt_to_income_ratio = 0


# ============================================================
# STEP 7: CREATE MODEL INPUT
# ============================================================

input_data = pd.DataFrame([
    {
        "monthly_category_spending":
            monthly_category_spending,

        "income_for_budget":
            income_for_budget,

        "percentage_of_income":
            percentage_of_income,

        "percentage_of_expenses":
            percentage_of_expenses,

        "category_spending_ratio":
            category_spending_ratio,

        "age":
            age,

        "occupation":
            occupation,

        "savings_goal":
            savings_goal,

        "financial_goal":
            financial_goal,

        "credit_score":
            credit_score,

        "total_debt":
            total_debt,

        "debt_to_income_ratio":
            debt_to_income_ratio,

        "expense_to_income_ratio":
            expense_to_income_ratio,

        "category":
            category
    }
])


# ============================================================
# STEP 8: DISPLAY PROCESSED INPUT
# ============================================================

print("\nProcessed information:")
print("--------------------------------------------")

print(
    f"Category                 : {category}"
)

print(
    f"Monthly income           : ₹{monthly_income:,.2f}"
)

print(
    f"Current spending         : "
    f"₹{monthly_category_spending:,.2f}"
)

print(
    f"Percentage of income     : "
    f"{percentage_of_income:.2f}%"
)

print(
    f"Percentage of expenses   : "
    f"{percentage_of_expenses:.2f}%"
)

print(
    f"Category spending ratio  : "
    f"{category_spending_ratio:.4f}"
)

print(
    f"Debt-to-income ratio     : "
    f"{debt_to_income_ratio:.4f}"
)

print(
    f"Expense-to-income ratio  : "
    f"{expense_to_income_ratio:.4f}"
)


# ============================================================
# STEP 9: PREDICT
# ============================================================

predicted_budget = pipeline.predict(
    input_data
)[0]


# ============================================================
# STEP 10: SAFETY CHECK
# ============================================================

predicted_budget = max(
    0,
    float(predicted_budget)
)


# ============================================================
# STEP 11: CALCULATE DIFFERENCE
# ============================================================

difference = (
    monthly_category_spending
    - predicted_budget
)


# ============================================================
# STEP 12: DISPLAY RECOMMENDATION
# ============================================================

print("\n" + "=" * 60)
print("BUDGET RECOMMENDATION")
print("=" * 60)

print(
    f"Category                 : {category}"
)

print(
    f"Current Spending         : "
    f"₹{monthly_category_spending:,.2f}"
)

print(
    f"Recommended Budget       : "
    f"₹{predicted_budget:,.2f}"
)

print(
    f"Difference               : "
    f"₹{difference:,.2f}"
)

print("=" * 60)


# ============================================================
# STEP 13: INTERPRETATION
# ============================================================

if difference > 0:

    print(
        f"\nPotential reduction: "
        f"₹{difference:,.2f}"
    )

elif difference < 0:

    print(
        f"\nCurrent spending is "
        f"₹{abs(difference):,.2f} above "
        f"the recommended budget."
    )

else:

    print(
        "\nCurrent spending is equal "
        "to the recommended budget."
    )