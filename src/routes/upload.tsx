import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { FilterBar, type FilterState } from "@/components/upload/FilterBar";
import { SecurityNote } from "@/components/upload/SecurityNote";
import { StatCards } from "@/components/upload/StatCards";
import { TransactionsTable } from "@/components/upload/TransactionsTable";
import { UploadZone } from "@/components/upload/UploadZone";
import { Button } from "@/components/ui/button";
import {
  SAMPLE_CSV,
  StatementParseError,
  parseStatementCsv,
  type Transaction,
} from "@/lib/transactions";

const TITLE = "Upload & Analyze — MoneyMind AI";
const DESCRIPTION =
  "Upload a bank or PhonePe statement as PDF or CSV and get instant, AI-categorized transaction insights in MoneyMind AI.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: UploadAnalyzePage,
});

const emptyFilters = (bounds: [number, number]): FilterState => ({
  categories: [],
  types: [],
  range: undefined,
  amount: bounds,
});

function UploadAnalyzePage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters([0, 0]));

  const amountBounds = useMemo<[number, number]>(() => {
    if (!transactions?.length) return [0, 0];
    const amounts = transactions.map((t) => t.amount);
    return [Math.floor(Math.min(...amounts)), Math.ceil(Math.max(...amounts))];
  }, [transactions]);

  const availableCategories = useMemo(
    () => Array.from(new Set(transactions?.map((t) => t.category) ?? [])).sort(),
    [transactions],
  );

  const load = (text: string) => {
    const parsed = parseStatementCsv(text);
    const amounts = parsed.map((t) => t.amount);
    const bounds: [number, number] = [
      Math.floor(Math.min(...amounts)),
      Math.ceil(Math.max(...amounts)),
    ];
    setTransactions(parsed);
    setFilters(emptyFilters(bounds));
    setStatus("idle");
    setError(null);
  };

  const handleFile = async (file: File) => {
    setStatus("processing");
    setError(null);
    await new Promise((r) => setTimeout(r, 900));
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        throw new StatementParseError(
          "PDF statements are parsed by the MoneyMind extraction service, which isn't reachable from this session. Export the same statement as CSV and upload it here.",
        );
      }
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new StatementParseError("Unsupported file type. Please upload a PDF or CSV statement.");
      }
      load(await file.text());
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof StatementParseError
          ? err.message
          : "Something went wrong while processing your file. Make sure it is a valid bank or UPI statement and try again.",
      );
    }
  };

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((t) => {
      if (filters.categories.length && !filters.categories.includes(t.category)) return false;
      if (filters.types.length && !filters.types.includes(t.type)) return false;
      if (t.amount < filters.amount[0] || t.amount > filters.amount[1]) return false;
      const { from, to } = (filters.range ?? {}) as DateRange;
      if (from && t.date && new Date(t.date) < new Date(from.toDateString())) return false;
      if (to && t.date && new Date(t.date) > new Date(to.toDateString())) return false;
      return true;
    });
  }, [transactions, filters]);

  const activeCount =
    (filters.categories.length ? 1 : 0) +
    (filters.types.length ? 1 : 0) +
    (filters.range?.from ? 1 : 0) +
    (filters.amount[0] !== amountBounds[0] || filters.amount[1] !== amountBounds[1] ? 1 : 0);

  const totals = filtered.reduce(
    (acc, t) => {
      if (t.type === "Debit") acc.debit += t.amount;
      else acc.credit += t.amount;
      return acc;
    },
    { debit: 0, credit: 0 },
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
      <section className="max-w-2xl">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-strong">
          Upload &amp; Analyze
        </span>
        <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">Understand your spending</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Upload a bank or PhonePe statement as <span className="font-semibold text-foreground">PDF</span>{" "}
          or <span className="font-semibold text-foreground">CSV</span> to get instant,
          AI-categorized transaction insights — no spreadsheets, no manual tagging.
        </p>
      </section>

      {!transactions ? (
        <div className="mt-12 space-y-6 duration-500 animate-in fade-in slide-in-from-bottom-3">
          <UploadZone
            onFile={handleFile}
            status={status}
            error={error}
            onRetry={() => {
              setStatus("idle");
              setError(null);
            }}
            onSample={() => load(SAMPLE_CSV)}
          />
          <SecurityNote />
        </div>
      ) : (
        <div className="mt-12 space-y-8 duration-500 animate-in fade-in slide-in-from-bottom-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-accent-soft bg-accent-soft/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2.5 text-sm font-semibold text-accent-strong">
              <CheckCircle2 className="h-4 w-4" />
              {transactions.length} transactions loaded and categorized
            </p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 bg-card"
              onClick={() => {
                setTransactions(null);
                setStatus("idle");
                setError(null);
              }}
            >
              <RotateCcw /> Upload a new file
            </Button>
          </div>

          <StatCards totalDebit={totals.debit} totalCredit={totals.credit} count={filtered.length} />

          <FilterBar
            state={filters}
            onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
            availableCategories={availableCategories}
            amountBounds={amountBounds}
            activeCount={activeCount}
            onReset={() => setFilters(emptyFilters(amountBounds))}
          />

          <div key={filtered.length} className="duration-300 animate-in fade-in">
            <TransactionsTable rows={filtered} />
          </div>

          <section className="space-y-3">
            <Link
              to="/dashboard"
              className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-green/50 hover:shadow-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-brand bg-gradient-brand">
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold">What&apos;s next: open your Dashboard</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  See spending trends, category breakdowns, and budget-vs-actual charts powered by
                  the statement you just uploaded.
                </span>
              </span>
            </Link>
            <p className="text-xs text-muted-foreground">
              Categories look off? Re-upload a corrected CSV or try a different statement — the model
              performs better with clearer transaction descriptions.
            </p>
          </section>

          <SecurityNote />
        </div>
      )}
    </main>
  );
}
