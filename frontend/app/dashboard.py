"""Dashboard wired to the uploaded transaction session state."""

from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from frontend.components.charts import (
    budget_vs_actual_chart,
    category_donut_chart,
    forecast_chart,
    spending_trend_chart,
)
from frontend.components.navbar import render_navbar
from frontend.utils.ui import html


def _series_from_df(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame(columns=["transaction_date", "predicted_category", "amount", "transaction"])
    cleaned = df.copy()
    cleaned["transaction_date"] = pd.to_datetime(cleaned.get("transaction_date"), errors="coerce")
    cleaned["amount"] = pd.to_numeric(cleaned.get("amount"), errors="coerce").fillna(0.0)
    cleaned["transaction"] = cleaned.get("transaction", pd.Series([None] * len(cleaned), index=cleaned.index)).astype(str)
    category_col = "predicted_category" if "predicted_category" in cleaned.columns else "category"
    cleaned["predicted_category"] = cleaned.get(category_col, pd.Series(["Uncategorized"] * len(cleaned), index=cleaned.index))
    return cleaned.dropna(subset=["transaction_date"]).reset_index(drop=True)


def _render_sample_preview() -> None:
    html(
        """
        <div class="mm-pad">
          <div class="mm-next-card">
            <div class="mm-next-card__title">📊 Sample preview</div>
            <p>
              This preview shows example charts only. Upload a real statement from the
              Upload &amp; Analyze page to replace it with your data.
            </p>
          </div>
        </div>
        """
    )
    config = {"displayModeBar": False}
    a, b = st.columns(2, gap="large")
    with a:
        st.plotly_chart(spending_trend_chart(), width="stretch", config=config)
        st.plotly_chart(budget_vs_actual_chart(), width="stretch", config=config)
    with b:
        st.plotly_chart(category_donut_chart(), width="stretch", config=config)
        st.plotly_chart(forecast_chart(), width="stretch", config=config)


def _render_real_dashboard(df: pd.DataFrame) -> None:
    frame = _series_from_df(df)
    if frame.empty:
        st.info("No valid uploaded transactions are available yet. Please upload a statement to populate this dashboard.")
        return

    debit_rows = frame[frame["transaction"].astype(str).str.lower().eq("debit")].copy()
    if debit_rows.empty:
        st.info("No debit transactions were detected in the uploaded data, so there is no spending trend to chart yet.")
        return

    monthly = debit_rows.groupby(debit_rows["transaction_date"].dt.to_period("M"), observed=False)["amount"].sum().sort_index()
    monthly_df = monthly.reset_index()
    monthly_df.columns = ["month", "amount"]
    monthly_df["month"] = monthly_df["month"].astype(str)

    category_totals = debit_rows.groupby("predicted_category", dropna=False)["amount"].sum().sort_values(ascending=False)
    category_labels = category_totals.index.astype(str).tolist()
    category_values = category_totals.tolist()
    if not category_values:
        st.info("Uploaded transactions are present, but no category totals were detected yet.")
        return

    budget_values = [max(float(value) * 1.15, float(value)) for value in category_values]

    fig_spending = go.Figure(
        data=[go.Scatter(x=monthly_df["month"], y=monthly_df["amount"], mode="lines+markers", line=dict(color="#10b981", width=3), marker=dict(size=8), fill="tozeroy", fillcolor="rgba(16,185,129,0.10)")]
    )
    fig_spending.update_layout(title="Spending Trend", xaxis_title="Month", yaxis_title="Amount (₹)", template="plotly_white")

    fig_category = go.Figure(data=[go.Pie(labels=category_labels, values=category_values, hole=0.55)])
    fig_category.update_layout(title="Expense Categories", template="plotly_white")

    fig_budget = go.Figure()
    fig_budget.add_bar(x=category_labels, y=budget_values, name="Budget", marker_color="#dfe6f1")
    fig_budget.add_bar(x=category_labels, y=category_values, name="Actual", marker_color="#10b981")
    fig_budget.update_layout(title="Budget vs Actual", barmode="group", template="plotly_white")

    config = {"displayModeBar": False}
    a, b = st.columns(2, gap="large")
    with a:
        st.plotly_chart(fig_spending, width="stretch", config=config)
        st.plotly_chart(fig_budget, width="stretch", config=config)
    with b:
        st.plotly_chart(fig_category, width="stretch", config=config)

    if len(monthly_df) >= 2:
        forecast_values = []
        for i in range(1, 4):
            forecast_values.append(float(monthly_df["amount"].tail(1).iloc[0]) * (1 + 0.04 * i))
        forecast_months = ["Next +1M", "Next +2M", "Next +3M"]
        fig_forecast = go.Figure()
        fig_forecast.add_scatter(x=monthly_df["month"], y=monthly_df["amount"], mode="lines+markers", name="Actual")
        fig_forecast.add_scatter(x=forecast_months, y=forecast_values, mode="lines+markers", name="Forecast", line=dict(dash="dot"))
        fig_forecast.update_layout(title="Forecast", template="plotly_white")
        st.plotly_chart(fig_forecast, width="stretch", config=config)


def render() -> None:
    render_navbar()
    html(
        """
        <div class="mm-section" style="padding-bottom:24px">
          <span class="mm-eyebrow">Dashboard</span>
          <h2 class="mm-h2" style="margin-top:12px">Your financial overview</h2>
        </div>
        """
    )

    uploaded_df = st.session_state.get("transactions_df")
    if uploaded_df is None or (isinstance(uploaded_df, pd.DataFrame) and uploaded_df.empty):
        st.info("No uploaded data is loaded yet. Head to the Upload & Analyze page to import a statement.")
        if st.button("Go to Upload & Analyze", key="dash_go_upload"):
            st.session_state["page"] = "upload"
            st.rerun()
        if st.button("Preview sample data", key="dash_preview_sample"):
            st.session_state["dashboard_preview"] = True
        if st.session_state.get("dashboard_preview"):
            _render_sample_preview()
        html('<div style="height:60px"></div>')
        return

    _render_real_dashboard(uploaded_df)
    html('<div style="height:60px"></div>')
