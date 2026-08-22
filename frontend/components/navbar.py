"""Custom HTML/CSS navbar — no Streamlit sidebar, no default nav widgets."""

from ..utils.ui import html, logo_data_uri


def render_navbar() -> None:
    html(
        f"""
        <div class="mm-nav">
          <a class="mm-nav__logo" href="?page=landing" target="_self">
            <img src="{logo_data_uri()}" alt="MoneyMind AI logo" />
          </a>
          <nav class="mm-nav__links">
            <a href="?page=landing" target="_self">Home</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#ai-coach">AI Coach</a>
          </nav>
          <div class="mm-nav__cta">
            <a class="mm-btn mm-btn--ghost" href="?page=login" target="_self">Login</a>
            <a class="mm-btn mm-btn--primary" href="?page=signup" target="_self">Get Started</a>
          </div>
        </div>
        """
    )
