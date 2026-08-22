"""Small helpers shared by every MoneyMind AI page/component."""

import base64
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

APP_DIR = Path(__file__).resolve().parent.parent
CSS_FILE = APP_DIR / "styles" / "main.css"
LOGO_FILE = APP_DIR / "assets" / "moneymind-logo.png"


def load_css() -> str:
    """Read the stylesheet fresh on every run so CSS edits show up on save."""
    return CSS_FILE.read_text(encoding="utf-8")


@st.cache_data(show_spinner=False)
def logo_data_uri() -> str:
    """Return the MoneyMind AI logo as a base64 data URI so it can be used inside raw HTML."""
    if not LOGO_FILE.exists():
        return ""
    encoded = base64.b64encode(LOGO_FILE.read_bytes()).decode()
    return f"data:image/png;base64,{encoded}"


def inject_base_styles() -> None:
    """Fonts + CSS + tiny JS (sticky navbar, scroll reveal). Call once per page render."""
    st.html(
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
        f"<style>{load_css()}</style>"
    )
    components.html(
        """
        <script>
        (function () {
          const doc = window.parent.document;

          // Sticky navbar shadow on scroll
          const nav = doc.querySelector('.mm-nav');
          if (nav && !nav.dataset.bound) {
            nav.dataset.bound = '1';
            const scroller = doc.querySelector('section.main') || window.parent;
            (scroller.addEventListener ? scroller : window.parent).addEventListener('scroll', function (e) {
              const y = (e.target.scrollTop !== undefined) ? e.target.scrollTop : window.parent.scrollY;
              nav.classList.toggle('is-stuck', y > 12);
            });
          }

          // Smooth-scroll for in-page anchor links rendered inside Streamlit markdown
          doc.querySelectorAll('a[href^="#"]').forEach(function (a) {
            if (a.dataset.smooth) return;
            a.dataset.smooth = '1';
            a.addEventListener('click', function (ev) {
              const target = doc.getElementById(a.getAttribute('href').slice(1));
              if (target) { ev.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            });
          });
        })();
        </script>
        """,
        height=0,
    )


def html(markup: str) -> None:
    """Shorthand for rendering raw HTML blocks (st.html keeps <style>/attributes intact)."""
    st.html(markup)


def goto(page: str) -> None:
    """Change the active page stored in Streamlit session state."""
    st.session_state["page"] = page
    st.query_params["page"] = page
    st.rerun()


def sync_page_from_query() -> str:
    """Keep session state in sync with ?page=... links used by the HTML navbar/buttons."""
    valid = {"landing", "login", "signup", "dashboard"}
    st.session_state.setdefault("page", "landing")
    requested = st.query_params.get("page")
    if requested in valid and requested != st.session_state["page"]:
        st.session_state["page"] = requested
    return st.session_state["page"]
