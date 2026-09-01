import pandas as pd
import joblib
import os

# ============================================================
# PATHS
# ============================================================

DATA_PATH = "data/processed/budget_recommendation_dataset_with_target.csv"
MODEL_PATH = "models/budget_recommendation_model.pkl"
OUTPUT_PATH = "data/processed/budget_feature_importance.csv"


# ============================================================
# LOAD DATA
# ============================================================

print("Loading budget recommendation dataset...")

df = pd.read_csv(DATA_PATH)

print(f"Rows: {len(df)}")
print(f"Columns: {len(df.columns)}")


# ============================================================
# FEATURES
# ============================================================

NUMERIC_FEATURES = [
    "monthly_category_spending",
    "income_for_budget",
    "percentage_of_income",
    "percentage_of_expenses",
    "category_spending_ratio",
    "age",
    "savings_goal",
    "credit_score",
    "total_debt",
    "debt_to_income_ratio",
    "expense_to_income_ratio"
]

CATEGORICAL_FEATURES = [
    "occupation",
    "financial_goal",
    "category"
]

TARGET = "recommended_budget"


# ============================================================
# CHECK COLUMNS
# ============================================================

required_columns = (
    NUMERIC_FEATURES +
    CATEGORICAL_FEATURES +
    [TARGET]
)

missing_columns = [
    col for col in required_columns
    if col not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Missing columns: {missing_columns}"
    )

print("\nColumn validation passed.")


# ============================================================
# LOAD MODEL
# ============================================================

print("\nLoading trained model...")

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"Model not found: {MODEL_PATH}"
    )

model = joblib.load(MODEL_PATH)

print("Model loaded successfully.")


# ============================================================
# GET FEATURE IMPORTANCE
# ============================================================

print("\nCalculating feature importance...")

if not hasattr(model, "feature_importances_"):
    raise ValueError(
        "Loaded model does not provide feature_importances_."
    )

importances = model.feature_importances_


# ============================================================
# GET TRANSFORMED FEATURE NAMES
# ============================================================

if hasattr(model, "named_steps"):

    preprocessor = model.named_steps.get("preprocessor")

    if preprocessor is not None:

        feature_names = preprocessor.get_feature_names_out()

    else:
        feature_names = [
            f"feature_{i}"
            for i in range(len(importances))
        ]

else:

    feature_names = [
        f"feature_{i}"
        for i in range(len(importances))
    ]


# ============================================================
# FEATURE IMPORTANCE TABLE
# ============================================================

importance_df = pd.DataFrame({
    "feature": feature_names,
    "importance": importances
})

importance_df = importance_df.sort_values(
    by="importance",
    ascending=False
)

importance_df = importance_df.reset_index(drop=True)


# ============================================================
# DISPLAY RESULTS
# ============================================================

print("\n============================================================")
print("FEATURE IMPORTANCE")
print("============================================================")

print(
    importance_df.head(20).to_string(index=False)
)


# ============================================================
# SAVE RESULTS
# ============================================================

importance_df.to_csv(
    OUTPUT_PATH,
    index=False
)

print("\nFeature importance saved to:")
print(OUTPUT_PATH)

print("\n============================================================")
print("STEP 5 COMPLETED SUCCESSFULLY")
print("============================================================")