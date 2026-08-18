"""
spending_forecast_pipeline_simple.py

Simple prediction pipeline for the spending forecast model.
Loads the trained model, takes raw transaction data, and returns a
prediction. Written as plain functions (no classes) to keep it easy to
read and use in an app.

WHAT THE MODEL PREDICTS
------------------------
This model predicts a "smoothed" spending level (roughly, the average
spending over a 14-day window), not one exact day's raw spend. Think of
it as "what's the general spending trend right now", not "exact rupees
spent tomorrow".

BEFORE YOU RUN THIS
---------------------
The notebook needs to actually save the trained model first. In the
notebook, find this section (it's commented out) and uncomment it:

    joblib.dump(best_model, f"{MODEL}/spending_forecaster.pkl")
    joblib.dump(
        {
            "features": features,
            "target": "14-day centered smoothed total_spending",
            "cap_value": float(df["amount"].quantile(0.95)),   # <-- add this line
        },
        f"{MODEL}/model_metadata.pkl",
    )

Adding "cap_value" is important — it's the outlier cutoff the model was
trained with, and we need to reuse the exact same number when making
predictions later.

HOW TO USE
-----------
    import pandas as pd
    from spending_forecast_pipeline_simple import load_model, predict_latest

    model, metadata = load_model("models/spending_forecaster.pkl",
                                  "models/model_metadata.pkl")

    transactions = pd.read_csv("user_transactions.csv")
    result = predict_latest(model, metadata, transactions)
    print(result)
    # {"date": "2026-08-01", "predicted_spending": 12345.67}
"""

import joblib
import pandas as pd


# These are the columns the model was trained on.
# They must stay in this exact order.
FEATURES = [
    "lag_1", "lag_7", "lag_30",
    "rolling_mean_7", "rolling_mean_30", "rolling_std_7", "expanding_mean",
    "day_of_week", "day", "week", "month", "quarter",
    "is_weekend", "is_month_end",
]

# The model needs at least 30 days of past data to make a prediction
# (because of the 30-day lag / rolling features above).
MIN_DAYS_NEEDED = 30


# ---------------------------------------------------------------------
# STEP 1: Load the trained model + its metadata from disk
# ---------------------------------------------------------------------
def load_model(model_path, metadata_path):
    """Loads the saved model file and its metadata file."""
    model = joblib.load(model_path)
    metadata = joblib.load(metadata_path)
    return model, metadata


# ---------------------------------------------------------------------
# STEP 2: Turn raw transactions into one row per day
# ---------------------------------------------------------------------
def build_daily_spending(transactions, cap_value):
    """
    Takes a table of individual transactions (transaction_date, amount)
    and turns it into one row per day with total spending for that day.
    Any day with no transactions is filled with 0.
    """
    df = transactions.copy()
    df["transaction_date"] = pd.to_datetime(df["transaction_date"])

    # Cap very large transactions so they don't skew the total
    # (same cap value that was used when training the model).
    df["amount_capped"] = df["amount"].clip(upper=cap_value)

    # Sum up spending per day
    daily = (
        df.groupby("transaction_date")["amount_capped"]
        .sum()
        .reset_index()
        .rename(columns={"transaction_date": "date", "amount_capped": "total_spending"})
        .sort_values("date")
    )

    # Fill in any missing days with 0 spending, so the date range has no gaps
    all_dates = pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")
    daily = daily.set_index("date").reindex(all_dates, fill_value=0)
    daily = daily.rename_axis("date").reset_index()

    return daily


# ---------------------------------------------------------------------
# STEP 3: Add the extra columns (features) the model needs
# ---------------------------------------------------------------------
def add_features(daily):
    """
    Adds date-based columns (day of week, month, etc.) and
    history-based columns (past spending, rolling averages).
    """
    daily = daily.copy()

    # Date-based features
    daily["day"] = daily["date"].dt.day
    daily["day_of_week"] = daily["date"].dt.dayofweek
    daily["week"] = daily["date"].dt.isocalendar().week.astype(int)
    daily["month"] = daily["date"].dt.month
    daily["quarter"] = daily["date"].dt.quarter
    daily["is_weekend"] = (daily["day_of_week"] >= 5).astype(int)
    daily["is_month_end"] = daily["date"].dt.is_month_end.astype(int)

    # History-based features (how much was spent in the past)
    daily["lag_1"] = daily["total_spending"].shift(1)      # yesterday's spending
    daily["lag_7"] = daily["total_spending"].shift(7)       # spending 7 days ago
    daily["lag_30"] = daily["total_spending"].shift(30)     # spending 30 days ago
    daily["rolling_mean_7"] = daily["total_spending"].shift(1).rolling(7).mean()
    daily["rolling_mean_30"] = daily["total_spending"].shift(1).rolling(30).mean()
    daily["rolling_std_7"] = daily["total_spending"].shift(1).rolling(7).std()
    daily["expanding_mean"] = daily["total_spending"].shift(1).expanding().mean()

    return daily


# ---------------------------------------------------------------------
# STEP 4: Put it all together and predict
# ---------------------------------------------------------------------
def predict(model, metadata, transactions):
    """
    Full pipeline: raw transactions -> daily features -> predictions.
    Returns a table with one prediction per day (for days that have
    enough history).
    """
    cap_value = metadata.get("cap_value")
    if cap_value is None:
        # Fallback if the notebook wasn't updated to save cap_value.
        # This is less accurate, so it's only a backup plan.
        cap_value = transactions["amount"].quantile(0.95)

    daily = build_daily_spending(transactions, cap_value)
    daily = add_features(daily)

    # Only keep days where every feature has a real value (not missing)
    daily_ready = daily.dropna(subset=FEATURES)

    if len(daily_ready) == 0:
        raise ValueError(
            f"Not enough history to predict. Need at least "
            f"{MIN_DAYS_NEEDED} days of past transaction data."
        )

    predictions = model.predict(daily_ready[FEATURES])

    result = daily_ready[["date"]].copy()
    result["predicted_spending"] = predictions
    return result.reset_index(drop=True)


def predict_latest(model, metadata, transactions):
    """
    Simple version for an app: give it a user's transactions, get back
    one prediction (the most recent day we have enough data for).
    """
    all_predictions = predict(model, metadata, transactions)
    latest = all_predictions.iloc[-1]

    return {
        "date": latest["date"].strftime("%Y-%m-%d"),
        "predicted_spending": round(float(latest["predicted_spending"]), 2),
    }


# ---------------------------------------------------------------------
# Run this file directly to test it
# ---------------------------------------------------------------------
if __name__ == "__main__":
    # Change these paths to match your files
    MODEL_PATH = "src/models/spending_forecaster.pkl"
    METADATA_PATH = "src/models/model_metadata.pkl"
    TRANSACTIONS_CSV = "src/transactions.csv"

    model, metadata = load_model(MODEL_PATH, METADATA_PATH)
    transactions = pd.read_csv(TRANSACTIONS_CSV)

    result = predict_latest(model, metadata, transactions)
    print(result)