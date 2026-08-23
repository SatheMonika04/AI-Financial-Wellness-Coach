"""Application-ready expense categorization pipeline.

The classifier artifact was trained on transaction_text, amount, amount_log,
payment_method, and transaction_type. This module adapts common bank CSV
schemas to that contract and writes the original rows with predictions.
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "expense_classifier_pipeline_v3.pkl"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_COLUMNS = ("transaction_text", "amount", "payment_method", "transaction_type")
DEFAULT_INPUT_CSV = PROJECT_ROOT / "Test Assets" / "PhonePe_Statement_Aug2025_Aug2026.csv"
DEFAULT_OUTPUT_CSV = PROJECT_ROOT / "data" / "output" / "PhonePe_Statement_Aug2025_Aug2026_categorized.csv"

LOW_CONFIDENCE_THRESHOLD = 0.6

_ACCOUNT_LABEL_PATTERN = re.compile(r"(paid by|credited to|debited from|xxxx)", re.IGNORECASE)
ALIASES = {
    "transaction_text": (
        "transaction_text", "transaction details", "transaction detail", "description",
        "narration", "particulars", "remarks", "details", "merchant", "text",
    ),
    "amount": ("amount", "transaction amount", "value"),
    "transaction_type": ("transaction", "transaction type", "transaction_type", "type", "dr/cr"),
    "payment_method": (
        "payment_method", "payment method", "credit/debit instrument", "instrument",
        "payment mode", "mode", "channel",
    ),
}


def _normalized(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value).strip().lower()).strip()


def _column_map(columns: list[Any]) -> dict[str, str]:
    normalized = {_normalized(column): str(column) for column in columns}
    result: dict[str, str] = {}
    for canonical, aliases in ALIASES.items():
        for alias in aliases:
            if _normalized(alias) in normalized:
                result[canonical] = normalized[_normalized(alias)]
                break
    return result


def _first_existing(frame: pd.DataFrame, names: tuple[str, ...]) -> pd.Series | None:
    for name in names:
        if name in frame:
            return frame[name]
    return None


def _infer_payment_method(text: pd.Series) -> pd.Series:
    source = text.fillna("").astype(str).str.lower()
    method = pd.Series("Unknown", index=text.index, dtype="string")
    patterns = (
        (r"upi|phonepe|google pay|gpay|paytm|bhim", "Upi"),
        (r"neft", "Neft"),
        (r"imps", "Imps"),
        (r"rtgs", "Rtgs"),
        (r"atm|cash withdrawal", "ATM"),
        (r"card|pos|visa|mastercard", "Card"),
        (r"cheque|check", "Cheque"),
        (r"salary|employer", "Bank Transfer"),
    )
    for pattern, value in patterns:
        method = method.mask(source.str.contains(pattern, regex=True, na=False), value)
    return method


def _prepare_features(frame: pd.DataFrame) -> pd.DataFrame:
    columns = _column_map(list(frame.columns))
    text = frame[columns["transaction_text"]] if "transaction_text" in columns else None
    if text is None:
        raise ValueError("CSV must contain a transaction description/text column.")

    features = pd.DataFrame(index=frame.index)
    features["transaction_text"] = text.fillna("").astype(str).str.replace(r"[/]", " ", regex=True).str.strip()

    amount = frame[columns["amount"]] if "amount" in columns else None
    inferred_type: pd.Series | None = None
    if amount is None:
        debit_name = next((name for name in frame.columns if _normalized(name) in {"debit", "withdrawal", "debit amount"}), None)
        credit_name = next((name for name in frame.columns if _normalized(name) in {"credit", "deposit", "credit amount"}), None)
        debit = frame[debit_name] if debit_name is not None else None
        credit = frame[credit_name] if credit_name is not None else None
        if debit is None and credit is None:
            raise ValueError("CSV must contain an amount column or debit/credit columns.")
        debit_value = pd.to_numeric(debit, errors="coerce") if debit is not None else 0.0
        credit_value = pd.to_numeric(credit, errors="coerce") if credit is not None else 0.0
        amount = credit_value.fillna(0) + debit_value.fillna(0)
        inferred_type = pd.Series("Credit", index=frame.index, dtype="string")
        if debit is not None:
            inferred_type = inferred_type.mask(pd.to_numeric(debit, errors="coerce").notna(), "Debit")
    else:
        amount = pd.to_numeric(amount.astype(str).str.replace(r"[^0-9.()-]", "", regex=True), errors="coerce")

    if amount.isna().any():
        raise ValueError("CSV contains missing or invalid transaction amounts.")
    features["amount"] = amount.abs().astype(float)

    if "payment_method" in columns:
        raw_payment_method = frame[columns["payment_method"]].fillna("Unknown").astype(str)
        # Guard against columns like PhonePe's "Credit/debit instrument", whose
        # values (e.g. "Paid by XXXXXXX4211") are masked-account labels rather
        # than a payment mode the model was trained on. If most values look
        # like that, infer the mode from the transaction text instead.
        looks_like_account_label = raw_payment_method.str.contains(_ACCOUNT_LABEL_PATTERN, regex=True, na=False)
        if looks_like_account_label.mean() > 0.5:
            features["payment_method"] = _infer_payment_method(features["transaction_text"])
        else:
            features["payment_method"] = raw_payment_method
    else:
        features["payment_method"] = _infer_payment_method(features["transaction_text"])

    if "transaction_type" in columns:
        transaction_type = frame[columns["transaction_type"]].fillna("").astype(str).str.lower()
        features["transaction_type"] = transaction_type.replace(
            {"dr": "Debit", "debit": "Debit", "withdrawal": "Debit", "cr": "Credit", "credit": "Credit", "deposit": "Credit"}
        ).replace("", "Unknown")
    else:
        features["transaction_type"] = inferred_type if inferred_type is not None else "Unknown"

    features["amount_log"] = np.log1p(features["amount"])
    return features.loc[:, ["transaction_text", "amount", "amount_log", "payment_method", "transaction_type"]]


def _read_csv(path: str | Path) -> pd.DataFrame:
    """Read normal CSVs and bank exports with metadata before the header."""
    path = Path(path)
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.reader(file))
    header_index = next(
        (
            index
            for index, row in enumerate(rows)
            if {"date", "amount"}.issubset({_normalized(value) for value in row})
            or {"transaction details", "amount"}.issubset({_normalized(value) for value in row})
        ),
        0,
    )
    frame = pd.read_csv(path, skiprows=header_index)
    columns = _column_map(list(frame.columns))
    if "amount" in columns:
        amount = pd.to_numeric(
            frame[columns["amount"]].astype(str).str.replace(r"[^0-9.()-]", "", regex=True),
            errors="coerce",
        )
        frame = frame.loc[amount.notna()].copy()
    return frame


def categorize_dataframe(
    data: pd.DataFrame,
    model_path: str | Path = MODEL_PATH,
    low_confidence_threshold: float = LOW_CONFIDENCE_THRESHOLD,
) -> pd.DataFrame:
    """Categorize a DataFrame and return the original rows with prediction columns.

    Predictions below ``low_confidence_threshold`` are relabeled "Uncategorized"
    (original model output preserved separately) so a low-signal guess never
    silently masquerades as a confident categorization downstream.
    """
    features = _prepare_features(data)
    model = joblib.load(model_path)
    result = data.copy()
    predictions = pd.Series(model.predict(features), index=data.index)
    result["predicted_category"] = predictions
    if hasattr(model, "predict_proba"):
        confidence = pd.Series(model.predict_proba(features).max(axis=1), index=data.index)
        result["category_confidence"] = confidence
        low_confidence = confidence < low_confidence_threshold
        if low_confidence.any():
            result["model_prediction"] = predictions
            result.loc[low_confidence, "predicted_category"] = "Uncategorized"
    return result


def categorize_csv(input_path: str | Path, output_path: str | Path | None = None, model_path: str | Path = MODEL_PATH) -> pd.DataFrame:
    """Read, categorize, and optionally save a transaction CSV."""
    result = categorize_dataframe(_read_csv(input_path), model_path=model_path)
    if output_path is not None:
        result.to_csv(output_path, index=False, encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Categorize transactions from a CSV file.")
    parser.add_argument("input_csv", type=Path, nargs="?", default=DEFAULT_INPUT_CSV, help="Input transaction CSV path.")
    parser.add_argument("output", type=Path, nargs="?", default=DEFAULT_OUTPUT_CSV, help="Output CSV path.")
    parser.add_argument("--model", type=Path, default=MODEL_PATH)
    args = parser.parse_args()
    output = args.output or args.input_csv.with_name(f"{args.input_csv.stem}_categorized.csv")
    categorize_csv(args.input_csv, output, args.model)
    print(f"Saved categorized transactions to {output}")


if __name__ == "__main__":
    main()