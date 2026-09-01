"""Minimal footer."""

from ..utils.ui import html, logo_data_uri


def render_footer() -> None:
    html(
        f"""
        <footer class="mm-footer">
          <div>
            <img src="{logo_data_uri()}" alt="MoneyMind AI logo" />
            <p>AI-powered financial wellness for smarter everyday decisions.</p>
          </div>
          <div>
            <h5>Product</h5>
            <a href="#features">Features</a>
            <a href="#ai-coach">AI Coach</a>
            <a href="#how-it-works">How It Works</a>
          </div>
          <div>
            <h5>Account</h5>
            <a href="?page=login" target="_self">Login</a>
            <a href="?page=signup" target="_self">Get Started</a>
          </div>
        </footer>
        <div class="mm-copy">\u00a9 2026 MoneyMind AI. All rights reserved.</div>
        """
    )
