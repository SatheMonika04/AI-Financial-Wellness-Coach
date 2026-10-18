import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { ExpenseCategory, Transaction } from "@/types";
import { TODAY } from "./period";

export const counted = (t: Transaction) => t.status !== "failed";
export const isExpense = (t: Transaction) => t.type === "expense" && counted(t);
export const isIncome = (t: Transaction) => t.type === "income" && counted(t);

export function inRange(txs: Transaction[], start: Date, end: Date) {
  return txs.filter((t) => {
    const d = parseISO(t.date);
    return d >= start && d <= end;
  });
}

export function totals(txs: Transaction[]) {
  let income = 0;
  let expenses = 0;
  for (const t of txs) {
    if (isIncome(t)) income += t.amount;
    else if (isExpense(t)) expenses += t.amount;
  }
  const savings = income - expenses;
  return { income, expenses, savings, savingsRate: income ? savings / income : null };
}

export function byCategory(txs: Transaction[]) {
  const map = new Map<ExpenseCategory, { amount: number; count: number }>();
  let total = 0;
  for (const t of txs) {
    if (!isExpense(t)) continue;
    const c = t.category as ExpenseCategory;
    const cur = map.get(c) ?? { amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    map.set(c, cur);
    total += t.amount;
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v, pct: total ? v.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function monthlySeries(txs: Transaction[], months: number, today = TODAY) {
  const out: { key: string; label: string; income: number; expenses: number; savings: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = subMonths(today, i);
    const t = totals(inRange(txs, startOfMonth(m), endOfMonth(m)));
    out.push({ key: format(m, "yyyy-MM"), label: format(m, "MMM yy"), income: t.income, expenses: t.expenses, savings: t.savings });
  }
  return out;
}

export function dailySeries(txs: Transaction[], start: Date, end: Date) {
  const map = new Map<string, number>();
  for (const t of txs) if (isExpense(t)) map.set(t.date.slice(0, 10), (map.get(t.date.slice(0, 10)) ?? 0) + t.amount);
  return eachDayOfInterval({ start, end }).map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return { date: key, label: format(d, "d MMM"), amount: map.get(key) ?? 0 };
  });
}

export function byMerchant(txs: Transaction[], limit = 8) {
  const map = new Map<string, { amount: number; count: number; category: string }>();
  for (const t of txs) {
    if (!isExpense(t)) continue;
    const cur = map.get(t.merchant) ?? { amount: 0, count: 0, category: t.category };
    cur.amount += t.amount;
    cur.count += 1;
    map.set(t.merchant, cur);
  }
  return [...map.entries()]
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dayOfWeekSpend(txs: Transaction[], start: Date, end: Date) {
  const days = eachDayOfInterval({ start, end });
  const dayCounts = Array(7).fill(0);
  days.forEach((d) => dayCounts[getDay(d)]++);
  const totalsArr = Array(7).fill(0);
  for (const t of txs) if (isExpense(t) && !t.recurring) totalsArr[getDay(parseISO(t.date))] += t.amount;
  const rows = [1, 2, 3, 4, 5, 6, 0].map((i) => ({
    day: DOW[i],
    weekend: i === 0 || i === 6,
    avg: dayCounts[i] ? totalsArr[i] / dayCounts[i] : 0,
  }));
  const wd = rows.filter((r) => !r.weekend);
  const we = rows.filter((r) => r.weekend);
  return {
    rows,
    weekdayAvg: wd.reduce((s, r) => s + r.avg, 0) / wd.length,
    weekendAvg: we.reduce((s, r) => s + r.avg, 0) / we.length,
  };
}

export function categoryMonthAvg(txs: Transaction[], months: number, today = TODAY) {
  const start = startOfMonth(subMonths(today, months));
  const end = endOfMonth(subMonths(today, 1));
  const rows = byCategory(inRange(txs, start, end));
  const out: Partial<Record<ExpenseCategory, number>> = {};
  rows.forEach((r) => (out[r.category] = r.amount / months));
  return out;
}
