import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ============================================================
# STEP 1: LOAD DATASET
# ============================================================

DATA_PATH = "data/processed/budget_recommendation_dataset_with_target.csv"

print("Loading budget recommendation dataset...")

df = pd.read_csv(DATA_PATH)

print(f"Rows: {len(df)}")
print(f"Columns: {len(df.columns)}")


# ============================================================
# STEP 2: DEFINE TARGET
# ============================================================

TARGET = "recommended_budget"

if TARGET not in df.columns:
    raise ValueError(f"Target column '{TARGET}' not found.")

print("\nTarget column:", TARGET)


# ============================================================
# STEP 3: SELECT FEATURES
# ============================================================

FEATURES = [
    "monthly_category_spending",
    "income_for_budget",
    "percentage_of_income",
    "percentage_of_expenses",
    "category_spending_ratio",
    "age",
    "occupation",
    "savings_goal",
    "financial_goal",
    "credit_score",
    "total_debt",
    "debt_to_income_ratio",
    "expense_to_income_ratio",
    "category"
]

missing_features = [col for col in FEATURES if col not in df.columns]

if missing_features:
    raise ValueError(
        f"Missing feature columns: {missing_features}"
    )

X = df[FEATURES].copy()
y = df[TARGET].copy()


# ============================================================
# STEP 4: REMOVE INVALID TARGET ROWS
# ============================================================

valid_rows = y.notna() & np.isfinite(y)

X = X.loc[valid_rows].copy()
y = y.loc[valid_rows].copy()

print("\nValid rows:", len(X))


# ============================================================
# STEP 5: IDENTIFY COLUMN TYPES
# ============================================================

categorical_features = [
    "occupation",
    "financial_goal",
    "category"
]

numeric_features = [
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

print("\nNumeric features:")
print(numeric_features)

print("\nCategorical features:")
print(categorical_features)


# ============================================================
# STEP 6: TRAIN-TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42
)

print("\nDataset split:")
print("Training rows:", len(X_train))
print("Testing rows :", len(X_test))


# ============================================================
# STEP 7: PREPROCESSING
# ============================================================

preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(
                handle_unknown="ignore"
            ),
            categorical_features
        ),
        (
            "numeric",
            "passthrough",
            numeric_features
        )
    ]
)


# ============================================================
# STEP 8: RANDOM FOREST MODEL
# ============================================================

model = RandomForestRegressor(
    n_estimators=200,
    max_depth=12,
    min_samples_leaf=3,
    random_state=42,
    n_jobs=-1
)


# ============================================================
# STEP 9: CREATE PIPELINE
# ============================================================

pipeline = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("model", model)
    ]
)


# ============================================================
# STEP 10: TRAIN
# ============================================================

print("\nTraining Random Forest model...")

pipeline.fit(X_train, y_train)

from pathlib import Path
import joblib

# Project root = two levels above this script
PROJECT_ROOT = Path(__file__).resolve().parents[2]

MODEL_DIR = PROJECT_ROOT / "src" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = MODEL_DIR / "budget_recommendation_model.pkl"

joblib.dump(pipeline, MODEL_PATH)

print("\nTrained budget recommendation pipeline saved to:")
print(MODEL_PATH)

# ============================================================
# STEP 11: PREDICTION
# ============================================================

y_pred = pipeline.predict(X_test)


# ============================================================
# STEP 12: EVALUATION
# ============================================================

mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print("\n" + "=" * 60)
print("BUDGET RECOMMENDATION MODEL RESULTS")
print("=" * 60)

print(f"MAE  : ₹{mae:,.2f}")
print(f"RMSE : ₹{rmse:,.2f}")
print(f"R²   : {r2:.4f}")

print("=" * 60)


# ============================================================
# STEP 13: SAMPLE PREDICTIONS
# ============================================================

results = X_test.copy()

results["actual_budget"] = y_test.values
results["predicted_budget"] = y_pred

results["difference"] = (
    results["predicted_budget"]
    - results["actual_budget"]
)

print("\nSample predictions:")

print(
    results[
        [
            "category",
            "monthly_category_spending",
            "income_for_budget",
            "actual_budget",
            "predicted_budget",
            "difference"
        ]
    ].head(20).to_string(index=False)
)