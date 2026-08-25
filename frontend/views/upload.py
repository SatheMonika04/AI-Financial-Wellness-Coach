"""Upload & Analyze — parse bank or UPI statements and categorize transactions."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pandas as pd
import streamlit as st

from ..components.navbar import render_navbar
from ..utils.ui import html

# ---------------------------------------------------------------------------
# Column alias sets (mirrors the categorization pipeline's approach)
# ---------------------------------------------------------------------------
_DATE_ALIASES = {"transaction_date", "date", "txn date", "value date"}
_AMOUNT_ALIASES = {"amount", "transaction amount", "value"}
_TYPE_ALIASES = {
    "transaction", "transaction_type", "type", "dr/cr", "transaction type",
}
_DESC_ALIASES = {
    "description", "narration", "particulars", "remarks", "details",
    "transaction_text", "transaction details", "merchant", "text",
}

LOW_CONFIDENCE_THRESHOLD = 0.4
_SESSION_KEY = "transactions_df"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _find_column(df: pd.DataFrame, aliases: set[str]) -> str | None:
    """Return the first column whose lower-cased name is in *aliases*."""
    lower_map = {col.strip().lower(): col for col in df.columns}
    for alias in aliases:
        if alias in lower_map:
            return lower_map[alias]
    return None


def _process_pdf(raw_bytes: bytes) -> pd.DataFrame:
    """Save uploaded PDF to a temp file and run the bank-statement parser."""
    from src.pdf_processing.pipeline import process_bank_statement_to_dataframe

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name
    try:
        return process_bank_statement_to_dataframe(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _process_csv(raw_bytes: bytes) -> pd.DataFrame:
    """Save uploaded CSV to a temp file and read it with smart header detection."""
    from src.Expense_Categorization.expense_categorization_pipeline import (
        categorize_csv,
    )

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="wb") as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name
    try:
        return categorize_csv(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _categorize(df: pd.DataFrame) -> pd.DataFrame:
    """Run the ML expense categoriser and apply a low-confidence fallback."""
    from src.Expense_Categorization.expense_categorization_pipeline import (
        categorize_dataframe,
    )

    result = categorize_dataframe(df)
    return _apply_low_confidence_fallback(result)


def _apply_low_confidence_fallback(df: pd.DataFrame) -> pd.DataFrame:
    """Mark low-confidence predictions as Uncategorized."""
    if "category_confidence" in df.columns:
        mask = df["category_confidence"] < LOW_CONFIDENCE_THRESHOLD
        df = df.copy()
        df.loc[mask, "predicted_category"] = "Uncategorized"
    return df


# ---------------------------------------------------------------------------
# UI sections
# ---------------------------------------------------------------------------
def _render_header() -> None:
    html(
        """
        <div class="mm-section" style="padding-bottom:24px">
          <span class="mm-eyebrow">Upload &amp; Analyze</span>
          <h2 class="mm-h2" style="margin-top:12px">Understand your spending</h2>
          <p class="mm-lead">
            Upload a bank or PhonePe statement as <strong>PDF</strong> or
            <strong>CSV</strong> to get instant, AI-categorized transaction
            insights.
          </p>
        </div>
        """
    )


def _render_kpi_cards(filtered: pd.DataFrame) -> None:
    """Two gradient stat cards — total debits and total credits."""
    type_col = _find_column(filtered, _TYPE_ALIASES)
    amount_col = _find_column(filtered, _AMOUNT_ALIASES)

    total_debit = 0.0
    total_credit = 0.0

    if type_col and amount_col:
        type_lower = filtered[type_col].astype(str).str.strip().str.lower()
        amounts = pd.to_numeric(filtered[amount_col], errors="coerce").fillna(0)
        total_debit = float(amounts[type_lower.isin({"debit", "dr", "withdrawal"})].sum())
        total_credit = float(amounts[type_lower.isin({"credit", "cr", "deposit"})].sum())

    html(
        f"""
        <div class="mm-pad">
          <div class="mm-stat-cards">
            <div class="mm-stat-card">
              <div class="mm-stat-card__label">Total Debits</div>
              <div class="mm-stat-card__value">\u20b9{total_debit:,.2f}</div>
            </div>
            <div class="mm-stat-card mm-stat-card--credit">
              <div class="mm-stat-card__label">Total Credits</div>
              <div class="mm-stat-card__value">\u20b9{total_credit:,.2f}</div>
            </div>
          </div>
        </div>
        """
    )


def _render_filters_and_table(df: pd.DataFrame) -> None:
    """Category / type / date / amount filters, then the data table."""
    filtered = df.copy()

    # --- filter controls --------------------------------------------------
    filter_cols = st.columns([2, 1, 2, 2], gap="medium")

    # 1. Category multiselect
    with filter_cols[0]:
        if "predicted_category" in df.columns:
            categories = sorted(df["predicted_category"].dropna().unique())
            selected_cats = st.multiselect(
                "Category", categories, default=categories, key="ul_cat",
            )
            if selected_cats:
                filtered = filtered[filtered["predicted_category"].isin(selected_cats)]

    # 2. Debit / Credit toggle
    type_col = _find_column(df, _TYPE_ALIASES)
    with filter_cols[1]:
        if type_col:
            types = sorted(df[type_col].dropna().unique())
            selected_types = st.multiselect(
                "Type", types, default=types, key="ul_type",
            )
            if selected_types:
                filtered = filtered[filtered[type_col].isin(selected_types)]

    # 3. Date range picker
    date_col = _find_column(df, _DATE_ALIASES)
    with filter_cols[2]:
        if date_col:
            dates = pd.to_datetime(df[date_col], errors="coerce")
            valid_dates = dates.dropna()
            if not valid_dates.empty:
                min_d, max_d = valid_dates.min().date(), valid_dates.max().date()
                date_range = st.date_input(
                    "Date range",
                    value=(min_d, max_d),
                    min_value=min_d,
                    max_value=max_d,
                    key="ul_date",
                )
                if isinstance(date_range, (list, tuple)) and len(date_range) == 2:
                    ts = pd.to_datetime(filtered[date_col], errors="coerce")
                    filtered = filtered[
                        ts.between(pd.Timestamp(date_range[0]), pd.Timestamp(date_range[1]))
                    ]

    # 4. Amount range slider
    amount_col = _find_column(df, _AMOUNT_ALIASES)
    with filter_cols[3]:
        if amount_col:
            amounts = pd.to_numeric(df[amount_col], errors="coerce").dropna()
            if not amounts.empty:
                min_a, max_a = float(amounts.min()), float(amounts.max())
                if min_a < max_a:
                    amt_range = st.slider(
                        "Amount range",
                        min_value=min_a,
                        max_value=max_a,
                        value=(min_a, max_a),
                        key="ul_amt",
                    )
                    filtered = filtered[
                        pd.to_numeric(filtered[amount_col], errors="coerce")
                        .between(amt_range[0], amt_range[1])
                    ]

    # --- KPI cards (computed from filtered view) --------------------------
    _render_kpi_cards(filtered)

    # --- Data table -------------------------------------------------------
    st.dataframe(filtered, use_container_width=True, hide_index=True)


def _render_whats_next() -> None:
    html(
        """
        <div class="mm-pad">
          <div class="mm-next-card">
            <div class="mm-next-card__title">🚀 What's next?</div>
            <p>
              Head to your <a href="?page=dashboard" target="_self">Dashboard</a>
              to see spending trends, category breakdowns, and budget-vs-actual
              charts powered by your uploaded data.
            </p>
            <p>
              Categories look off? Re-upload a corrected CSV or try a different
              statement — the ML model improves with clearer transaction
              descriptions.
            </p>
          </div>
        </div>
        """
    )


def _render_security_note() -> None:
    html(
        """
        <div class="mm-pad" style="padding-bottom:48px">
          <div class="mm-security">
            <span class="mm-security__icon">🔒</span>
            <p class="mm-security__text">
              Your statement is processed locally in this session and is
              <strong>not stored in any database</strong> or shared with third
              parties. Data exists only in your active browser session and is
              cleared when you close the tab or upload a new file.
            </p>
          </div>
        </div>
        """
    )


# ---------------------------------------------------------------------------
# Page states
# ---------------------------------------------------------------------------
def _render_upload_state() -> None:
    """No data loaded — show the file uploader."""
    uploaded = st.file_uploader(
        "Upload your bank or UPI statement",
        type=["pdf", "csv"],
        key="ul_file",
        help="Accepted formats: text-based PDF bank statements, PhonePe CSV exports, or any transaction CSV with a description and amount column.",
    )

    if uploaded is not None:
        raw = uploaded.getvalue()
        name = uploaded.name.lower()

        with st.spinner("Processing your statement…"):
            try:
                if name.endswith(".pdf"):
                    df = _process_pdf(raw)
                    df = _categorize(df)
                elif name.endswith(".csv"):
                    # categorize_csv handles smart reading + categorization
                    df = _process_csv(raw)
                    df = _apply_low_confidence_fallback(df)
                else:
                    st.error("Unsupported file type. Please upload a PDF or CSV.")
                    return

                st.session_state[_SESSION_KEY] = df
                st.rerun()

            except ValueError as exc:
                st.error(f"⚠️ Could not process your file: {exc}")
            except Exception:
                st.error(
                    "⚠️ Something went wrong while processing your file. "
                    "Please make sure it's a valid bank or UPI statement and try again."
                )

    _render_security_note()


def _render_loaded_state() -> None:
    """Data already in session — show filters, table, KPIs, and guidance."""
    df: pd.DataFrame = st.session_state[_SESSION_KEY]

    html(
        f"""
        <div class="mm-pad">
          <div class="mm-loaded-banner">
            <span class="mm-loaded-banner__text">
              ✅ {len(df)} transactions loaded and categorized
            </span>
          </div>
        </div>
        """
    )

    if st.button("↻ Upload a new file", key="ul_clear"):
        st.session_state.pop(_SESSION_KEY, None)
        st.rerun()

    _render_filters_and_table(df)
    _render_whats_next()
    _render_security_note()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def render() -> None:
    """Upload & Analyze page."""
    render_navbar()
    _render_header()

    if st.session_state.get(_SESSION_KEY) is not None:
        _render_loaded_state()
    else:
        _render_upload_state()

    html('<div style="height:40px"></div>')

