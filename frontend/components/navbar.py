"""Custom HTML/CSS navbar — no Streamlit sidebar, no default nav widgets."""

from ..utils.ui import html, logo_data_uri


def render_navbar(active_page: str = "landing") -> None:
    html(
        f"""
        <div class="mm-nav">
          <a class="mm-nav__logo" href="?page=landing" target="_self">
            <img src="{logo_data_uri()}" alt="MoneyMind AI logo" />
          </a>
          <nav class="mm-nav__links">
            <a href="?page=dashboard" target="_self" class="{ 'active' if active_page == 'dashboard' else '' }">Dashboard</a>
            <a href="?page=upload" target="_self" class="{ 'active' if active_page == 'upload' else '' }">Upload & Analyze</a>
            <a href="#" target="_self">Insights</a>
            <a href="#" target="_self">Budget</a>
          </nav>
          <div class="mm-nav__cta">
            <div class="mm-avatar">PA</div>
          </div>
        </div>
        """
    )
