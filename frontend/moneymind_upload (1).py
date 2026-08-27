
from datetime import date

import pandas as pd
import streamlit as st

st.set_page_config(page_title="Upload & Analyze | MoneyMind AI", layout="wide")

NAVY = "#0F2C4C"
GREEN = "#14B87A"

CATEGORY_COLORS = {
    "Food & Dining": "#E8590C",
    "Groceries": "#2F9E44",
    "Transport": "#1971C2",
    "Shopping": "#9333EA",
    "Bills & Utilities": "#0E7490",
    "Entertainment": "#C2255C",
    "Health": "#0F766E",
    "Transfers": "#475569",
    "Income": "#15803D",
    "Other": "#64748B",
}

# ---------------------------------------------------------------- styling ----
st.markdown(
    f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

html, body, [class*="css"] {{ font-family: 'Plus Jakarta Sans', sans-serif; }}
.stApp {{ background: #FBFCFD; color: {NAVY}; }}
#MainMenu, footer, header {{ visibility: hidden; }}
.block-container {{ max-width: 1180px; padding-top: 2.5rem; padding-bottom: 4rem; }}

/* header */
.mm-header {{
  position: sticky; top: 0; z-index: 999; margin: -2.5rem -1rem 2.25rem;
  padding: .85rem 1.5rem; background: rgba(255,255,255,.85);
  backdrop-filter: blur(10px); border-bottom: 1px solid #E9EEF3;
  display: flex; align-items: center; gap: 1.75rem;
}}
.mm-brand {{ display:flex; align-items:center; gap:.6rem; font-weight:800; letter-spacing:-.02em; font-size:1.02rem; }}
.mm-nav {{ display:flex; gap:.35rem; font-size:.875rem; font-weight:600; }}
.mm-nav a {{ color:#5A6B7C; text-decoration:none; padding:.4rem .75rem; border-radius:8px; }}
.mm-nav a.active {{ color:{NAVY}; background:#EEF5F1; }}
.mm-avatar {{ margin-left:auto; width:34px; height:34px; border-radius:50%;
  background: linear-gradient(135deg, {NAVY}, {GREEN}); color:#fff; font-size:.78rem;
  font-weight:700; display:flex; align-items:center; justify-content:center; }}

/* hero */
.mm-eyebrow {{ text-transform:uppercase; letter-spacing:.14em; font-size:.72rem;
  font-weight:700; color:{GREEN}; margin-bottom:.6rem; }}
.mm-h1 {{ font-size:2.4rem; font-weight:800; letter-spacing:-.03em; margin:0 0 .6rem; }}
.mm-sub {{ color:#5A6B7C; font-size:1.02rem; max-width:56ch; margin:0; }}

/* upload zone */
[data-testid="stFileUploaderDropzone"] {{
  border: 1.5px dashed #CBD8E1 !important; border-radius: 18px !important;
  background: #fff !important; padding: 2.75rem 1.5rem !important;
  transition: all .18s ease; box-shadow: 0 1px 2px rgba(15,44,76,.04);
}}
[data-testid="stFileUploaderDropzone"]:hover {{
  border-color: {GREEN} !important;
  background: linear-gradient(180deg, rgba(20,184,122,.05), rgba(15,44,76,.03)) !important;
}}
[data-testid="stFileUploaderDropzone"] small {{ color:#7A8896 !important; }}
[data-testid="stFileUploaderDropzone"] button {{
  background: linear-gradient(135deg, {NAVY}, {GREEN}) !important; color:#fff !important;
  border:0 !important; border-radius:10px !important; font-weight:600 !important;
}}

/* cards */
.mm-card {{ background:#fff; border:1px solid #E9EEF3; border-radius:16px; padding:1.15rem 1.25rem;
  box-shadow:0 1px 2px rgba(15,44,76,.04); }}
.mm-note {{ display:flex; gap:.7rem; align-items:flex-start; background:#F4F7FA;
  border:1px solid #E9EEF3; border-radius:14px; padding:.9rem 1.05rem;
  color:#5A6B7C; font-size:.8rem; line-height:1.5; }}
.mm-success {{ display:flex; align-items:center; gap:.65rem; background:rgba(20,184,122,.08);
  border:1px solid rgba(20,184,122,.28); color:#0B6B47; border-radius:14px;
  padding:.8rem 1.1rem; font-weight:600; font-size:.9rem; }}

.mm-stat {{ position:relative; overflow:hidden; background:#fff; border:1px solid #E9EEF3;
  border-radius:18px; padding:1.3rem 1.4rem; box-shadow:0 1px 3px rgba(15,44,76,.05);
  transition:transform .18s ease, box-shadow .18s ease; }}
.mm-stat:hover {{ transform:translateY(-2px); box-shadow:0 10px 28px rgba(15,44,76,.09); }}
.mm-stat:before {{ content:""; position:absolute; inset:0 auto 0 0; width:4px;
  background:linear-gradient(180deg,{NAVY},{GREEN}); }}
.mm-stat-label {{ font-size:.74rem; text-transform:uppercase; letter-spacing:.1em;
  color:#7A8896; font-weight:700; }}
.mm-stat-value {{ font-size:1.9rem; font-weight:800; letter-spacing:-.03em; margin-top:.35rem;
  background:linear-gradient(135deg,{NAVY},{GREEN}); -webkit-background-clip:text;
  -webkit-text-fill-color:transparent; }}

/* table */
.mm-table-wrap {{ border:1px solid #E9EEF3; border-radius:16px; overflow:auto; max-height:560px; background:#fff; }}
table.mm-table {{ width:100%; border-collapse:collapse; font-size:.86rem; }}
table.mm-table thead th {{ position:sticky; top:0; background:#F7FAFC; color:#5A6B7C;
  text-align:left; font-weight:700; font-size:.72rem; text-transform:uppercase;
  letter-spacing:.08em; padding:.75rem 1rem; border-bottom:1px solid #E9EEF3; z-index:2; }}
table.mm-table td {{ padding:.72rem 1rem; border-bottom:1px solid #F1F5F8; }}
table.mm-table tbody tr:hover {{ background:#F8FBFA; }}
.mm-pill {{ display:inline-block; padding:.18rem .55rem; border-radius:999px;
  font-size:.72rem; font-weight:700; }}
.mm-amt {{ text-align:right; font-variant-numeric:tabular-nums; font-weight:700; }}
.mm-debit {{ color:#C0392B; }} .mm-credit {{ color:#0B7A52; }}

/* controls */
.stButton>button {{ border-radius:10px; font-weight:600; border:1px solid #E9EEF3; background:#fff; color:{NAVY}; }}
.stButton>button:hover {{ border-color:{GREEN}; color:{GREEN}; }}
div[data-testid="stForm"] {{ border:1px solid #E9EEF3; border-radius:16px; background:#fff; }}
.mm-section {{ font-size:.78rem; font-weight:700; text-transform:uppercase;
  letter-spacing:.1em; color:#7A8896; margin:2.25rem 0 .75rem; }}
.mm-next {{ display:block; text-decoration:none; background:linear-gradient(135deg, rgba(15,44,76,.05), rgba(20,184,122,.08));
  border:1px solid #DDE7EE; border-radius:18px; padding:1.25rem 1.4rem; color:{NAVY};
  transition:transform .18s ease, box-shadow .18s ease; }}
.mm-next:hover {{ transform:translateY(-2px); box-shadow:0 10px 28px rgba(15,44,76,.08); }}
</style>
""",
    unsafe_allow_html=True,
)

ICON_LOCK = f'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="{GREEN}" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
ICON_CHECK = f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B6B47" stroke-width="2.4" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>'
ICON_ARROW = f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{NAVY}" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'
LOGO = f"""<svg width="28" height="28" viewBox="0 0 32 32" fill="none">
<defs><linearGradient id="mmg" x1="0" y1="32" x2="32" y2="0">
<stop stop-color="{NAVY}"/><stop offset="1" stop-color="{GREEN}"/></linearGradient></defs>
<rect width="32" height="32" rx="9" fill="url(#mmg)"/>
<path d="M8 22V11l4.5 6L17 11v11" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M20 19l4-4m0 0h-3.2m3.2 0v3.2" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>"""


def security_note() -> None:
    st.markdown(
        f"""<div class="mm-note">{ICON_LOCK}<div><b>Processed in-session only.</b>
        Your statement is parsed for this session, never stored in a database or shared with
        third parties, and cleared when you close the tab or upload a new file.</div></div>""",
        unsafe_allow_html=True,
    )


def money(v: float) -> str:
    return f"₹{v:,.2f}"


# ---------------------------------------------------------------- header -----
st.markdown(
    f"""<div class="mm-header">
  <div class="mm-brand">{LOGO}<span>MoneyMind AI</span></div>
  <div class="mm-nav">
    <a href="#">Dashboard</a>
    <a href="#" class="active">Upload &amp; Analyze</a>
    <a href="#">Insights</a>
    <a href="#">Budget</a>
  </div>
  <div class="mm-avatar">PA</div>
</div>""",
    unsafe_allow_html=True,
)

st.markdown(
    """<div class="mm-eyebrow">Upload &amp; Analyze</div>
<h1 class="mm-h1">Understand your spending</h1>
<p class="mm-sub">Upload a bank or UPI (PhonePe) statement as PDF or CSV and MoneyMind AI
categorizes every transaction instantly — no manual tagging, no spreadsheets.</p>""",
    unsafe_allow_html=True,
)
st.write("")

# ---------------------------------------------------------------- upload -----
if "df" not in st.session_state:
    st.session_state.df = None

uploaded = st.file_uploader(
    "Drag & drop your statement here",
    type=["csv", "pdf"],
    label_visibility="collapsed",
    help="PDF bank statements, PhonePe CSV exports, or any transaction CSV",
)

if uploaded is not None:
    with st.spinner("Parsing and categorizing transactions…"):
        try:
            # BACKEND: swap for your existing pipeline, e.g.
            #   df = parse_statement(uploaded)  /  categorize(df)
            df = pd.read_csv(uploaded)
            df.columns = [c.strip().lower() for c in df.columns]
            df["date"] = pd.to_datetime(df["date"]).dt.date
            df["amount"] = pd.to_numeric(df["amount"])
            if "type" not in df:
                df["type"] = df["amount"].apply(lambda a: "Credit" if a > 0 else "Debit")
            if "category" not in df:
                df["category"] = "Other"
            df["amount"] = df["amount"].abs()
            st.session_state.df = df
        except Exception as exc:  # styled alert, not a raw traceback
            st.session_state.df = None
            st.error(f"We couldn't read that file. {exc}  —  check the format and try again.")

df = st.session_state.df

if df is None:
    security_note()
    st.stop()

# ------------------------------------------------------------ loaded state ---
c1, c2 = st.columns([4, 1])
with c1:
    st.markdown(
        f'<div class="mm-success">{ICON_CHECK}{len(df)} transactions loaded and categorized</div>',
        unsafe_allow_html=True,
    )
with c2:
    if st.button("Upload a new file", use_container_width=True):
        st.session_state.df = None
        st.rerun()

debits = float(df.loc[df["type"] == "Debit", "amount"].sum())
credits = float(df.loc[df["type"] == "Credit", "amount"].sum())

st.write("")
s1, s2, s3 = st.columns(3)
for col, label, value in (
    (s1, "Total debits", money(debits)),
    (s2, "Total credits", money(credits)),
    (s3, "Net change", money(credits - debits)),
):
    col.markdown(
        f'<div class="mm-stat"><div class="mm-stat-label">{label}</div>'
        f'<div class="mm-stat-value">{value}</div></div>',
        unsafe_allow_html=True,
    )

# ---------------------------------------------------------------- filters ----
st.markdown('<div class="mm-section">Filters</div>', unsafe_allow_html=True)
with st.container(border=True):
    f1, f2 = st.columns([2, 1])
    cats = sorted(df["category"].unique().tolist())
    sel_cats = f1.multiselect("Category", cats, default=cats, placeholder="All categories")
    sel_type = f2.segmented_control(
        "Type", ["All", "Debit", "Credit"], default="All"
    ) if hasattr(st, "segmented_control") else f2.radio(
        "Type", ["All", "Debit", "Credit"], horizontal=True
    )

    f3, f4 = st.columns([1, 1])
    dmin, dmax = df["date"].min(), df["date"].max()
    rng = f3.date_input("Date range", (dmin, dmax), min_value=dmin, max_value=dmax)
    amin, amax = float(df["amount"].min()), float(df["amount"].max())
    lo, hi = f4.slider("Amount range", amin, amax, (amin, amax))

    if st.button("Reset filters"):
        st.rerun()

start, end = (rng if isinstance(rng, tuple) and len(rng) == 2 else (dmin, dmax))
view = df[
    df["category"].isin(sel_cats or cats)
    & df["amount"].between(lo, hi)
    & df["date"].between(start, end)
]
if sel_type != "All":
    view = view[view["type"] == sel_type]

st.caption(f"Showing {len(view)} of {len(df)} transactions")

# ----------------------------------------------------------------- table -----
if view.empty:
    st.markdown(
        '<div class="mm-card" style="text-align:center;color:#7A8896;padding:2.5rem">'
        "No transactions match these filters. Widen the range or reset the filters.</div>",
        unsafe_allow_html=True,
    )
else:
    rows = []
    for _, r in view.sort_values("date", ascending=False).iterrows():
        color = CATEGORY_COLORS.get(r["category"], "#64748B")
        cls = "mm-credit" if r["type"] == "Credit" else "mm-debit"
        sign = "+" if r["type"] == "Credit" else "−"
        desc = str(r.get("description", ""))
        rows.append(
            f"<tr><td>{r['date']:%d %b %Y}</td><td>{desc}</td>"
            f"<td><span class='mm-pill' style='background:{color}1A;color:{color}'>{r['category']}</span></td>"
            f"<td>{r['type']}</td>"
            f"<td class='mm-amt {cls}'>{sign}{money(r['amount'])}</td></tr>"
        )
    st.markdown(
        '<div class="mm-table-wrap"><table class="mm-table"><thead><tr>'
        "<th>Date</th><th>Description</th><th>Category</th><th>Type</th>"
        "<th style='text-align:right'>Amount</th></tr></thead><tbody>"
        + "".join(rows)
        + "</tbody></table></div>",
        unsafe_allow_html=True,
    )

# ------------------------------------------------------------- what's next ---
st.markdown('<div class="mm-section">What&rsquo;s next</div>', unsafe_allow_html=True)
st.markdown(
    f"""<a class="mm-next" href="#">
  <div style="display:flex;align-items:center;gap:.6rem;font-weight:700">Open your Dashboard {ICON_ARROW}</div>
  <div style="color:#5A6B7C;font-size:.88rem;margin-top:.35rem">See spending trends, category
  breakdowns, and budget-vs-actual charts built from this statement.</div>
</a>
<p style="color:#7A8896;font-size:.8rem;margin-top:.9rem">If a few categories look off, re-upload
a cleaner export — MoneyMind AI re-categorizes from scratch each time.</p>""",
    unsafe_allow_html=True,
)
st.write("")
security_note()
