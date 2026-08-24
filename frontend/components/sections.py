"""How It Works, Financial Wellness and the final CTA."""

from ..utils.ui import html

STEPS = [
    ("01", "Upload Your Statement", "Upload a bank or UPI PDF."),
    ("02", "MoneyMind AI Understands It", "Transactions are extracted, cleaned, and categorized."),
    ("03", "AI Analyzes Your Behavior", "Forecasting, budgeting, anomaly detection, and analytics are applied."),
    ("04", "Get Personalized Guidance", "Understand your finances and make better decisions."),
]


def render_how_it_works() -> None:
    steps = "".join(
        f"""
        <div class="mm-step">
          <div class="n">{n}</div>
          <h3 class="mm-h3">{title}</h3>
          <p>{body}</p>
        </div>
        """
        for n, title, body in STEPS
    )
    html(
        f"""
        <section class="mm-section mm-section--tint mm-reveal" id="how-it-works">
          <div class="mm-center">
            <span class="mm-eyebrow">How it works</span>
            <h2 class="mm-h2" style="margin-top:14px">From statement to strategy in four steps</h2>
          </div>
          <div class="mm-steps">{steps}</div>
        </section>
        """
    )


def render_wellness() -> None:
    html(
        """
        <section class="mm-section mm-reveal" id="wellness">
          <div class="mm-center">
            <span class="mm-eyebrow">Financial wellness</span>
            <h2 class="mm-h2" style="margin-top:14px">More Than Expense Tracking.</h2>
            <p class="mm-lead">
              MoneyMind AI combines machine learning, financial analytics, and AI-powered explanations to help
              you understand not only what you spent, but why your spending changed and what you can do next.
            </p>
          </div>
          <div class="mm-tri">
            <div><div class="k">TRACK</div><h4>Understand your transactions.</h4>
              <p>Every rupee mapped to a category you actually recognise.</p></div>
            <div><div class="k">PREDICT</div><h4>Understand what's coming.</h4>
              <p>Forecasts built on your own behaviour, not national averages.</p></div>
            <div><div class="k">IMPROVE</div><h4>Make better financial decisions.</h4>
              <p>Targeted, realistic recommendations you can act on this week.</p></div>
          </div>
        </section>
        """
    )


def render_final_cta() -> None:
    html(
        """
        <section class="mm-cta mm-reveal">
          <h2 class="mm-h2">Start Understanding Your Money Today.</h2>
          <p class="mm-lead">Turn your financial data into clear insights, smarter decisions, and healthier financial habits.</p>
          <div style="margin-top:32px">
            <a class="mm-btn mm-btn--primary mm-btn--lg" href="?page=signup" target="_self">Get Started \u2014 It's Free</a>
          </div>
        </section>
        """
    )
