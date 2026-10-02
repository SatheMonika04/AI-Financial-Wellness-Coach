"""Test the Financial Wellness Score Engine with 3 synthetic user profiles."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.wellness.score_engine import WellnessInput, calculate_wellness_score


def print_report(name: str, result) -> None:
    sep = "=" * 50
    print(f"\n{sep}")
    print(f"  {name}")
    print(sep)
    print(f"  Savings Score    : {result.savings_score:.0f}  (weight 20%)")
    print(f"  Expense Score    : {result.expense_score:.0f}  (weight 20%)")
    print(f"  Budget Score     : {result.budget_score:.0f}  (weight 15%)")
    print(f"  Debt Score       : {result.debt_score:.0f}  (weight 15%)")
    print(f"  Emergency Score  : {result.emergency_score:.0f}  (weight 10%)")
    print(f"  Goal Score       : {result.goal_score:.0f}  (weight 10%)")
    print(f"  Anomaly Score    : {result.anomaly_score:.0f}  (weight 10%)")
    print("-" * 50)
    print(f"  FINAL SCORE      : {result.overall_score} / 100")
    print(f"  WELLNESS LEVEL   : {result.wellness_level}")
    if result.is_provisional:
        print(f"  [PROVISIONAL — missing: {', '.join(result.missing_data)}]")
    print(f"\n  Strengths:")
    for s in result.strengths or ["(none)"]:
        print(f"    ✓ {s}")
    print(f"\n  Weaknesses:")
    for w in result.weaknesses or ["(none)"]:
        print(f"    ⚠ {w}")
    print(f"\n  Recommendations:")
    for r in result.recommendations:
        print(f"    → {r}")
    print(sep)


# --- User A: Financially Healthy ---
user_a = WellnessInput(
    monthly_income=100000.0,
    monthly_expense=50000.0,
    savings_goal=500000.0,
    current_savings=400000.0,
    total_debt=0.0,
    monthly_debt_payment=0.0,
    essential_expense=30000.0,
    anomaly_count=0,
    budget_adherence_pct=96.0,
)

# --- User B: Average ---
user_b = WellnessInput(
    monthly_income=60000.0,
    monthly_expense=48000.0,
    savings_goal=200000.0,
    current_savings=50000.0,
    total_debt=150000.0,
    monthly_debt_payment=7000.0,
    essential_expense=28000.0,
    anomaly_count=2,
    budget_adherence_pct=82.0,
)

# --- User C: Financially Stressed ---
user_c = WellnessInput(
    monthly_income=40000.0,
    monthly_expense=39000.0,
    savings_goal=100000.0,
    current_savings=5000.0,
    total_debt=300000.0,
    monthly_debt_payment=18000.0,
    essential_expense=20000.0,
    anomaly_count=12,
    high_severity_anomalies=4,
    medium_severity_anomalies=5,
    budget_adherence_pct=45.0,
)

result_a = calculate_wellness_score(user_a)
result_b = calculate_wellness_score(user_b)
result_c = calculate_wellness_score(user_c)

print_report("USER A — Financially Healthy", result_a)
print_report("USER B — Average", result_b)
print_report("USER C — Financially Stressed", result_c)

print("\n" + "=" * 50)
print("VALIDATION")
print("=" * 50)
assert result_a.overall_score > result_b.overall_score, f"Expected A > B, got {result_a.overall_score} vs {result_b.overall_score}"
assert result_b.overall_score > result_c.overall_score, f"Expected B > C, got {result_b.overall_score} vs {result_c.overall_score}"
assert result_c.overall_score < 50, f"Expected C < 50, got {result_c.overall_score}"
print(f"  ✓ Score A ({result_a.overall_score}) > Score B ({result_b.overall_score}) > Score C ({result_c.overall_score})")
print(f"  ✓ Score C ({result_c.overall_score}) < 50 (financially stressed)")
print("  ALL ASSERTIONS PASSED")
