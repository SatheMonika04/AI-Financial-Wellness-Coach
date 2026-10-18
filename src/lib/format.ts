import { format, parseISO } from "date-fns";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatINR(value: number, opts: { compact?: boolean; sign?: boolean } = {}) {
  const abs = Math.abs(value);
  let body: string;
  if (opts.compact && abs >= 1e7) body = `₹${(abs / 1e7).toFixed(2)}Cr`;
  else if (opts.compact && abs >= 1e5) body = `₹${(abs / 1e5).toFixed(2)}L`;
  else if (opts.compact && abs >= 1e3) body = `₹${(abs / 1e3).toFixed(1)}K`;
  else body = inr.format(abs);
  const sign = value < 0 ? "−" : opts.sign && value > 0 ? "+" : "";
  return `${sign}${body}`;
}

export const formatNumber = (n: number) => num.format(n);

export function formatPct(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string, pattern = "d MMM yyyy") {
  return format(parseISO(iso), pattern);
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / Math.abs(previous);
}
