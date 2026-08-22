"""Login page. Hook the submit handler up to your existing auth service."""

import streamlit as st

from frontend.components.footer import render_footer
from frontend.components.navbar import render_navbar
from src.auth.auth_service import login
from frontend.utils.ui import goto, html


def render() -> None:
    render_navbar()
    html(
        """
        <div class="mm-section" style="padding-bottom:20px">
          <div class="mm-center">
            <span class="mm-eyebrow">Welcome back</span>
            <h2 class="mm-h2" style="margin-top:12px">Log in to MoneyMind AI</h2>
          </div>
        </div>
        """
    )

    left, center, right = st.columns([1, 1.2, 1])
    with center:
        email = st.text_input("Email", placeholder="you@example.com")
        password = st.text_input("Password", type="password", placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022")
        st.markdown("<br>" ,  unsafe_allow_html=True)
        if st.button("Log In", key="login_submit"):
            if not email or not password:
                st.warning("Please enter your email and password.")
            else:
                try:
                    st.session_state["user"] = login(email, password)
                    st.success("Logged in. Redirecting to your dashboard\u2026")
                    goto("dashboard")
                except ValueError as exc:
                    st.error(str(exc))
        st.markdown("<br>" ,  unsafe_allow_html=True)
        if st.button("Create an account instead", key="to_signup"):
            goto("signup")

    render_footer()
