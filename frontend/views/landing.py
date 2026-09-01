"""Landing page — marketing only. No forms, no uploads, no Streamlit inputs."""

from ..components.ai_coach_preview import render_ai_coach, render_anomaly
from ..components.charts import render_analytics_preview
from ..components.features import render_features, render_value_props
from ..components.footer import render_footer
from ..components.hero import render_hero
from ..components.navbar import render_navbar
from ..components.sections import render_final_cta, render_how_it_works, render_wellness


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
