"""High-level bank statement PDF processing pipeline."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from .csv_generator import save_transactions_to_csv
from .pdf_parser import extract_pdf_content
from .pdf_validator import detect_pdf_type, validate_pdf
from .table_extractor import detect_transaction_tables
from .transaction_cleaner import transactions_to_dataframe
from .transaction_parser import parse_transactions

LOGGER = logging.getLogger(__name__)


def _extract_transaction_rows(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Extract table rows when available, otherwise use raw page text."""
    detected_tables = detect_transaction_tables(pages)
    LOGGER.info("Detected %s transaction table(s)", len(detected_tables))

    table_rows: list[dict[str, Any]] = []
    for detected in detected_tables:
        table_rows.extend(
            parse_transactions(
                [{"page_number": detected["page_number"], "text": "", "tables": [detected["table"]]}],
                detected["columns"],
            )
        )
    if table_rows:
        return table_rows

    text_rows = parse_transactions(pages)
    LOGGER.info("Detected %s transaction row(s) from page text", len(text_rows))
    return text_rows


def process_bank_statement_to_dataframe(file_path: str | Path) -> pd.DataFrame:
    """Convert a text-based bank statement PDF into a clean transaction DataFrame.

    Unlike :func:`process_bank_statement` this returns the validated DataFrame
    directly and raises :class:`ValueError` on any processing failure so the
    caller can surface a friendly message without parsing a result dict.
    """
    validation = validate_pdf(file_path)
    if not validation["valid"]:
        pdf_type = detect_pdf_type(validation)
        if pdf_type == "SCANNED_OR_IMAGE_ONLY":
            raise ValueError(
                "This PDF contains no extractable text. "
                "Scanned or image-only PDFs are not supported yet."
            )
        raise ValueError(validation.get("error") or "The uploaded file is not a valid PDF.")

    pages = extract_pdf_content(file_path)
    raw_rows = _extract_transaction_rows(pages)

    if not raw_rows:
        raise ValueError(
            "No transaction rows were found. "
            "Please ensure this is a bank or UPI statement."
        )

    frame, _invalid = transactions_to_dataframe(raw_rows)

    if frame.empty:
        raise ValueError(
            "No valid transactions could be extracted after cleaning. "
            "The statement format may not be supported."
        )

    LOGGER.info("Extracted %s valid transaction(s) as DataFrame", len(frame))
    return frame


def process_bank_statement(file_path: str | Path, output_path: str | Path = "data/output/transactions.csv") -> dict[str, Any]:
    """Convert a text-based bank statement PDF into the canonical transaction CSV.

    Invalid rows are counted and retained in the returned diagnostics, while only
    valid rows are written to the CSV.
    """
    validation = validate_pdf(file_path)
    pdf_type = detect_pdf_type(validation)
    result: dict[str, Any] = {
        "success": False, "pdf_type": pdf_type, "page_count": validation.get("page_count", 0),
        "transactions_found": 0, "valid_transactions": 0, "invalid_transactions": 0,
        "output_file": None, "warnings": [], "errors": [],
    }
    if not validation["valid"]:
        result["errors"].append(validation["error"] or "Invalid PDF.")
        if pdf_type == "SCANNED_OR_IMAGE_ONLY":
            result["errors"] = ["PDF contains no extractable text. OCR is required."]
        return result
    try:
        LOGGER.info("Validated text-based PDF with %s page(s)", result["page_count"])
        pages = extract_pdf_content(file_path)
        raw_rows = _extract_transaction_rows(pages)
        result["transactions_found"] = len(raw_rows)
        LOGGER.info("Extracted %s candidate transaction row(s)", len(raw_rows))
        frame, invalid = transactions_to_dataframe(raw_rows)
        result["valid_transactions"] = len(frame)
        result["invalid_transactions"] = len(invalid)
        result["warnings"] = [
            message
            for item in invalid
            for message in item.get("errors", []) + item.get("warnings", [])
        ]
        if not raw_rows:
            result["errors"].append("No transaction table or transaction rows found.")
            return result
        if frame.empty:
            result["errors"].append("No valid transaction rows were found after cleaning and validation.")
            return result
        path = save_transactions_to_csv(frame, output_path)
        result["success"] = True
        result["output_file"] = str(path)
        LOGGER.info("Processed %s transactions; %s valid, %s invalid", len(raw_rows), len(frame), len(invalid))
        return result
    except (OSError, ValueError) as exc:
        result["errors"].append(str(exc))
        LOGGER.error("Bank statement processing failed: %s", exc)
        return result



def main():
    'run pipeline by giving file paths'
    process_bank_statement("D:\clg_project\AI-Financial-Wellness-Coach\Test Assets\statement 3.pdf", "data/output/transactions.csv")


if __name__ == "__main__":
    main()
    
