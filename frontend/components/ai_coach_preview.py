"""AI Coach preview + personalized anomaly detection section (UI only)."""

from ..utils.ui import html

SAMPLE_QUESTIONS = [
    "Why did I spend more this month?",
    "Where can I reduce my spending?",
    "Can I afford this purchase?",
    "How much should I save this month?",
]


def render_ai_coach() -> None:
    chips = "".join(f'<span class="mm-chip">{q}</span>' for q in SAMPLE_QUESTIONS)
    html(
        f"""
        <section class="mm-section mm-section--tint mm-reveal" id="ai-coach">
          <div style="display:grid;grid-template-columns:1fr 1.05fr;gap:56px;align-items:center">
            <div>
              <span class="mm-eyebrow">AI Financial Coach</span>
              <h2 class="mm-h2" style="margin-top:14px">Your Finances, <span class="mm-grad">Explained by AI.</span></h2>
              <p class="mm-lead">
                Not another dashboard to decode. Ask a question in plain language and get a clear,
                personal answer grounded in your own transactions.
              </p>
              <div class="mm-qchips">{chips}</div>
              <div style="margin-top:30px">
                <a class="mm-btn mm-btn--primary mm-btn--lg" href="?page=signup" target="_self">Talk to MoneyMind AI</a>
              </div>
            </div>

            <div class="mm-chat">
              <div class="mm-chat__top">
                <span class="mm-chat__dot"></span>
                <b style="font-size:14px;color:#0b1f3a">MoneyMind AI Coach</b>
                <span style="font-size:12px;color:#5b6b82;margin-left:auto">Online</span>
              </div>
              <div class="mm-chat__body">
                <div class="mm-msg mm-msg--user">Why did my spending increase this month?</div>
                <div class="mm-msg mm-msg--ai">
                  Your spending increased by <b>12%</b> compared with last month, mainly because of
                  food delivery and shopping. Reducing these two categories by <b>\u20b92,000</b> could
                  bring you back within your target budget.
                </div>
                <div class="mm-typing"><i></i><i></i><i></i></div>
              </div>
            </div>
          </div>
        </section>
        """
    )


def render_anomaly() -> None:
    normal = [
        ("Food \u00b7 Cafe order", "Tue, 12 Aug", "\u20b9450"),
        ("Shopping \u00b7 Apparel", "Thu, 14 Aug", "\u20b91,200"),
        ("Transport \u00b7 Cab rides", "Sat, 16 Aug", "\u20b9800"),
    ]
    rows = "".join(
        f"""
        <div class="mm-txn">
          <div><div class="n">{name}</div><div class="s">{when}</div></div>
          <div class="a">{amt}</div>
        </div>
        """
        for name, when, amt in normal
    )
    html(
        f"""
        <section class="mm-section mm-reveal" id="anomaly">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center">
            <div>
              <span class="mm-eyebrow">Personalized anomaly detection</span>
              <h2 class="mm-h2" style="margin-top:14px">Know When Something <span class="mm-grad">Looks Different.</span></h2>
              <p class="mm-lead">
                MoneyMind AI learns your personal spending behavior and identifies transactions that differ
                significantly from your normal pattern \u2014 no generic rules, no noisy alerts.
              </p>
            </div>
            <div>
              <div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#5b6b82;margin-bottom:12px">NORMAL FOR YOU</div>
              {rows}
              <div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#c9772f;margin:22px 0 12px">FLAGGED</div>
              <div class="mm-txn mm-txn--warn">
                <div>
                  <div class="n">Online Shopping <span class="mm-warnflag">\u26a0 UNUSUAL</span></div>
                  <div class="s">41\u00d7 your typical shopping transaction</div>
                </div>
                <div class="a">\u20b918,500</div>
              </div>
            </div>
          </div>
        </section>
        """
    )
