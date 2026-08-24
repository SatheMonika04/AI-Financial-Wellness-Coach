import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ============================================================
# 1. LOAD DATASET
# ============================================================

DATA_PATH = "data/processed/budget_recommendation_dataset_with_target.csv"
print("Loading budget recommendation dataset...")

df = pd.read_csv(DATA_PATH)

print(f"Rows: {len(df)}")
print(f"Columns: {len(df.columns)}")


# ============================================================
# 2. TARGET
# ============================================================

TARGET = "recommended_budget"

if TARGET not in df.columns:
    raise ValueError(f"Target column '{TARGET}' not found.")

df = df.dropna(subset=[TARGET])

print(f"\nTarget column: {TARGET}")
print(f"Valid rows: {len(df)}")


# ============================================================
# 3. FEATURES
# ============================================================

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

categorical_features = [
    "occupation",
    "financial_goal",
    "category"
]

features = numeric_features + categorical_features

missing_features = [
    col for col in features
    if col not in df.columns
]

if missing_features:
    raise ValueError(
        f"Missing feature columns: {missing_features}"
    )

X = df[features]
y = df[TARGET]


# ============================================================
# 4. TRAIN / TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42
)

print("\nDataset split:")
print(f"Training rows: {len(X_train)}")
print(f"Testing rows : {len(X_test)}")


# ============================================================
# 5. PREPROCESSING
# ============================================================

preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(
                handle_unknown="ignore"
            ),
            categorical_features
        )
    ],
    remainder="passthrough"
)


# ============================================================
# 6. RANDOM FOREST
# ============================================================

model = RandomForestRegressor(
    n_estimators=300,
    max_depth=15,
    min_samples_split=5,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)


pipeline = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("model", model)
    ]
)


# ============================================================
# 7. TRAIN
# ============================================================

print("\nTraining Random Forest...")

pipeline.fit(X_train, y_train)

print("Training completed.")


# ============================================================
# 8. TRAINING PERFORMANCE
# ============================================================

train_predictions = pipeline.predict(X_train)

train_mae = mean_absolute_error(
    y_train,
    train_predictions
)

train_rmse = np.sqrt(
    mean_squared_error(
        y_train,
        train_predictions
    )
)

train_r2 = r2_score(
    y_train,
    train_predictions
)


# ============================================================
# 9. TEST PERFORMANCE
# ============================================================

test_predictions = pipeline.predict(X_test)

test_mae = mean_absolute_error(
    y_test,
    test_predictions
)

test_rmse = np.sqrt(
    mean_squared_error(
        y_test,
        test_predictions
    )
)

test_r2 = r2_score(
    y_test,
    test_predictions
)


# ============================================================
# 10. RESULTS
# ============================================================

print("\n")
print("=" * 60)
print("MODEL VALIDATION RESULTS")
print("=" * 60)

print("\nTRAINING PERFORMANCE")
print(f"MAE  : ₹{train_mae:,.2f}")
print(f"RMSE : ₹{train_rmse:,.2f}")
print(f"R²   : {train_r2:.4f}")

print("\nTEST PERFORMANCE")
print(f"MAE  : ₹{test_mae:,.2f}")
print(f"RMSE : ₹{test_rmse:,.2f}")
print(f"R²   : {test_r2:.4f}")


# ============================================================
# 11. OVERFITTING CHECK
# ============================================================

r2_gap = train_r2 - test_r2

print("\n")
print("=" * 60)
print("OVERFITTING CHECK")
print("=" * 60)

print(f"R² gap: {r2_gap:.4f}")

if r2_gap < 0.05:
    print("Result: Low overfitting detected.")
elif r2_gap < 0.10:
    print("Result: Moderate overfitting.")
else:
    print("Result: High overfitting detected.")


# ============================================================
# 12. SAMPLE PREDICTIONS
# ============================================================

results = X_test.copy()

results["actual_budget"] = y_test.values
results["predicted_budget"] = test_predictions

results["difference"] = (
    results["predicted_budget"]
    - results["actual_budget"]
)

print("\n")
print("=" * 60)
print("SAMPLE PREDICTIONS")
print("=" * 60)

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
    ]
    .head(20)
    .to_string(index=False)
)


# ============================================================
# 13. SAVE VALIDATION RESULTS
# ============================================================

results.to_csv(
    "data/processed/budget_model_validation_predictions.csv",
    index=False
)

print("\nValidation predictions saved:")
print(
    "data/processed/budget_model_validation_predictions.csv"
)


print("\n")
print("=" * 60)
print("STEP 4 COMPLETED SUCCESSFULLY")
print("=" * 60)