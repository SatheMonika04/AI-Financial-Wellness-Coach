import type { WellnessComponent, WellnessInput, WellnessLevel, WellnessScore } from "@/types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Demo mirror of the rule-based wellness engine. Missing inputs yield null, never zero. */
export function computeWellness(i: WellnessInput): WellnessScore {
  const components: WellnessComponent[] = [
    {
      key: "savings",
      label: "Savings health",
      weight: 0.25,
      score: i.savingsRate == null ? null : clamp((i.savingsRate / 0.3) * 100),
      detail: i.savingsRate == null ? "Add income data to evaluate" : `Saving ${(i.savingsRate * 100).toFixed(0)}% of income (target 30%)`,
    },
    {
      key: "discipline",
      label: "Spending discipline",
      weight: 0.15,
      score: i.spendingVolatility == null ? null : clamp(100 - i.spendingVolatility * 250),
      detail: i.spendingVolatility == null ? "Needs 3+ months of history" : `Monthly spending varies by ${(i.spendingVolatility * 100).toFixed(0)}%`,
    },
    {
      key: "budget",
      label: "Budget adherence",
      weight: 0.2,
      score: i.budgetAdherence == null ? null : clamp(i.budgetAdherence * 100),
      detail: i.budgetAdherence == null ? "Set budgets to evaluate" : `${(i.budgetAdherence * 100).toFixed(0)}% of categories within budget`,
    },
    {
      key: "debt",
      label: "Debt health",
      weight: 0.15,
      score: i.totalDebt == null || !i.monthlyIncome ? null : clamp(100 - (i.totalDebt / (i.monthlyIncome * 12)) * 150),
      detail:
        i.totalDebt == null || !i.monthlyIncome
          ? "Debt not provided"
          : `Debt is ${((i.totalDebt / (i.monthlyIncome * 12)) * 100).toFixed(0)}% of annual income`,
    },
    {
      key: "emergency",
      label: "Emergency fund",
      weight: 0.15,
      score: i.emergencyFund == null || !i.avgMonthlyExpenses ? null : clamp((i.emergencyFund / (i.avgMonthlyExpenses * 6)) * 100),
      detail:
        i.emergencyFund == null || !i.avgMonthlyExpenses
          ? "Add an emergency fund goal"
          : `Covers ${(i.emergencyFund / i.avgMonthlyExpenses).toFixed(1)} of 6 recommended months`,
    },
    {
      key: "goals",
      label: "Goal progress",
      weight: 0.1,
      score: i.goalProgress == null ? null : clamp(i.goalProgress * 100),
      detail: i.goalProgress == null ? "No active goals" : `${(i.goalProgress * 100).toFixed(0)}% of active goal targets saved`,
    },
  ];
  const avail = components.filter((c) => c.score != null);
  const w = avail.reduce((s, c) => s + c.weight, 0);
  const overall = w >= 0.5 ? Math.round(avail.reduce((s, c) => s + (c.score as number) * c.weight, 0) / w) : null;
  const level: WellnessLevel =
    overall == null ? "Insufficient data" : overall >= 80 ? "Excellent" : overall >= 65 ? "Good" : overall >= 50 ? "Fair" : "Needs attention";

  const factors = avail
    .filter((c) => (c.score as number) >= 70 || (c.score as number) < 55)
    .map((c) => ({ label: c.label, impact: (c.score as number) >= 70 ? ("positive" as const) : ("negative" as const), detail: c.detail }));

  const recs: WellnessScore["recommendations"] = [];
  const s = (k: string) => components.find((c) => c.key === k)?.score;
  if ((s("emergency") ?? 100) < 70) recs.push({ title: "Automate an emergency-fund transfer", detail: "Set a ₹5,000 auto-transfer on salary day until you reach 6 months of expenses.", impact: "high" });
  if ((s("budget") ?? 100) < 80) recs.push({ title: "Rein in over-budget categories", detail: "Review Dining and Shopping this week — they are the most frequent overspends.", impact: "high" });
  if ((s("savings") ?? 100) < 80) recs.push({ title: "Lift your savings rate by 5%", detail: "Moving ₹4,750/month into a recurring deposit gets you close to the 30% target.", impact: "medium" });
  if ((s("debt") ?? 100) < 80) recs.push({ title: "Prepay high-interest debt", detail: "Direct windfalls (bonus, freelance payouts) to the highest-interest loan first.", impact: "medium" });
  if ((s("discipline") ?? 100) < 80) recs.push({ title: "Smooth out spending spikes", detail: "Plan large purchases ahead and spread them across months.", impact: "low" });
  recs.push({ title: "Do a 10-minute weekly money check-in", detail: "Review flagged transactions and budget progress every Sunday.", impact: "low" });

  return { overall, level, components, factors, recommendations: recs, source: "demo" };
}
