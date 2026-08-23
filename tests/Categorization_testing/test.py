import pandas as pd
import joblib

# --------------------------------------------------
# 1. Load model
# --------------------------------------------------

MODEL_PATH = "src/models/expense_classifier_pipeline.pkl"
model = joblib.load(MODEL_PATH)

print("Model loaded successfully!")


# --------------------------------------------------
# 2. Load single CSV
# --------------------------------------------------

CSV_PATH = "Test Assets/PhonePe_Statement_Aug2025_Aug2026.csv"

df = pd.read_csv(CSV_PATH)

print(f"Loaded {len(df)} transactions")
print()


# --------------------------------------------------
# 3. Required columns
# --------------------------------------------------

required_columns = [
    "transaction_text",
    "amount",
    "payment_method",
    "transaction_type"
]

missing = [
    col for col in required_columns
    if col not in df.columns
]

if missing:
    raise ValueError(
        f"Missing columns: {missing}"
    )


# --------------------------------------------------
# 4. Prepare input
# --------------------------------------------------

X = df[required_columns].copy()

X["transaction_text"] = (
    X["transaction_text"]
    .fillna("")
    .astype(str)
)

X["payment_method"] = (
    X["payment_method"]
    .fillna("Unknown")
    .astype(str)
)

X["transaction_type"] = (
    X["transaction_type"]
    .fillna("Unknown")
    .astype(str)
)

X["amount"] = pd.to_numeric(
    X["amount"],
    errors="coerce"
)


# --------------------------------------------------
# 5. Predict
# --------------------------------------------------

predictions = model.predict(X)

df["predicted_category"] = predictions


# --------------------------------------------------
# 6. Display results
# --------------------------------------------------

print("=" * 60)
print("PREDICTIONS")
print("=" * 60)

print(
    df[
        [
            "transaction_text",
            "amount",
            "payment_method",
            "transaction_type",
            "predicted_category"
        ]
    ].to_string(index=False)
)


# --------------------------------------------------
# 7. Category summary
# --------------------------------------------------

print("\n")
print("=" * 60)
print("CATEGORY SUMMARY")
print("=" * 60)

print(
    df["predicted_category"]
    .value_counts()
)


# --------------------------------------------------
# 8. Save predictions
# --------------------------------------------------

OUTPUT_PATH = "test_predictions.csv"

df.to_csv(
    OUTPUT_PATH,
    index=False
)

print("\nPredictions saved to:")
print(OUTPUT_PATH)