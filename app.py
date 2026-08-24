
import sys
from pathlib import Path

import streamlit as st

sys.path.append(str(Path(__file__).resolve().parent))

from frontend.utils.ui import inject_base_styles, sync_page_from_query  
from frontend.views import dashboard, landing, login, signup, upload  
from src.database.create_table import initialize_database

initialize_database()

st.set_page_config(
    page_title="MoneyMind AI — Understand Your Money",
    page_icon="app/assets/moneymind-logo.png",
    layout="wide",
    initial_sidebar_state="collapsed",
)

inject_base_styles()

PAGES = {
    "landing": landing.render,
    "login": login.render,
    "signup": signup.render,
    "dashboard": dashboard.render,
    "upload": upload.render,
}

page = sync_page_from_query()
PAGES.get(page, landing.render)()
