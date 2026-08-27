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
_PAGINATION_KEY = "ul_page"
ROWS_PER_PAGE = 10


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
    if "category_confidence" in result.columns:
        mask = result["category_confidence"] < LOW_CONFIDENCE_THRESHOLD
        result.loc[mask, "predicted_category"] = "Uncategorized"
    return result


def _apply_low_confidence_fallback(df: pd.DataFrame) -> pd.DataFrame:
    """Mark low-confidence predictions as Uncategorized."""
    if "category_confidence" in df.columns:
        mask = df["category_confidence"] < LOW_CONFIDENCE_THRESHOLD
        df.loc[mask, "predicted_category"] = "Uncategorized"
    return df


def _get_category_color(cat: str) -> tuple[str, str]:
    """Return (bg_color, text_color) based on category name string hash."""
    colors = [
        ("#fdf0dd", "#c9772f"), # warm orange
        ("#eef2f9", "#0b1f3a"), # navy blue
        ("#f3e8ff", "#6b21a8"), # purple
        ("#e8f8f1", "#0e9f76"), # mint green
        ("#ffe4e6", "#e11d48"), # rose
        ("#e0f2fe", "#0284c7"), # light blue
        ("#fef3c7", "#d97706"), # amber
    ]
    idx = sum(ord(c) for c in cat) % len(colors)
    return colors[idx]


# ---------------------------------------------------------------------------
# UI sections
# ---------------------------------------------------------------------------
def _render_header() -> None:
    html(
        """
        <div class="mm-header-new">
          <span class="mm-eyebrow-new">Upload & Analyze</span>
          <h1 class="mm-h1-new">Understand your spending</h1>
          <p class="mm-lead-new">
            Upload a bank or PhonePe statement as <strong>PDF</strong> or
            <strong>CSV</strong> to get instant, AI-categorized transaction
            insights — no spreadsheets, no manual tagging.
          </p>
        </div>
        """
    )


def _render_kpi_cards(filtered: pd.DataFrame) -> None:
    """Three stat cards — total debits, total credits, and transaction count."""
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
          <div class="mm-kpi-row">
            <div class="mm-kpi-card mm-kpi-card--debit">
              <div class="mm-kpi-head">
                 <span>TOTAL DEBITS</span>
                 <div class="mm-kpi-icon mm-icon-red">↘</div>
              </div>
              <div class="mm-kpi-value">₹{total_debit:,.2f}</div>
            </div>
            <div class="mm-kpi-card mm-kpi-card--credit">
              <div class="mm-kpi-head">
                 <span>TOTAL CREDITS</span>
                 <div class="mm-kpi-icon mm-icon-green">↗</div>
              </div>
              <div class="mm-kpi-value">₹{total_credit:,.2f}</div>
            </div>
            <div class="mm-kpi-card mm-kpi-card--txns">
              <div class="mm-kpi-head">
                 <span>TRANSACTIONS</span>
                 <div class="mm-kpi-icon mm-icon-blue">🧾</div>
              </div>
              <div class="mm-kpi-value">{len(filtered)}</div>
            </div>
          </div>
        </div>
        """
    )


def _filtered_state_view(df: pd.DataFrame) -> pd.DataFrame:
    """Project the current widget state for summary cards rendered before widgets."""
    filtered = df.copy()
    selected_cats = st.session_state.get("ul_cat", [])
    if selected_cats and "predicted_category" in filtered.columns:
        filtered = filtered[filtered["predicted_category"].isin(selected_cats)]

    type_col = _find_column(df, _TYPE_ALIASES)
    selected_types = st.session_state.get("ul_type", [])
    if selected_types and type_col:
        filtered = filtered[filtered[type_col].isin(selected_types)]

    date_col = _find_column(df, _DATE_ALIASES)
    date_range = st.session_state.get("ul_date", ())
    if date_col and isinstance(date_range, (list, tuple)) and len(date_range) == 2:
        dates = pd.to_datetime(filtered[date_col], errors="coerce")
        filtered = filtered[dates.between(pd.Timestamp(date_range[0]), pd.Timestamp(date_range[1]))]

    amount_col = _find_column(df, _AMOUNT_ALIASES)
    amount_range = st.session_state.get("ul_amt")
    if amount_col and isinstance(amount_range, (list, tuple)) and len(amount_range) == 2:
        amounts = pd.to_numeric(filtered[amount_col], errors="coerce")
        filtered = filtered[amounts.between(amount_range[0], amount_range[1])]
    return filtered


def _render_filters_and_table(df: pd.DataFrame) -> None:
    """Category / type / date / amount filters, then the custom data table."""
    filtered = df.copy()

    # --- filter controls --------------------------------------------------
    # Using native Streamlit columns
    filter_cols = st.columns([2, 1, 2, 2], gap="medium")

    # 1. Category multiselect
    with filter_cols[0]:
        if "predicted_category" in df.columns:
            categories = sorted(df["predicted_category"].dropna().unique())
            selected_cats = st.multiselect(
                "Category", categories, default=[], placeholder="All categories", key="ul_cat",
            )
            if selected_cats:
                filtered = filtered[filtered["predicted_category"].isin(selected_cats)]

    # 2. Debit / Credit toggle
    type_col = _find_column(df, _TYPE_ALIASES)
    with filter_cols[1]:
        if type_col:
            types = sorted(df[type_col].dropna().unique())
            selected_types = st.multiselect(
                "Type", types, default=[], placeholder="Debit / Credit", key="ul_type",
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
                    value=(),
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
                        label_visibility="collapsed"
                    )
                    filtered = filtered[
                        pd.to_numeric(filtered[amount_col], errors="coerce")
                        .between(amt_range[0], amt_range[1])
                    ]

    # --- Data table -------------------------------------------------------
    _render_custom_table_with_pagination(filtered)


def _render_custom_table_with_pagination(df: pd.DataFrame) -> None:
    if _PAGINATION_KEY not in st.session_state:
        st.session_state[_PAGINATION_KEY] = 1

    total_rows = len(df)
    total_pages = max(1, (total_rows + ROWS_PER_PAGE - 1) // ROWS_PER_PAGE)

    # Reset page if out of bounds (e.g. after filtering)
    if st.session_state[_PAGINATION_KEY] > total_pages:
        st.session_state[_PAGINATION_KEY] = total_pages
    if st.session_state[_PAGINATION_KEY] < 1:
        st.session_state[_PAGINATION_KEY] = 1

    current_page = st.session_state[_PAGINATION_KEY]
    start_idx = (current_page - 1) * ROWS_PER_PAGE
    end_idx = min(start_idx + ROWS_PER_PAGE, total_rows)

    page_df = df.iloc[start_idx:end_idx]

    rows_html = ""
    for _, row in page_df.iterrows():
        # format date
        date_col = _find_column(df, _DATE_ALIASES)
        date_str = str(row[date_col])[:10] if date_col and pd.notna(row[date_col]) else ""
        try:
             date_obj = pd.to_datetime(date_str)
             date_str = date_obj.strftime("%d %b %Y")
        except:
             pass
             
        desc_col = _find_column(df, _DESC_ALIASES)
        desc_str = str(row[desc_col]) if desc_col else ""
        
        type_col = _find_column(df, _TYPE_ALIASES)
        type_str = str(row[type_col]) if type_col else "Unknown"
        is_credit = type_str.strip().lower() in {"credit", "cr", "deposit"}
        
        cat_str = str(row.get("predicted_category", "Uncategorized"))
        
        amount_col = _find_column(df, _AMOUNT_ALIASES)
        amount_val = pd.to_numeric(row[amount_col], errors="coerce") if amount_col else 0.0
        if pd.isna(amount_val): amount_val = 0.0
        
        amount_prefix = "+" if is_credit else "-"
        amount_class = "amount-credit" if is_credit else "amount-debit"
        type_class = "type-credit" if is_credit else "type-debit"
        
        cat_bg, cat_color = _get_category_color(cat_str)
        
        rows_html += f"""
        <tr>
          <td style="color: var(--muted); font-size: 13.5px;">{date_str}</td>
          <td class="mm-desc-cell">{desc_str}</td>
          <td class="{type_class}">{type_str.capitalize()}</td>
          <td><span class="mm-cat-pill" style="background: {cat_bg}; color: {cat_color};">{cat_str}</span></td>
          <td class="right {amount_class}">{amount_prefix}₹{abs(amount_val):,.2f}</td>
        </tr>
        """
        
    if not rows_html:
        rows_html = '<tr><td colspan="5" style="text-align:center; color: var(--muted);">No transactions match your filters.</td></tr>'

    table_html = f"""
    <div class="mm-pad">
      <div class="mm-table-container">
        <table class="mm-table">
          <thead>
            <tr>
              <th>DATE</th>
              <th>DESCRIPTION</th>
              <th>TYPE</th>
              <th>CATEGORY</th>
              <th class="right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {rows_html}
          </tbody>
        </table>
      </div>
    </div>
    """
    html(table_html)
    
    # Pagination controls native layout
    col1, col2, col3, col4, col5 = st.columns([5, 1, 1, 1, 5])
    with col1:
        st.markdown(f"<div style='color: var(--muted); padding-top: 8px; font-size: 14px;'>Showing {min(start_idx+1, total_rows)}–{end_idx} of {total_rows}</div>", unsafe_allow_html=True)
    with col2:
        if st.button("❮", disabled=(current_page == 1), key="pag_prev"):
            st.session_state[_PAGINATION_KEY] -= 1
            st.rerun()
    with col3:
        st.markdown(f"<div style='text-align: center; padding-top: 8px; font-weight: 600; color: var(--navy);'>{current_page} / {total_pages}</div>", unsafe_allow_html=True)
    with col4:
        if st.button("❯", disabled=(current_page == total_pages), key="pag_next"):
            st.session_state[_PAGINATION_KEY] += 1
            st.rerun()


def _render_whats_next() -> None:
    html(
        """
        <div class="mm-pad">
          <div class="mm-next-card">
            <div class="mm-next-card__title">
              <div style="background: var(--navy); color: white; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; margin-right: 8px;">→</div>
              What's next: open your Dashboard
            </div>
            <p>
              See spending trends, category breakdowns, and budget-vs-actual
              charts powered by the statement you just uploaded.
            </p>
          </div>
          <p style="font-size: 12.5px; color: var(--muted); margin-top: 16px;">
            Categories look off? Re-upload a corrected CSV or try a different
            statement — the model performs better with clearer transaction
            descriptions.
          </p>
        </div>
        """
    )


def _render_security_note() -> None:
    html(
        """
        <p style="text-align: center; font-size: 13px; color: var(--muted); margin-top: 32px; max-width: 900px; margin-inline: auto;">
          🔒 Your statement is processed locally in this session and is
          not stored in any database or shared with third parties.
        </p>
        """
    )


# ---------------------------------------------------------------------------
# Page states
# ---------------------------------------------------------------------------
def _render_upload_state() -> None:
    """No data loaded — show the visually custom file uploader."""
    
    # CSS creates the visual dropzone styling directly on stFileUploaderDropzone
    uploaded = st.file_uploader(
        "Upload your bank or UPI statement",
        type=["pdf", "csv"],
        key="ul_file",
        label_visibility="collapsed"
    )

    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("Use a sample statement", use_container_width=True, type="secondary", key="ul_sample"):
            sample_path = Path(__file__).resolve().parents[2] / "Test Assets" / "PhonePe_Statement_Aug2025_Aug2026.csv"
            if sample_path.exists():
                with st.spinner("Analyzing the sample statement…"):
                    df = _process_csv(sample_path.read_bytes())
                    st.session_state[_SESSION_KEY] = _apply_low_confidence_fallback(df)
                st.rerun()
            st.warning("No sample statement is currently configured in this environment.")

    if uploaded is not None:
        raw = uploaded.getvalue()
        name = uploaded.name.lower()

        with st.spinner("Analyzing your statement…"):
            try:
                if name.endswith(".pdf"):
                    df = _process_pdf(raw)
                    df = _categorize(df)
                elif name.endswith(".csv"):
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

    col1, col2 = st.columns([3, 1])
    with col1:
        html(
            f"""
            <div class="mm-loaded-banner">
              <span class="mm-loaded-banner__text">
                ✓ {len(df)} transactions loaded and categorized
              </span>
            </div>
            """
        )
    with col2:
        if st.button("↻ Upload a new file", use_container_width=True):
            st.session_state.pop(_SESSION_KEY, None)
            st.rerun()

    _render_kpi_cards(_filtered_state_view(df))
    _render_filters_and_table(df)
    _render_whats_next()
    _render_security_note()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def render() -> None:
    """Upload & Analyze page."""
    render_navbar(active_page="upload")
    _render_header()

    if st.session_state.get(_SESSION_KEY) is not None:
        _render_loaded_state()
    else:
        _render_upload_state()

    html('<div style="height:80px"></div>')
