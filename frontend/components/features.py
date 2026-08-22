"""Trust strip + features section with mixed card sizes for visual hierarchy."""

from ..utils.ui import html

VALUE_CARDS = [
    ("\U0001f50e", "Understand", "Know exactly where your money goes.", ""),
    ("\U0001f4c8", "Predict", "See where your spending is heading.", "mm-ic--lav"),
    ("\u2726", "Improve", "Get personalized recommendations to build healthier financial habits.", "mm-ic--navy"),
]

FEATURES = [
    ("\U0001f4c4", "Bank Statement Import",
     "Upload your bank or UPI statement and automatically convert financial records into structured transactions.", ""),
    ("\U0001f3f7\ufe0f", "Smart Expense Categorization",
     "Automatically classify transactions into meaningful spending categories using machine learning.", "mm-ic--lav"),
    ("\U0001f4c9", "Spending Forecast",
     "Predict upcoming spending trends using your historical financial behavior.", "mm-ic--navy"),
    ("\U0001f3af", "Smart Budget Recommendations",
     "Receive personalized budget recommendations based on your income, spending patterns, and financial goals.", ""),
    ("\u26a0\ufe0f", "Anomaly Detection",
     "Personalized anomaly detection that learns what is normal for <b>you</b> \u2014 a \u20b925,000 purchase may be routine for one person and unusual for another.", "mm-ic--lav"),
    ("\u2728", "AI Financial Coach",
     "Ask questions about your finances and get understandable, personalized explanations and guidance from your AI coach.", "mm-ic--navy"),
    ("\U0001f4ca", "Interactive Financial Analytics",
     "Explore your financial behavior through interactive charts, trends, category breakdowns, and personalized insights.", ""),
]


def render_value_props() -> None:
    cards = "".join(
        f"""
        <div class="mm-tile">
          <div class="mm-ic {cls}">{icon}</div>
          <h3 class="mm-h3">{title}</h3>
          <p>{body}</p>
        </div>
        """
        for icon, title, body, cls in VALUE_CARDS
    )
    html(
        f"""
        <section class="mm-section mm-section--tint mm-reveal">
          <div class="mm-center">
            <span class="mm-eyebrow">Why MoneyMind AI</span>
            <h2 class="mm-h2" style="margin-top:14px">Your finances. One intelligent view.</h2>
          </div>
          <div class="mm-grid-3">{cards}</div>
        </section>
        """
    )


def render_features() -> None:
    tiles = "".join(
        f"""
        <div class="mm-tile">
          <div class="mm-ic {cls}">{icon}</div>
          <h3 class="mm-h3">{title}</h3>
          <p>{body}</p>
        </div>
        """
        for icon, title, body, cls in FEATURES
    )
    html(
        f"""
        <section class="mm-section mm-reveal" id="features">
          <div class="mm-center">
            <span class="mm-eyebrow">Features</span>
            <h2 class="mm-h2" style="margin-top:14px">Everything You Need to <span class="mm-grad">Understand Your Money</span></h2>
            <p class="mm-lead">Seven intelligence modules working together on one financial story \u2014 yours.</p>
          </div>

          <div class="mm-feature-hero">
            <div>
              <span class="mm-badge">Core engine</span>
              <h3 class="mm-h2" style="font-size:34px;margin-top:18px">Smart Financial Intelligence</h3>
              <p class="mm-lead">
                Every statement you upload is cleaned, categorized, forecast and stress-tested against your own
                history \u2014 then translated into plain language you can act on today.
              </p>
              <div style="margin-top:26px">
                <a class="mm-btn mm-btn--primary" href="?page=signup" target="_self">Get Started</a>
              </div>
            </div>
            <div class="mm-glass">
              <div class="mm-kpis">
                <div class="mm-kpi"><div class="l">Transactions parsed</div><div class="v">1,284</div></div>
                <div class="mm-kpi"><div class="l">Categories learned</div><div class="v">12</div></div>
                <div class="mm-kpi"><div class="l">Forecast accuracy</div><div class="v">93%</div></div>
              </div>
              <div class="mm-bars" style="margin-top:20px">
                <i style="height:38%"></i><i style="height:64%"></i><i style="height:44%"></i>
                <i style="height:78%"></i><i style="height:56%"></i><i style="height:88%"></i>
                <i style="height:66%"></i><i style="height:96%"></i>
              </div>
              <p style="color:rgba(255,255,255,.7);font-size:13px;margin:16px 0 0">
                Projected next-month spending: <b style="color:#9ff0cf">\u20b922,850</b>
              </p>
            </div>
          </div>

          <div class="mm-grid-4">{tiles}</div>
        </section>
        """
    )
