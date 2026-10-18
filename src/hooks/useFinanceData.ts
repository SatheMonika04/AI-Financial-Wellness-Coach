import { useMemo } from "react";
import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { useAppStore, type AppState } from "@/store/AppStore";
import { byCategory, categoryMonthAvg, inRange, isExpense, monthlySeries, totals } from "@/lib/analytics";
import { getPeriodRange, TODAY } from "@/lib/period";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import type { BudgetModelFeatures, ExpenseCategory, WellnessInput } from "@/types";

export function usePeriodData() {
  const { state } = useAppStore();
  return useMemo(() => {
    const range = getPeriodRange(state.period);
    const current = inRange(state.transactions, range.start, range.end);
    const prev = inRange(state.transactions, range.prevStart, range.prevEnd);
    return {
      range,
      current,
      prev,
      totals: totals(current),
      prevTotals: totals(prev),
      categories: byCategory(current),
      prevCategories: byCategory(prev),
    };
  }, [state.transactions, state.period]);
}

export type BudgetStatus = "ok" | "warning" | "over";
export interface BudgetRow {
  category: ExpenseCategory;
  spent: number;
  budget: number;
  remaining: number;
  pct: number;
  status: BudgetStatus;
}

export function budgetRows(state: AppState, start: Date, end: Date, months: number): BudgetRow[] {
  const spentMap = new Map(byCategory(inRange(state.transactions, start, end)).map((c) => [c.category, c.amount]));
  return EXPENSE_CATEGORIES.map((category) => {
    const spent = spentMap.get(category) ?? 0;
    const budget = (state.budgets[category] ?? 0) * months;
    const pct = budget ? spent / budget : spent > 0 ? 1.5 : 0;
    return { category, spent, budget, remaining: budget - spent, pct, status: pct > 1 ? "over" : pct >= 0.85 ? "warning" : "ok" };
  });
}

export function useBudgetRows(scope: "period" | "month" = "period") {
  const { state } = useAppStore();
  return useMemo(() => {
    if (scope === "month") return budgetRows(state, startOfMonth(TODAY), TODAY, 1);
    const r = getPeriodRange(state.period);
    return budgetRows(state, r.start, r.end, r.months);
  }, [state, scope]);
}

export function useModelFeatures(): BudgetModelFeatures {
  const { state } = useAppStore();
  return useMemo(() => {
    const income = state.profile.monthlyIncome;
    const categorySpending = categoryMonthAvg(state.transactions, 3);
    const spendingToIncome: BudgetModelFeatures["spendingToIncome"] = {};
    let total = 0;
    (Object.entries(categorySpending) as [ExpenseCategory, number][]).forEach(([c, v]) => {
      spendingToIncome[c] = income ? Math.round((v / income) * 1000) / 1000 : 0;
      total += v;
    });
    return {
      monthlyIncome: income,
      categorySpending,
      spendingToIncome,
      debtToIncome: state.profile.totalDebt != null && income ? Math.round((state.profile.totalDebt / (income * 12)) * 1000) / 1000 : null,
      expenseToIncome: income ? Math.round((total / income) * 1000) / 1000 : 0,
    };
  }, [state.transactions, state.profile]);
}

export function wellnessInputFor(state: AppState, monthOffset = 1): WellnessInput {
  const months = monthlySeries(state.transactions, 6, subMonths(TODAY, monthOffset)).filter((m) => m.expenses > 0 || m.income > 0);
  const last3 = months.slice(-3);
  const income = last3.reduce((s, m) => s + m.income, 0);
  const expenses = last3.reduce((s, m) => s + m.expenses, 0);
  const avgExp = last3.length ? expenses / last3.length : null;
  const mean = months.length ? months.reduce((s, m) => s + m.expenses, 0) / months.length : 0;
  const sd = months.length ? Math.sqrt(months.reduce((s, m) => s + (m.expenses - mean) ** 2, 0) / months.length) : 0;
  const ref = subMonths(TODAY, monthOffset);
  const rows = budgetRows(state, startOfMonth(ref), endOfMonth(ref), 1).filter((r) => r.budget > 0);
  const active = state.goals.filter((g) => !g.completed);
  const emergency = state.goals.find((g) => g.type === "emergency");
  return {
    monthlyIncome: state.profile.monthlyIncome || null,
    avgMonthlyExpenses: avgExp,
    savingsRate: income ? (income - expenses) / income : null,
    budgetAdherence: rows.length && avgExp ? rows.filter((r) => r.spent <= r.budget).length / rows.length : null,
    totalDebt: state.profile.totalDebt ?? null,
    emergencyFund: emergency ? emergency.currentAmount : null,
    goalProgress: active.length ? active.reduce((s, g) => s + g.currentAmount, 0) / active.reduce((s, g) => s + g.targetAmount, 0) : null,
    spendingVolatility: months.length >= 3 && mean ? sd / mean : null,
  };
}

export function useDailyHistory(days = 180) {
  const { state } = useAppStore();
  return useMemo(() => {
    const start = subDays(TODAY, days - 1);
    const map = new Map<string, number>();
    inRange(state.transactions, start, TODAY).forEach((t) => {
      if (isExpense(t)) map.set(t.date.slice(0, 10), (map.get(t.date.slice(0, 10)) ?? 0) + t.amount);
    });
    const out: { date: string; amount: number }[] = [];
    if (!state.transactions.length) return out;
    for (let i = 0; i < days; i++) {
      const k = format(subDays(TODAY, days - 1 - i), "yyyy-MM-dd");
      out.push({ date: k, amount: Math.round(map.get(k) ?? 0) });
    }
    return out;
  }, [state.transactions, days]);
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: "anomaly" | "budget";
  link: "/anomalies" | "/budgets";
}

export function useNotifications() {
  const { state } = useAppStore();
  const rows = useBudgetRows("month");
  return useMemo(() => {
    const list: AppNotification[] = [];
    if (state.settings.notifications.anomalyAlerts)
      state.transactions
        .filter((t) => t.anomaly?.flagged && t.anomaly.reviewStatus === "new")
        .forEach((t) => list.push({ id: `anom:${t.id}`, kind: "anomaly", link: "/anomalies", title: `Unusual: ${t.merchant}`, body: t.anomaly!.reasons[0] }));
    if (state.settings.notifications.budgetAlerts)
      rows
        .filter((r) => r.status === "over")
        .forEach((r) => list.push({ id: `budget:${r.category}:${format(TODAY, "yyyy-MM")}`, kind: "budget", link: "/budgets", title: `${r.category} over budget`, body: `Spent ${Math.round(r.pct * 100)}% of this month's budget.` }));
    const unread = list.filter((n) => !state.readNotifications.includes(n.id));
    return { list, unread };
  }, [state.transactions, state.settings.notifications, state.readNotifications, rows]);
}
