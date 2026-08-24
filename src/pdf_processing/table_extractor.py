"""Identify likely transaction tables and normalize their headers."""

from __future__ import annotations

import re
from typing import Any

ALIASES = {
    "transaction_date": ("date", "txn date", "transaction date", "value date"),
    "description": ("narration", "particulars", "description", "remarks", "details"),
    "debit": ("debit", "dr", "withdrawal", "withdrawals", "debit amount"),
    "credit": ("credit", "cr", "deposit", "deposits", "credit amount"),
    "transaction_type": ("type", "transaction type", "dr/cr"),
    "transaction": ("transaction",),
    "amount": ("amount", "transaction amount"),
}


def _normal(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def identify_columns(table: list[list[Any]]) -> dict[str, str]:
    """Map canonical fields to header names in a table."""
    if not table:
        return {}
    headers = {str(cell).strip(): _normal(cell) for cell in table[0] if cell is not None}
    mapping: dict[str, str] = {}
    for canonical, aliases in ALIASES.items():
        for original, normalized in headers.items():
            if normalized in aliases:
                mapping[canonical] = original
                break
    if "transaction" not in mapping and "transaction_type" in mapping:
        mapping["transaction"] = mapping["transaction_type"]
    return mapping


def detect_transaction_tables(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return tables containing date and description plus an amount field."""
    detected = []
    for page in pages:
        for table in page.get("tables", []):
            mapping = identify_columns(table)
            if {"transaction_date", "description"} <= mapping.keys() and ({"debit", "credit", "transaction", "amount"} & mapping.keys()):
                detected.append({"page_number": page.get("page_number"), "table": table, "columns": mapping})
    return detected
