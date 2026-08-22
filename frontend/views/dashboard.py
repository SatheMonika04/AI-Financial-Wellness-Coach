"""Placeholder dashboard state — plug your real analytics/ML views in here."""

import streamlit as st

from ..components.charts import (
    budget_vs_actual_chart,
    category_donut_chart,
    forecast_chart,
    spending_trend_chart,
)
from ..components.navbar import render_navbar
from ..utils.ui import html


def render() -> None:
    render_navbar()
    html(
        """
        <div class="mm-section" style="padding-bottom:24px">
          <span class="mm-eyebrow">Dashboard</span>
          <h2 class="mm-h2" style="margin-top:12px">Your financial overview</h2>
          <p class="mm-lead">Sample data \u2014 connect this state to your parsed statements and ML pipeline.</p>
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
    html('<div style="height:60px"></div>')
