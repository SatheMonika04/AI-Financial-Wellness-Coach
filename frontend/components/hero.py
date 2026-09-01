"""Hero section: headline, CTAs and a hand-built HTML/CSS dashboard preview."""

from ..utils.ui import html

_CATEGORIES = [
    ("Food & Dining", "\u20b96,420", 62, ""),
    ("Shopping", "\u20b95,180", 48, ""),
    ("Transport", "\u20b93,240", 30, ""),
    ("Bills", "\u20b94,900", 44, ""),
    ("Entertainment", "\u20b91,660", 18, ""),
]


def _category_rows() -> str:
    return "".join(
        f"""
        <div class="mm-cat">
          <div class="row"><span>{name}</span><b>{amount}</b></div>
          <div class="mm-track"><i style="width:{pct}%"></i></div>
        </div>
        """
        for name, amount, pct, _ in _CATEGORIES
    )


def _trend_bars() -> str:
    heights = [42, 58, 36, 70, 52, 84, 62, 92, 74]
    return "".join(f'<i style="height:{h}%; animation-delay:{i * 60}ms"></i>' for i, h in enumerate(heights))


def render_hero() -> None:
    html(
        f"""
        <section class="mm-hero" id="home">
          <div class="mm-blob mm-blob--teal"></div>
          <div class="mm-blob mm-blob--lav"></div>
          <svg class="mm-curve" width="180" height="120" viewBox="0 0 180 120" fill="none">
            <path d="M4 96C34 24 78 108 116 44c14-24 34-30 60-30" stroke="#7C6CF0" stroke-opacity=".35"
                  stroke-width="2.5" stroke-linecap="round"/>
          </svg>

          <div class="mm-hero__copy">
            <span class="mm-badge">\u25c8 AI-Powered Financial Wellness</span>
            <h1 class="mm-h1">
              Understand Your Money.<br/>
              Build a <span class="mm-underline"><span class="mm-grad">Better Financial</span></span> Future.
            </h1>
            <p class="mm-lead">
              MoneyMind AI analyzes your financial activity, uncovers spending patterns, predicts future
              expenses, and gives you personalized guidance to make smarter financial decisions.
            </p>
            <div class="mm-hero__actions">
              <a class="mm-btn mm-btn--primary mm-btn--lg" href="?page=signup" target="_self">Get Started</a>
              <a class="mm-btn mm-btn--outline mm-btn--lg" href="#features">Explore Features</a>
            </div>
            <div class="mm-hero__stats">
              <div class="mm-hero__stat"><div class="v">7</div><div class="l">Intelligence modules</div></div>
              <div class="mm-hero__stat"><div class="v">100%</div><div class="l">Your data, your view</div></div>
              <div class="mm-hero__stat"><div class="v">&lt;60s</div><div class="l">Statement to insight</div></div>
            </div>
          </div>

          <div class="mm-dash">
            <div class="mm-float mm-float--tl">
              <div class="ic ic--mint">\u2726</div>
              <div><div class="t1">Financial Health 82</div><div class="t2">Up 6 pts this month</div></div>
            </div>
            <div class="mm-float mm-float--br">
              <div class="ic ic--warn">\u26a0</div>
              <div><div class="t1">Unusual transaction</div><div class="t2">\u20b918,500 \u00b7 Online Shopping</div></div>
            </div>

            <div class="mm-card mm-dash__main">
              <div class="mm-dash__head">
                <div class="mm-score">
                  <div class="mm-score__ring"><span>82</span></div>
                  <div class="mm-score__t"><b>Financial Health Score</b>82 / 100 \u00b7 Healthy</div>
                </div>
                <span class="mm-pill">August 2026</span>
              </div>

              <div class="mm-kpis">
                <div class="mm-kpi"><div class="l">Monthly Income</div><div class="v">\u20b935,000</div><div class="d mm-up">\u2191 stable</div></div>
                <div class="mm-kpi"><div class="l">Monthly Spending</div><div class="v">\u20b921,400</div><div class="d mm-down">\u2191 8% vs Jul</div></div>
                <div class="mm-kpi"><div class="l">Savings</div><div class="v">\u20b913,600</div><div class="d mm-up">\u2191 39% rate</div></div>
              </div>

              <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px;margin-top:16px">
                <div class="mm-kpi" style="background:#fff">
                  <div class="l">Spending Trend</div>
                  <div class="mm-bars">{_trend_bars()}</div>
                </div>
                <div class="mm-kpi" style="background:#fff">
                  <div class="l">Category Breakdown</div>
                  <div class="mm-cats">{_category_rows()}</div>
                </div>
              </div>

              <div class="mm-kpi" style="margin-top:14px;display:flex;gap:12px;align-items:center;background:#f7f6ff;border-color:#e4e0fb">
                <div class="ic ic--lav" style="width:32px;height:32px;border-radius:10px;display:grid;place-items:center">\u2726</div>
                <div><div class="t1" style="font-size:13px;font-weight:800;color:#0b1f3a">AI Insight</div>
                <div class="t2" style="font-size:12px;color:#5b6b82">Your food spending increased 14% this month.</div></div>
              </div>
            </div>
          </div>
        </section>
        """
    )
