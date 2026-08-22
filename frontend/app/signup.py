"""Signup page. Hook the submit handler up to your existing auth service."""

import streamlit as st

from frontend.components.footer import render_footer
from frontend.components.navbar import render_navbar
from frontend.utils.ui import goto, html
from src.auth.auth_service import signup


def render() -> None:
    render_navbar()
    html(
        """
        <div class="mm-section" style="padding-bottom:20px">
          <div class="mm-center">
            <span class="mm-eyebrow">Get started</span>
            <h2 class="mm-h2" style="margin-top:12px">Create your <span class="mm-grad">MoneyMind AI</span> account</h2>
          </div>
        </div>
        """
    )
    st.markdown("""
    <style>
    /* Add space between the input fields and the buttons */
    div[data-testid="stButton"] {
        margin-top: 25px !important;
    }

    /* Keep the two buttons visually aligned */
    div[data-testid="stButton"] button {
        min-height: 55px !important;
    }
    </style>
    """, unsafe_allow_html=True)

    left, center, right = st.columns([1, 1.2, 1])
    with center:
        username = st.text_input("Username")
        email = st.text_input("Email")
        password = st.text_input("Password", type="password")
        st.markdown("<div style='height: 50px;'></div>", unsafe_allow_html=True)
        if st.button("Create Account", key="signup_submit"):
            if not username or not email or not password:
                st.warning("Please fill in all fields.")
            else:
                try:
                    st.session_state["user"] = signup(username, email, password)
                    st.success(f"Welcome, {username}! Account created.")
                    goto("dashboard")
                except ValueError as exc:
                    st.error(str(exc))

        # Gap between the two buttons
        st.markdown(
            "<div style='height: 15px;'></div>",
            unsafe_allow_html=True
        )

        if st.button("I already have an account", key="to_login"):
            goto("login")

    render_footer()
