import streamlit as st


def create_session(user):
    st.session_state["logged_in"] = True
    st.session_state["user_id"] = user.id
    st.session_state["username"] = user.username
    st.session_state["email"] = user.email


def logout():
    st.session_state.clear()


def is_authenticated():
    return st.session_state.get(
        "logged_in",
        False
    )