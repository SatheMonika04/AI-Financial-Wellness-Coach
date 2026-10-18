import type { ExpenseCategory, Transaction } from "@/types";
import { byCategory, totals } from "./analytics";
import { formatINR } from "./format";
import type { BudgetRow } from "@/hooks/useFinanceData";

export interface Insight {
  id: string;
  type: "Spending change" | "Savings opportunity" | "Savings trend" | "Unusual activity" | "Budget alert";
  tone: "positive" | "negative" | "neutral";
  title: string;
  detail: string;
}

/** Rule-based insights derived from the shared transaction data (not ML output). */
export function buildInsights(current: Transaction[], prev: Transaction[], rows: BudgetRow[]): Insight[] {
  const out: Insight[] = [];
  const cur = new Map(byCategory(current).map((c) => [c.category, c.amount]));
  const pre = new Map(byCategory(prev).map((c) => [c.category, c.amount]));
  const changes = [...cur.entries()]
    .map(([c, v]) => ({ c, v, p: pre.get(c) ?? 0 }))
    .filter((x) => x.p > 500)
    .map((x) => ({ ...x, ch: (x.v - x.p) / x.p }))
    .sort((a, b) => Math.abs(b.ch) - Math.abs(a.ch));
  const dining = changes.find((x) => x.c === ("Dining" as ExpenseCategory));
  const top = dining && Math.abs(dining.ch) > 0.05 ? dining : changes[0];
  if (top)
    out.push({
      id: "chg",
      type: "Spending change",
      tone: top.ch > 0 ? "negative" : "positive",
      title: `${top.c} expenses ${top.ch > 0 ? "increased" : "decreased"} ${Math.abs(Math.round(top.ch * 100))}%`,
      detail: `${formatINR(top.v)} this period vs ${formatINR(top.p)} in the comparison period.`,
    });

  const disc: ExpenseCategory[] = ["Dining", "Shopping", "Entertainment", "Other"];
  const potential = disc.reduce((s, c) => s + Math.max(0, (cur.get(c) ?? 0) * 0.15), 0);
  if (potential > 500)
    out.push({
      id: "save",
      type: "Savings opportunity",
      tone: "neutral",
      title: `You could save ${formatINR(Math.round(potential / 100) * 100)}`,
      detail: "By trimming discretionary spending (dining, shopping, entertainment) by 15%.",
    });

  const t = totals(current);
  const p = totals(prev);
  if (t.savingsRate != null && p.savingsRate != null) {
    const diff = t.savingsRate - p.savingsRate;
    out.push({
      id: "rate",
      type: "Savings trend",
      tone: diff >= 0 ? "positive" : "negative",
      title: `Your savings rate ${diff >= 0 ? "improved" : "dropped"} to ${Math.round(t.savingsRate * 100)}%`,
      detail: `${diff >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(diff * 100))} points from ${Math.round(p.savingsRate * 100)}%.`,
    });
  }

  const over = rows.filter((r) => r.status === "over");
  if (over.length)
    out.push({
      id: "over",
      type: "Budget alert",
      tone: "negative",
      title: `${over.length} ${over.length === 1 ? "category is" : "categories are"} over budget`,
      detail: over.map((r) => `${r.category} (${Math.round(r.pct * 100)}%)`).join(", "),
    });

  const flagged = current.filter((x) => x.anomaly?.flagged && x.anomaly.reviewStatus === "new");
  if (flagged.length)
    out.push({
      id: "anom",
      type: "Unusual activity",
      tone: "negative",
      title: `${flagged.length} unusual ${flagged.length === 1 ? "transaction needs" : "transactions need"} review`,
      detail: `Largest: ${flagged.sort((a, b) => b.amount - a.amount)[0].merchant} for ${formatINR(flagged[0].amount)}.`,
    });
  return out;
}
