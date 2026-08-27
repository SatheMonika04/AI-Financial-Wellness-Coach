"""Cleaning and validation for the canonical transaction schema."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import pandas as pd

SCHEMA = ["transaction_date", "description", "transaction", "amount"]
AMOUNT_PATTERN = re.compile(r"[\s₹,]")
DAY_MONTH_PATTERN = re.compile(r"^(\d{1,2})[- ]([A-Za-z]{3,9})$")


def clean_date(value: Any) -> pd.Timestamp | None:
    if value is None or not str(value).strip():
        return None
    text = str(value).strip()
    day_month = DAY_MONTH_PATTERN.fullmatch(text)
    if day_month:
        text = f"{day_month.group(1)} {day_month.group(2)} {datetime.now().year}"
    for dayfirst in (True, False):
        parsed = pd.to_datetime(text, dayfirst=dayfirst, errors="coerce")
        if not pd.isna(parsed):
            return parsed.normalize()
    return None


def clean_amount(value: Any) -> float | None:
    if value is None or not str(value).strip() or str(value).strip() in {"-", "—", "N/A"}:
        return None
    text = str(value).strip().upper()
    negative = text.startswith("(") and text.endswith(")")
    text = re.sub(r"(?:DR|CR)$", "", text).strip(" ()")
    text = AMOUNT_PATTERN.sub("", text)
    try:
        amount = float(text)
    except ValueError as exc:
        raise ValueError(f"Invalid amount: {value!r}") from exc
    return -amount if negative else amount


def clean_transaction(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize one raw candidate without adding inferred business data."""
    cleaned = {key: row.get(key) for key in SCHEMA}
    cleaned["transaction_date"] = clean_date(cleaned["transaction_date"])
    cleaned["description"] = " ".join(str(cleaned["description"] or "").split()).strip() or None
    cleaned["amount"] = clean_amount(cleaned["amount"])
    explicit_type = str(cleaned["transaction"] or "").strip().lower()
    if explicit_type in {"dr", "debit", "withdrawal"}:
        cleaned["transaction"] = "Debit"
    elif explicit_type in {"cr", "credit", "deposit"}:
        cleaned["transaction"] = "Credit"
    else:
        cleaned["transaction"] = None
    if cleaned["amount"] is not None:
        cleaned["amount"] = abs(cleaned["amount"])
    return cleaned


def validate_transaction(row: dict[str, Any]) -> dict[str, Any]:
    """Validate a cleaned transaction and return errors/warnings."""
    errors: list[str] = []
    warnings: list[str] = []
    if row.get("transaction_date") is None:
        errors.append("Missing or invalid transaction date.")
    if not row.get("description"):
        warnings.append("Transaction description is missing.")
    if row.get("amount") is None:
        errors.append("Missing transaction amount.")
    if row.get("transaction") not in {"Debit", "Credit"}:
        errors.append("Invalid or missing transaction type.")
    return {"valid": not errors, "errors": errors, "warnings": warnings}


def transactions_to_dataframe(rows: list[dict[str, Any]]) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Clean, validate, and deduplicate candidates while retaining invalid diagnostics."""
    valid: list[dict[str, Any]] = []
    invalid: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()
    for raw in rows:
        try:
            row = clean_transaction(raw)
        except ValueError as exc:
            invalid.append({"row": raw, "errors": [str(exc)], "warnings": []})
            continue
        result = validate_transaction(row)
        if not result["valid"]:
            invalid.append({"row": row, **result})
            continue
        key = tuple(row[field] for field in SCHEMA)
        if key in seen:
            continue
        seen.add(key)
        valid.append(row)
    frame = pd.DataFrame(valid, columns=SCHEMA)
    if not frame.empty:
        frame["transaction_date"] = pd.to_datetime(frame["transaction_date"])
        frame["amount"] = pd.to_numeric(frame["amount"], errors="coerce")
        frame["transaction"] = frame["transaction"].astype("string")
        frame["description"] = frame["description"].astype("string")
    return frame, invalid
