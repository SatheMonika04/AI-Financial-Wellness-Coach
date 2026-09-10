"""Train and evaluate the leakage-safe anomaly detector from a fresh process."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.anomaly.pipeline import FEATURE_COLUMNS, _explain, generate_features

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "master" / "final_master_transaction.csv"
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"


def _score(model: IsolationForest, scaler: StandardScaler, frame: pd.DataFrame) -> np.ndarray:
    return -model.decision_function(scaler.transform(frame[FEATURE_COLUMNS]))


def _summary(scores: np.ndarray, labels: np.ndarray | None = None) -> dict[str, float | int]:
    result = {
        "count": int(len(scores)),
        "anomaly_count": int(labels.sum()) if labels is not None else 0,
        "anomaly_rate": float(labels.mean()) if labels is not None else 0.0,
        "score_min": float(scores.min()),
        "score_median": float(np.median(scores)),
        "score_mean": float(scores.mean()),
        "score_max": float(scores.max()),
    }
    return result


def main() -> None:
    raw = pd.read_csv(DATA_PATH)
    raw["transaction_datetime"] = pd.to_datetime(
        raw["transaction_date"] + " " + raw["transaction_time"], errors="raise"
    )
    raw = raw.sort_values("transaction_datetime", kind="mergesort").reset_index(drop=True)
    n_train = int(len(raw) * 0.70)
    n_validation = int(len(raw) * 0.15)
    train_raw = raw.iloc[:n_train].copy()
    validation_raw = raw.iloc[n_train:n_train + n_validation].copy()
    test_raw = raw.iloc[n_train + n_validation:].copy()
    fallback = float(train_raw["amount"].median())

    train_features, train_history = generate_features(train_raw, fallback)
    validation_features, validation_history = generate_features(
        validation_raw, fallback, train_history
    )
    test_features, _ = generate_features(test_raw, fallback, validation_history)
    scaler = StandardScaler().fit(train_features[FEATURE_COLUMNS])

    configs = [
        {"n_estimators": 200, "max_samples": 0.8, "contamination": "auto", "max_features": 1.0},
        {"n_estimators": 300, "max_samples": 0.8, "contamination": 0.03, "max_features": 1.0},
        {"n_estimators": 300, "max_samples": 1.0, "contamination": 0.05, "max_features": 0.8},
    ]
    candidates = []
    for config in configs:
        model = IsolationForest(random_state=42, **config).fit(
            scaler.transform(train_features[FEATURE_COLUMNS])
        )
        validation_scores = _score(model, scaler, validation_features)
        candidates.append((float(np.quantile(validation_scores, 0.98) - np.median(validation_scores)), config, model))
    _, selected_config, model = max(candidates, key=lambda item: item[0])

    validation_scores = _score(model, scaler, validation_features)
    test_scores = _score(model, scaler, test_features)
    percentiles = [0.95, 0.97, 0.98, 0.99, 0.995]
    threshold_rows = []
    for percentile in percentiles:
        threshold = float(np.quantile(validation_scores, percentile))
        flags = validation_scores >= threshold
        threshold_rows.append({
            "percentile": percentile,
            "threshold": threshold,
            "anomaly_count": int(flags.sum()),
            "anomaly_rate": float(flags.mean()),
        })
    selected_threshold_row = min(threshold_rows, key=lambda row: abs(row["anomaly_rate"] - 0.02))
    threshold = float(selected_threshold_row["threshold"])
    validation_flags = validation_scores >= threshold
    test_flags = test_scores >= threshold

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, ARTIFACT_DIR / "isolation_forest.joblib")
    joblib.dump({
        "feature_columns": FEATURE_COLUMNS,
        "fallback_amount": fallback,
        "scaler": scaler,
        "history": train_history,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "training_start": str(train_raw["transaction_datetime"].min()),
        "training_end": str(train_raw["transaction_datetime"].max()),
    }, ARTIFACT_DIR / "preprocessing.joblib")
    (ARTIFACT_DIR / "threshold.json").write_text(json.dumps({
        "threshold": threshold,
        "selected_percentile": selected_threshold_row["percentile"],
        "selection_rule": "validation percentile closest to a 2% anomaly rate",
        "candidate_thresholds": threshold_rows,
    }, indent=2), encoding="utf-8")
    (ARTIFACT_DIR / "feature_list.json").write_text(json.dumps(FEATURE_COLUMNS, indent=2), encoding="utf-8")
    (ARTIFACT_DIR / "model_config.json").write_text(json.dumps({"random_state": 42, **selected_config}, indent=2), encoding="utf-8")
    (ARTIFACT_DIR / "explanation_rules.json").write_text(json.dumps({
        "rules": [
            "amount > 2x historical merchant median",
            "amount > 2x historical category median",
            "first transaction for merchant or category",
            "night or evening transaction",
            "fallback: combined amount, timing, and historical behavior",
        ],
        "history_policy": "Rules use only history available before the evaluated transaction.",
    }, indent=2), encoding="utf-8")

    validation_output = validation_raw.reset_index(drop=True).copy()
    validation_output["anomaly_score"] = validation_scores
    validation_output["anomaly_label"] = np.where(validation_flags, "Unusual Transaction", "Normal Transaction")
    validation_output.to_csv(OUTPUT_DIR / "validation_results.csv", index=False)
    test_output = test_raw.reset_index(drop=True).copy()
    test_output["anomaly_score"] = test_scores
    test_output["anomaly_label"] = np.where(test_flags, "Unusual Transaction", "Normal Transaction")
    test_output.to_csv(OUTPUT_DIR / "test_results.csv", index=False)

    top = test_features.loc[test_flags].copy()
    top["anomaly_score"] = test_scores[test_flags]
    top["anomaly_explanation"] = top.apply(_explain, axis=1)
    top.sort_values("anomaly_score", ascending=False).head(25).to_csv(OUTPUT_DIR / "anomaly_report.csv", index=False)
    report = {
        "dataset": {"rows": len(raw), "train": len(train_raw), "validation": len(validation_raw), "test": len(test_raw)},
        "date_ranges": {name: [str(frame["transaction_datetime"].min()), str(frame["transaction_datetime"].max())] for name, frame in [("train", train_raw), ("validation", validation_raw), ("test", test_raw)]},
        "features": FEATURE_COLUMNS,
        "leakage_check": "Each row is scored before its amount is added to merchant/category history; validation starts with train history and test starts with train plus validation history.",
        "model": {"random_state": 42, **selected_config},
        "threshold": {"selected": threshold, "candidates": threshold_rows, "selection_rule": "validation-only percentile closest to 2%"},
        "validation": _summary(validation_scores, validation_flags),
        "test": _summary(test_scores, test_flags),
        "accuracy_note": "No ground-truth anomaly labels exist; accuracy is not reported.",
    }
    (OUTPUT_DIR / "model_evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()