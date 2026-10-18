import type { BudgetRecommendation, ExpenseCategory } from "@/types";
import type { BudgetService } from "@/services/budgetService";
import { delay } from "@/services/apiClient";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { TODAY } from "@/lib/period";
import { format } from "date-fns";

const round = (n: number, step = 500) => Math.max(0, Math.round(n / step) * step);
const DISCRETIONARY_CAP: Partial<Record<ExpenseCategory, number>> = { Dining: 0.05, Shopping: 0.06, Entertainment: 0.025, Other: 0.03 };

/** Clearly-labelled demo heuristics. Replaced by the saved recommendation model via the backend. */
export const mockBudgetService: BudgetService = {
  async getRecommendations({ profile, features, currentBudgets }) {
    await delay(800);
    const income = profile.monthlyIncome;
    const recs: BudgetRecommendation[] = EXPENSE_CATEGORIES.map((c) => {
      const actual = Math.round(features.categorySpending[c] ?? 0);
      const current = currentBudgets[c] ?? 0;
      const share = income ? actual / income : 0;
      let recommended: number;
      let explanation: string;
      if (c === "Housing") {
        recommended = round(Math.max(actual, current), 1000);
        explanation = `Fixed obligation at ${(share * 100).toFixed(0)}% of income — within the 30% housing guideline.`;
      } else if (DISCRETIONARY_CAP[c]) {
        const cap = income * (DISCRETIONARY_CAP[c] as number);
        recommended = round(Math.min(actual * 0.85, Math.max(cap, actual * 0.7)));
        explanation =
          actual > cap
            ? `Averaging ${(share * 100).toFixed(1)}% of income; trimming ~15% frees money for savings.`
            : `Spending is moderate; a slight reduction keeps you ahead of your savings goal.`;
      } else if (c === "Education") {
        recommended = round(Math.max(actual, 1500));
        explanation = "Investing in skills supports your higher-education goal; keep a steady allocation.";
      } else {
        recommended = round(actual * 1.05);
        explanation = `Essential spend. Budget set ~5% above your 3-month average to avoid false overspend alerts.`;
      }
      return { category: c, actual, current, recommended, explanation };
    });
    const savingsTarget = round(Math.max(income * 0.2, profile.savingsGoal ?? 0), 1000);
    const actualSavings = Math.round(income - features.expenseToIncome * income);
    recs.push({
      category: "Savings",
      actual: actualSavings,
      current: currentBudgets.Savings ?? 0,
      recommended: savingsTarget,
      explanation: `Targets at least 20% of income${profile.savingsGoal ? " and your stated savings goal" : ""}.`,
    });
    return { recommendations: recs, generatedAt: format(TODAY, "yyyy-MM-dd'T'HH:mm"), source: "demo" };
  },
};
