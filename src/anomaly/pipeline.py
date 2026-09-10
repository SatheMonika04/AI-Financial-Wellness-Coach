"""Reusable chronological feature, training-artifact, and inference helpers."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "log_amount",
    "transaction_hour",
    "is_weekend",
    "is_month_end",
    "is_salary_week",
    "is_night",
    "is_evening",
    "log_merchant_transaction_count_hist",
    "log_merchant_median_amount_hist",
    "log_amount_vs_merchant_median",
    "merchant_zscore_transformed",
    "log_category_transaction_count_hist",
    "log_category_median_amount_hist",
    "log_amount_vs_category_median",
    "category_zscore_transformed",
]

REQUIRED_COLUMNS = [
    "transaction_id",
    "transaction_date",
    "transaction_time",
    "merchant",
    "amount",
    "category",
]


def clean_transactions(transactions: pd.DataFrame) -> pd.DataFrame:
    """Validate and normalize raw transactions without changing their meaning."""
    if not isinstance(transactions, pd.DataFrame):
        raise TypeError("transactions must be a pandas DataFrame")
    missing = [column for column in REQUIRED_COLUMNS if column not in transactions]
    if missing:
        raise ValueError(f"Missing required transaction columns: {missing}")

    result = transactions.copy()
    result["transaction_datetime"] = pd.to_datetime(
        result["transaction_date"].astype(str).str.strip()
        + " "
        + result["transaction_time"].astype(str).str.strip(),
        errors="coerce",
    )
    if result["transaction_datetime"].isna().any():
        raise ValueError("Datetime parsing failed for one or more transactions")

    result["amount"] = pd.to_numeric(result["amount"], errors="coerce")
    if result["amount"].isna().any() or not np.isfinite(result["amount"]).all():
        raise ValueError("amount contains missing or non-finite values")
    if (result["amount"] < 0).any():
        raise ValueError("amount must be non-negative")
    for column in ("merchant", "category"):
        result[column] = result[column].fillna("Unknown").astype(str).str.strip()
        result.loc[result[column].eq(""), column] = "Unknown"

    result = result.sort_values("transaction_datetime", kind="mergesort").reset_index(drop=True)
    if result["transaction_id"].duplicated().any():
        raise ValueError("transaction_id must be unique")
    return result


def _new_history() -> dict[str, dict[str, list[float] | int]]:
    return {"merchant": {}, "category": {}}


def _history_stats(
    history: dict[str, dict[str, list[float] | int]],
    group: str,
    key: str,
    fallback: float,
) -> tuple[int, float, float, float]:
    entry = history[group].get(key)
    if entry is None:
        return 0, fallback, fallback, 0.0
    values = np.asarray(entry["values"], dtype=float)
    mean = float(values.mean())
    std = float(values.std(ddof=1)) if len(values) > 1 else 0.0
    return int(entry["count"]), float(np.median(values)), mean, std


def _update_history(
    history: dict[str, dict[str, list[float] | int]],
    group: str,
    key: str,
    amount: float,
) -> None:
    entry = history[group].setdefault(key, {"count": 0, "values": []})
    entry["count"] += 1
    entry["values"].append(float(amount))


def generate_features(
    transactions: pd.DataFrame,
    fallback_amount: float,
    initial_history: dict[str, dict[str, list[float] | int]] | None = None,
) -> tuple[pd.DataFrame, dict[str, dict[str, list[float] | int]]]:
    """Generate features using only rows earlier in chronological order.

    The current row is scored before it is added to either history map. This
    makes first occurrences safe and prevents same-row or future-row leakage.
    """
    data = clean_transactions(transactions)
    history = copy.deepcopy(initial_history) if initial_history is not None else _new_history()
    rows: list[dict[str, Any]] = []
    fallback = max(float(fallback_amount), 1e-9)

    for row in data.itertuples(index=False):
        amount = float(row.amount)
        merchant_count, merchant_median, merchant_mean, merchant_std = _history_stats(
            history, "merchant", row.merchant, fallback
        )
        category_count, category_median, category_mean, category_std = _history_stats(
            history, "category", row.category, fallback
        )
        merchant_z = (amount - merchant_mean) / merchant_std if merchant_std > 1e-9 else 0.0
        category_z = (amount - category_mean) / category_std if category_std > 1e-9 else 0.0
        dt = row.transaction_datetime
        day = int(dt.day)
        row_features = {
            "log_amount": np.log1p(amount),
            "transaction_hour": dt.hour + dt.minute / 60.0,
            "is_weekend": int(dt.dayofweek >= 5),
            "is_month_end": int(dt.day >= (dt.days_in_month - 2)),
            "is_salary_week": int(day <= 7 or day >= 25),
            "is_night": int(dt.hour < 6),
            "is_evening": int(18 <= dt.hour < 23),
            "log_merchant_transaction_count_hist": np.log1p(merchant_count),
            "log_merchant_median_amount_hist": np.log1p(merchant_median),
            "log_amount_vs_merchant_median": np.log(max(amount, 1e-9) / merchant_median),
            "merchant_zscore_transformed": np.sign(merchant_z) * np.log1p(abs(merchant_z)),
            "log_category_transaction_count_hist": np.log1p(category_count),
            "log_category_median_amount_hist": np.log1p(category_median),
            "log_amount_vs_category_median": np.log(max(amount, 1e-9) / category_median),
            "category_zscore_transformed": np.sign(category_z) * np.log1p(abs(category_z)),
            "merchant_count_hist": merchant_count,
            "merchant_median_hist": merchant_median,
            "merchant_zscore_hist": merchant_z,
            "category_count_hist": category_count,
            "category_median_hist": category_median,
            "category_zscore_hist": category_z,
        }
        rows.append(row_features)
        _update_history(history, "merchant", row.merchant, amount)
        _update_history(history, "category", row.category, amount)

    feature_frame = pd.DataFrame(rows, index=data.index)
    feature_frame = feature_frame.reset_index(drop=True)
    feature_frame[FEATURE_COLUMNS] = feature_frame[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan)
    if feature_frame[FEATURE_COLUMNS].isna().any().any():
        raise ValueError("Historical feature generation produced NaN or infinite values")
    return pd.concat([data.reset_index(drop=True), feature_frame], axis=1), history


def _load_artifacts(artifact_dir: Path) -> tuple[dict[str, Any], Any, Any, dict[str, Any]]:
    preprocessing_path = artifact_dir / "preprocessing.joblib"
    model_path = artifact_dir / "isolation_forest.joblib"
    threshold_path = artifact_dir / "threshold.json"
    for path in (preprocessing_path, model_path, threshold_path):
        if not path.exists():
            raise FileNotFoundError(f"Required anomaly artifact does not exist: {path}")
    preprocessing = joblib.load(preprocessing_path)
    model = joblib.load(model_path)
    threshold = json.loads(threshold_path.read_text(encoding="utf-8"))
    return preprocessing, model, preprocessing["scaler"], threshold


def _explain(row: pd.Series) -> str:
    factors: list[str] = []
    if row["amount"] > row["merchant_median_hist"] * 2:
        factors.append("the amount is significantly higher than this merchant's historical median")
    if row["amount"] > row["category_median_hist"] * 2:
        factors.append("the amount is significantly higher than this category's historical median")
    if row["merchant_count_hist"] == 0:
        factors.append("this is a first transaction for the merchant")
    if row["category_count_hist"] == 0:
        factors.append("this is a first transaction for the category")
    if row["is_night"]:
        factors.append("it occurred during the night")
    elif row["is_evening"]:
        factors.append("it occurred during an evening period")
    if not factors:
        factors.append("its combined amount, timing, and historical behavior are unusual")
    return "Unusual transaction because " + " and ".join(factors) + "."


def predict_anomalies(transactions: pd.DataFrame, artifact_dir: str | Path | None = None) -> pd.DataFrame:
    """Load frozen artifacts and score new transactions without retraining."""
    directory = Path(artifact_dir or Path(__file__).resolve().parent / "artifacts")
    preprocessing, model, scaler, threshold = _load_artifacts(directory)
    if preprocessing["feature_columns"] != FEATURE_COLUMNS:
        raise ValueError("Saved feature order does not match the pipeline feature order")
    features, _ = generate_features(
        transactions,
        preprocessing["fallback_amount"],
        preprocessing["history"],
    )
    matrix = features[FEATURE_COLUMNS]
    if list(matrix.columns) != FEATURE_COLUMNS:
        raise ValueError("Feature columns are missing or in the wrong order")
    scores = -model.decision_function(scaler.transform(matrix))
    output = features[[
        "transaction_id", "transaction_datetime", "merchant", "description",
        "amount", "category", "payment_method",
    ]].copy()
    output["anomaly_score"] = scores
    output["anomaly_label"] = np.where(
        scores >= float(threshold["threshold"]), "Unusual Transaction", "Normal Transaction"
    )
    output["anomaly_explanation"] = ""
    flagged = output["anomaly_label"].eq("Unusual Transaction")
    output.loc[flagged, "anomaly_explanation"] = features.loc[flagged].apply(_explain, axis=1)
    return output