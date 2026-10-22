import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { endOfMonth, format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Gauge,
  PiggyBank,
  Sparkles,
  Upload,
  Wallet,
  ReceiptText,
  Percent,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Amount,
  CategoryBadge,
  CategoryDot,
  EmptyState,
  KpiCard,
  MoneyTooltip,
  ProgressBar,
  SectionCard,
  axisTick,
  inrAxis,
} from "@/components/common";
import { PeriodSelect } from "@/components/layout/TopBar";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";
import { useAppStore } from "@/store/AppStore";
import { useBudgetRows, usePeriodData } from "@/hooks/useFinanceData";
import { useForecast } from "@/hooks/useModels";
import { dailySeries, inRange, monthlySeries, totals } from "@/lib/analytics";
import { formatDate, formatINR, formatPct, pctChange } from "@/lib/format";
import { CATEGORY_META } from "@/lib/categories";
import { TODAY } from "@/lib/period";
import { startOfMonth } from "date-fns";

function greeting() {
  const h = TODAY.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function OverviewPage() {
  const { state } = useAppStore();
  const { range, current, prev, totals: t, prevTotals: pt, categories } = usePeriodData();
  const rows = useBudgetRows("period");
  const [months, setMonths] = useState("6");
  const [openTx, setOpenTx] = useState<string | null>(null);
  const navigate = useNavigate();

  const monthly = useMemo(
    () => monthlySeries(state.transactions, Number(months)),
    [state.transactions, months],
  );
  const trend = useMemo(() => {
    if (range.months === 1)
      return dailySeries(current, range.start, range.end < TODAY ? range.end : TODAY).map((d) => ({
        label: d.label,
        amount: d.amount,
      }));
    return monthlySeries(state.transactions, range.months).map((m) => ({
      label: m.label,
      amount: m.expenses,
    }));
  }, [current, range, state.transactions]);

  const budgetTotal = rows.reduce((s, r) => s + r.budget, 0);
  const budgetSpent = rows.reduce((s, r) => s + r.spent, 0);
  const utilization = budgetTotal ? budgetSpent / budgetTotal : null;
  const analyzedTransactions = current.filter((transaction) => transaction.anomaly != null).length;
  const unusualTransactions = current.filter((transaction) => transaction.anomaly?.flagged).length;
  const recent = state.transactions.slice(0, 7);
  const firstName = state.profile.name.split(" ")[0];

  if (!state.hydrated) return <OverviewSkeleton />;

  if (state.transactions.length === 0)
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-brand p-6 text-primary-foreground shadow-elevated sm:p-8">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Financial overview</h1>
          <p className="mt-2 text-sm opacity-85">
            Your financial overview will appear here once your financial data is available.
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link to="/upload">
              <Upload /> Import statement
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Total income", Wallet],
            ["Total expenses", ReceiptText],
            ["Current savings", PiggyBank],
            ["Savings rate", Percent],
            ["Budget utilization", Gauge],
            ["Unusual transactions", AlertTriangle],
          ].map(([label, Icon]) => (
            <KpiCard
              key={String(label)}
              label={String(label)}
              value="—"
              icon={Icon as typeof Wallet}
            />
          ))}
        </div>
        <SectionCard>
          <EmptyState
            icon={ReceiptText}
            title="No transaction data is available yet"
            description="Import a statement to see your financial activity here."
          />
        </SectionCard>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-6 text-primary-foreground shadow-elevated sm:p-8">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-sm opacity-80">{format(TODAY, "EEEE, d MMMM yyyy")}</p>
            <h1 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-sm opacity-85">
              Showing <span className="font-semibold">{range.label.toLowerCase()}</span> ·{" "}
              {range.rangeLabel}. You've saved{" "}
              <span className="font-semibold">{formatINR(Math.max(0, t.savings))}</span> so far.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="sm:hidden [&_button]:text-foreground">
              <PeriodSelect />
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link to="/upload">
                <Upload /> Import statement
              </Link>
            </Button>
            <Button asChild variant="ai" size="sm">
              <Link to="/forecast">
                <Sparkles /> See forecast
              </Link>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary-foreground/5" />
        <div className="pointer-events-none absolute -bottom-24 right-24 size-56 rounded-full bg-primary-foreground/5" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total income"
          value={formatINR(t.income)}
          delta={pctChange(t.income, pt.income)}
          icon={Wallet}
          tone="success"
        />
        <KpiCard
          label="Total expenses"
          value={formatINR(t.expenses)}
          delta={pctChange(t.expenses, pt.expenses)}
          invert
          icon={ReceiptText}
        />
        <KpiCard
          label="Current savings"
          value={formatINR(t.savings)}
          delta={pctChange(t.savings, pt.savings)}
          icon={PiggyBank}
          tone="success"
        />
        <KpiCard
          label="Savings rate"
          value={formatPct(t.savingsRate)}
          icon={Percent}
          tone="ai"
          hint={
            t.savingsRate != null && pt.savingsRate != null
              ? `${t.savingsRate >= pt.savingsRate ? "+" : ""}${Math.round((t.savingsRate - pt.savingsRate) * 100)} pts`
              : "No prior data"
          }
        />
        <KpiCard
          label="Budget utilization"
          value={formatPct(utilization)}
          icon={Gauge}
          tone={
            utilization && utilization > 1
              ? "destructive"
              : utilization && utilization > 0.85
                ? "warning"
                : "default"
          }
          hint={
            budgetTotal
              ? `${formatINR(budgetSpent, { compact: true })} of ${formatINR(budgetTotal, { compact: true })}`
              : "Budget data unavailable"
          }
        />
        <KpiCard
          label="Unusual transactions"
          value={String(unusualTransactions)}
          icon={AlertTriangle}
          tone={unusualTransactions ? "warning" : "ai"}
          hint={
            analyzedTransactions
              ? `${analyzedTransactions} analyzed in this period`
              : "Run analysis to check this period"
          }
        />
      </div>
      <p className="-mt-3 text-[11px] text-muted-foreground">Changes shown {range.compareLabel}.</p>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Income vs. expenses"
          description="Monthly income, expenses and net savings"
          action={
            <Tabs value={months} onValueChange={setMonths}>
              <TabsList className="h-8">
                <TabsTrigger value="3" className="text-xs">
                  3M
                </TabsTrigger>
                <TabsTrigger value="6" className="text-xs">
                  6M
                </TabsTrigger>
                <TabsTrigger value="12" className="text-xs">
                  12M
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={monthly} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={inrAxis}
                  width={56}
                />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar dataKey="savings" name="Savings" fill="var(--ai)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Spending breakdown"
          description="Click a category to see its transactions"
        >
          {categories.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No spending yet"
              description="Import a statement to see your breakdown."
            />
          ) : (
            <>
              <div className="relative h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                      stroke="none"
                      onClick={(d: { category?: string }) =>
                        d.category &&
                        navigate({ to: "/transactions", search: { category: d.category } })
                      }
                      className="cursor-pointer"
                    >
                      {categories.map((c) => (
                        <Cell key={c.category} fill={CATEGORY_META[c.category].color} />
                      ))}
                    </Pie>
                    <Tooltip content={<MoneyTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Spent</p>
                    <p className="font-display text-lg font-semibold num">
                      {formatINR(t.expenses, { compact: true })}
                    </p>
                  </div>
                </div>
              </div>
              <ul className="mt-3 space-y-1">
                {categories.slice(0, 7).map((c) => (
                  <li key={c.category}>
                    <Link
                      to="/transactions"
                      search={{ category: c.category }}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                    >
                      <CategoryDot category={c.category} />
                      <span className="flex-1 truncate">{c.category}</span>
                      <span className="font-semibold num">{formatINR(c.amount)}</span>
                      <span className="w-10 text-right text-xs text-muted-foreground num">
                        {formatPct(c.pct)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Spending trend"
          description={range.months === 1 ? "Daily spending" : "Monthly spending"}
        >
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ai)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--ai)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={inrAxis}
                  width={56}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="Spent"
                  stroke="var(--ai)"
                  strokeWidth={2}
                  fill="url(#spendFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <OutlookCard />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Budget health"
          description={`${range.label} vs. allocated budget`}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/budgets">
                Manage <ArrowRight />
              </Link>
            </Button>
          }
        >
          {budgetTotal === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No budget data available"
              description="Your budget summary will appear here when budget data is available."
            />
          ) : (
            <ul className="space-y-4">
              {[...rows]
                .sort((a, b) => b.pct - a.pct)
                .slice(0, 6)
                .map((r) => (
                  <li key={r.category}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <CategoryDot category={r.category} />
                        <span className="truncate font-medium">{r.category}</span>
                      </span>
                      <span className="text-xs text-muted-foreground num">
                        <span className="font-semibold text-foreground">{formatINR(r.spent)}</span>{" "}
                        / {formatINR(r.budget)}
                      </span>
                    </div>
                    <ProgressBar value={r.pct} status={r.status} />
                    <p
                      className={`mt-1 text-[11px] num ${r.remaining < 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                    >
                      {r.remaining < 0
                        ? `${formatINR(-r.remaining)} over budget`
                        : `${formatINR(r.remaining)} remaining`}
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          className="xl:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <BrainCircuit className="size-4 text-ai" /> AI financial insights
            </span>
          }
        >
          <EmptyState
            icon={Sparkles}
            title="Insights aren’t available yet"
            description="Insights will be available once your financial data has been processed."
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Recent transactions"
        description="Latest activity across all accounts"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/transactions">
              View all <ArrowRight />
            </Link>
          </Button>
        }
        bodyClassName="p-0 pt-3"
      >
        {recent.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No transactions"
            description="Upload a statement to get started."
            action={
              <Button asChild size="sm">
                <Link to="/upload">Upload statement</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Merchant</th>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Category</th>
                  <th className="px-3 py-2.5 font-medium">Payment</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => (
                  <tr
                    key={tx.id}
                    className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/60"
                    onClick={() => setOpenTx(tx.id)}
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-foreground">{tx.merchant}</p>
                      <p className="truncate text-xs text-muted-foreground">{tx.description}</p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground num">
                      {formatDate(tx.date, "d MMM, h:mm a")}
                    </td>
                    <td className="px-3 py-3">
                      <CategoryBadge category={tx.category} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{tx.paymentMethod}</td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          tx.status === "completed"
                            ? "success"
                            : tx.status === "pending"
                              ? "warning"
                              : "destructive"
                        }
                        className="capitalize"
                      >
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Amount value={tx.amount} type={tx.type} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <TransactionDetailSheet txId={openTx} onOpenChange={(o) => !o && setOpenTx(null)} />
    </div>
  );
}

function OutlookCard() {
  const { state } = useAppStore();
  const { data, isLoading, error } = useForecast(30);
  const monthStart = startOfMonth(TODAY);
  const mtd = totals(inRange(state.transactions, monthStart, TODAY));
  const monthEnd = format(endOfMonth(TODAY), "yyyy-MM-dd");
  const rest =
    data?.status === "ready"
      ? data.points.filter((p) => p.date <= monthEnd).reduce((s, p) => s + p.predicted, 0)
      : null;
  const projected = rest != null ? mtd.expenses + rest : null;
  const daysLeft = Math.round((parseISO(monthEnd).getTime() - TODAY.getTime()) / 86400000) + 1;

  return (
    <SectionCard
      title="Upcoming outlook"
      description={`Rest of ${format(TODAY, "MMMM")} · ${daysLeft} days left`}
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-10" />
        </div>
      ) : rest == null ? (
        <EmptyState
          icon={TrendingUp}
          title={error ? "Outlook unavailable" : "Forecasts aren’t available yet"}
          description={
            error?.message ??
            "Add at least 30 days of expense history to calculate a spending baseline."
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-xs text-muted-foreground">
              Expected spending for the rest of the month
            </p>
            <p className="font-display text-2xl font-semibold num">{formatINR(rest)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3">
              <p className="text-[11px] text-muted-foreground">Projected month-end expenses</p>
              <p className="font-display text-lg font-semibold num">{formatINR(projected!)}</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-[11px] text-muted-foreground">Projected savings</p>
              <p
                className={`font-display text-lg font-semibold num ${mtd.income - projected! >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatINR(mtd.income - projected!)}
              </p>
            </div>
          </div>
          <Button asChild variant="soft" className="w-full">
            <Link to="/forecast">
              Open spending forecast <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
