import { endOfDay, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { PeriodKey } from "@/types";

export const TODAY = new Date();

export const PERIOD_OPTIONS: { value: PeriodKey; label: string; months: number }[] = [
  { value: "this_month", label: "This month", months: 1 },
  { value: "last_month", label: "Last month", months: 1 },
  { value: "last_3_months", label: "Last 3 months", months: 3 },
  { value: "last_6_months", label: "Last 6 months", months: 6 },
  { value: "last_12_months", label: "Last 12 months", months: 12 },
];

export interface PeriodRange {
  key: PeriodKey;
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
  rangeLabel: string;
  compareLabel: string;
  months: number;
}

export function getPeriodRange(key: PeriodKey, today = TODAY): PeriodRange {
  const opt = PERIOD_OPTIONS.find((o) => o.value === key) ?? PERIOD_OPTIONS[0];
  let start: Date, end: Date, prevStart: Date, prevEnd: Date, compareLabel: string;
  if (key === "this_month") {
    start = startOfMonth(today);
    end = endOfDay(today);
    prevStart = startOfMonth(subMonths(today, 1));
    prevEnd = endOfDay(subMonths(today, 1));
    compareLabel = "vs same days last month";
  } else if (key === "last_month") {
    const lm = subMonths(today, 1);
    start = startOfMonth(lm);
    end = endOfMonth(lm);
    prevStart = startOfMonth(subMonths(today, 2));
    prevEnd = endOfMonth(subMonths(today, 2));
    compareLabel = "vs previous month";
  } else {
    const n = opt.months;
    start = startOfMonth(subMonths(today, n - 1));
    end = endOfDay(today);
    prevStart = startOfMonth(subMonths(today, 2 * n - 1));
    prevEnd = endOfDay(subMonths(today, n));
    compareLabel = `vs previous ${n} months`;
  }
  return {
    key,
    start,
    end,
    prevStart,
    prevEnd,
    label: opt.label,
    rangeLabel: `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`,
    compareLabel,
    months: opt.months,
  };
}
