"""Landing page — marketing only. No forms, no uploads, no Streamlit inputs."""

from frontend.components.ai_coach_preview import render_ai_coach, render_anomaly
from frontend.components.charts import render_analytics_preview
from frontend.components.features import render_features, render_value_props
from frontend.components.footer import render_footer
from frontend.components.hero import render_hero
from frontend.components.navbar import render_navbar
from frontend.components.sections import render_final_cta, render_how_it_works, render_wellness


def render() -> None:
    render_navbar()
    render_hero()
    render_value_props()
    render_features()
    render_analytics_preview()
    render_ai_coach()
    render_anomaly()
    render_how_it_works()
    render_wellness()
    render_final_cta()
    render_footer()
