import { addDays, format, getDate, getDay, parseISO } from "date-fns";
import type { ExpenseCategory, ForecastPoint } from "@/types";
import type { ForecastService } from "@/services/forecastService";
import { delay } from "@/services/apiClient";
import { TODAY } from "@/lib/period";

const MIN_HISTORY = 30;

/** Demo baseline (weekday averages + recurring day-of-month spikes). Not the real forecasting model. */
export const mockForecastService: ForecastService = {
  async getForecast({ history, horizonDays, categoryLast30 }) {
    await delay(900);
    const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
    const base = {
      source: "demo" as const,
      generatedAt: format(TODAY, "yyyy-MM-dd'T'HH:mm"),
      horizonDays,
      minHistoryDays: MIN_HISTORY,
      history: { start: sorted[0]?.date ?? "", end: sorted.at(-1)?.date ?? "", days: sorted.length },
      featuresUsed: ["lag_1", "lag_7", "rolling_mean_7", "rolling_std_7", "expanding_mean", "day_of_week", "is_weekend", "is_month_end"],
    };
    if (sorted.filter((p) => p.amount > 0).length < MIN_HISTORY / 2 || sorted.length < MIN_HISTORY) {
      return { ...base, status: "insufficient_data", points: [], explanation: `At least ${MIN_HISTORY} days of history are needed.` };
    }
    const recent = sorted.slice(-84);
    const amounts = recent.map((p) => p.amount).sort((a, b) => a - b);
    const cap = amounts[Math.floor(amounts.length * 0.9)] ?? 0;
    const byDow = Array.from({ length: 7 }, () => ({ s: 0, n: 0 }));
    recent.forEach((p) => {
      const d = getDay(parseISO(p.date));
      byDow[d].s += Math.min(p.amount, cap);
      byDow[d].n += 1;
    });
    // Recurring spikes by day of month (rent, bills)
    const dom = new Map<number, number[]>();
    recent.forEach((p) => {
      if (p.amount > cap) {
        const k = getDate(parseISO(p.date));
        dom.set(k, [...(dom.get(k) ?? []), p.amount - cap]);
      }
    });
    const spikes = new Map<number, number>();
    dom.forEach((v, k) => v.length >= 2 && spikes.set(k, v.reduce((a, b) => a + b, 0) / 3));

    const last = parseISO(sorted.at(-1)!.date);
    const points: ForecastPoint[] = [];
    for (let i = 1; i <= horizonDays; i++) {
      const d = addDays(last, i);
      const w = byDow[getDay(d)];
      const predicted = Math.round((w.n ? w.s / w.n : 0) + (spikes.get(getDate(d)) ?? 0));
      points.push({ date: format(d, "yyyy-MM-dd"), predicted });
    }
    const categoryForecasts = categoryLast30
      ? (Object.entries(categoryLast30) as [ExpenseCategory, number][]).map(([category, last30], i) => ({
          category,
          last30: Math.round(last30),
          next30: Math.round(last30 * (0.94 + ((i * 37) % 15) / 100)),
        }))
      : undefined;
    return {
      ...base,
      status: "ready",
      points,
      categoryForecasts,
      explanation:
        "Demo projection: weekday spending averages from the last 12 weeks plus recurring monthly payments (rent, bills). Weekends are typically higher because of dining and shopping.",
    };
  },
};
