"""Interactive Plotly previews, styled with the MoneyMind AI palette."""

import plotly.graph_objects as go
import streamlit as st

from ..utils.ui import html

NAVY = "#0b1f3a"
TEAL = "#10b981"
LAVENDER = "#7c6cf0"
MUTED = "#5b6b82"
GRID = "#eef1f7"

MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"]
SPENDING = [18200, 19450, 17800, 20100, 19800, 21400]
FORECAST_MONTHS = ["Aug", "Sep", "Oct", "Nov"]
FORECAST = [21400, 22100, 22850, 22300]
CATEGORIES = ["Food", "Shopping", "Transport", "Bills", "Entertainment"]
CATEGORY_VALUES = [6420, 5180, 3240, 4900, 1660]
BUDGET = [6000, 4500, 3500, 5000, 2000]


def _base_layout(fig: go.Figure, height: int = 300) -> go.Figure:
    fig.update_layout(
        height=height,
        margin=dict(l=10, r=10, t=34, b=10),
        paper_bgcolor="white",
        plot_bgcolor="white",
        font=dict(family="Plus Jakarta Sans, sans-serif", color=MUTED, size=12),
        title=dict(font=dict(color=NAVY, size=15)),
        hoverlabel=dict(bgcolor=NAVY, font_color="white", bordercolor=NAVY),
        showlegend=False,
    )
    fig.update_xaxes(showgrid=False, linecolor=GRID)
    fig.update_yaxes(gridcolor=GRID, zeroline=False)
    return fig


def spending_trend_chart() -> go.Figure:
    fig = go.Figure(
        go.Scatter(
            x=MONTHS, y=SPENDING, mode="lines+markers", line_shape="spline",
            line=dict(color=TEAL, width=3), marker=dict(size=8, color=NAVY),
            fill="tozeroy", fillcolor="rgba(16,185,129,0.10)",
            hovertemplate="%{x}: \u20b9%{y:,.0f}<extra></extra>",
        )
    )
    fig.update_layout(title="Spending Trend")
    return _base_layout(fig)


def category_donut_chart() -> go.Figure:
    fig = go.Figure(
        go.Pie(
            labels=CATEGORIES, values=CATEGORY_VALUES, hole=0.62,
            marker=dict(colors=[NAVY, TEAL, LAVENDER, "#3d6f9e", "#9ff0cf"], line=dict(color="white", width=3)),
            textinfo="percent", hovertemplate="%{label}: \u20b9%{value:,.0f}<extra></extra>",
        )
    )
    fig.update_layout(title="Expense Categories", showlegend=True,
                      legend=dict(orientation="h", y=-0.12, font=dict(size=11)))
    return _base_layout(fig)


def budget_vs_actual_chart() -> go.Figure:
    fig = go.Figure()
    fig.add_bar(x=CATEGORIES, y=BUDGET, name="Budget", marker_color="#dfe6f1",
                hovertemplate="Budget: \u20b9%{y:,.0f}<extra></extra>")
    fig.add_bar(x=CATEGORIES, y=CATEGORY_VALUES, name="Actual", marker_color=TEAL,
                hovertemplate="Actual: \u20b9%{y:,.0f}<extra></extra>")
    fig.update_layout(title="Budget vs Actual", barmode="group", showlegend=True,
                      legend=dict(orientation="h", y=-0.14, font=dict(size=11)))
    return _base_layout(fig)


def forecast_chart() -> go.Figure:
    fig = go.Figure()
    fig.add_scatter(x=MONTHS, y=SPENDING, mode="lines+markers", name="Actual",
                    line=dict(color=NAVY, width=3, shape="spline"), marker=dict(size=7),
                    hovertemplate="%{x}: \u20b9%{y:,.0f}<extra></extra>")
    fig.add_scatter(x=FORECAST_MONTHS, y=FORECAST, mode="lines+markers", name="Forecast",
                    line=dict(color=LAVENDER, width=3, dash="dot", shape="spline"), marker=dict(size=7),
                    hovertemplate="%{x} (forecast): \u20b9%{y:,.0f}<extra></extra>")
    fig.update_layout(title="Forecast", showlegend=True,
                      legend=dict(orientation="h", y=-0.14, font=dict(size=11)))
    return _base_layout(fig)


def render_analytics_preview() -> None:
    """'See Your Money Clearly' — four interactive Plotly charts in a 2x2 grid."""
    html(
        """
        <section class="mm-section mm-reveal" id="analytics">
          <div class="mm-center">
            <span class="mm-eyebrow">Interactive analytics</span>
            <h2 class="mm-h2" style="margin-top:14px">See Your Money <span class="mm-grad">Clearly</span></h2>
            <p class="mm-lead">Hover any chart \u2014 these are live, interactive views of a sample MoneyMind AI profile.</p>
          </div>
        </section>
        """
    )
    config = {"displayModeBar": False}
    left, right = st.columns(2, gap="large")
    with left:
        st.plotly_chart(spending_trend_chart(), width="stretch", config=config)
        st.plotly_chart(budget_vs_actual_chart(), width="stretch", config=config)
    with right:
        st.plotly_chart(category_donut_chart(), width="stretch", config=config)
        st.plotly_chart(forecast_chart(), width="stretch", config=config)
