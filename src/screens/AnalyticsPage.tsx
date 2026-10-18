import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Repeat, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Amount, CategoryBadge, CategoryDot, DeltaBadge, EmptyState, KpiCard, MoneyTooltip, PageIntro, SectionCard, axisTick, inrAxis } from "@/components/common";
import { PeriodSelect } from "@/components/layout/TopBar";
import { useAppStore } from "@/store/AppStore";
import { usePeriodData } from "@/hooks/useFinanceData";
import { byMerchant, dayOfWeekSpend, isExpense, monthlySeries } from "@/lib/analytics";
import { formatDate, formatINR, pctChange } from "@/lib/format";
import { CATEGORY_META } from "@/lib/categories";
import { TODAY } from "@/lib/period";
import { BarChart3, CalendarDays, Receipt, Store } from "lucide-react";

export function AnalyticsPage() {
  const { state } = useAppStore();
  const { range, current, totals: t, prevTotals: pt, categories, prevCategories } = usePeriodData();
  const navigate = useNavigate();
  const goCat = (category: string) => navigate({ to: "/transactions", search: { category } });

  const monthly = useMemo(() => monthlySeries(state.transactions, Math.max(6, range.months)), [state.transactions, range.months]);
  const merchants = useMemo(() => byMerchant(current, 8), [current]);
  const dow = useMemo(() => dayOfWeekSpend(current, range.start, range.end < TODAY ? range.end : TODAY), [current, range]);
  const expenses = current.filter(isExpense);
  const avgTx = expenses.length ? t.expenses / expenses.length : 0;
  const largest = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 6);
  const recurring = useMemo(() => {
    const m = new Map<string, { merchant: string; amount: number; category: string; count: number }>();
    state.transactions.filter((x) => x.recurring && x.type === "expense").forEach((x) => {
      const c = m.get(x.merchant) ?? { merchant: x.merchant, amount: x.amount, category: x.category, count: 0 };
      c.count++;
      m.set(x.merchant, c);
    });
    return [...m.values()].sort((a, b) => b.amount - a.amount);
  }, [state.transactions]);

  if (!state.hydrated || state.transactions.length === 0) {
    return <div className="space-y-6"><PageIntro title="Analytics" description="Explore trends and patterns in your financial activity." /><SectionCard><EmptyState icon={BarChart3} title="No transaction data available" description="Analytics will appear here after transaction data is available." /></SectionCard></div>;
  }

  const mom = categories.map((c) => {
    const p = prevCategories.find((x) => x.category === c.category)?.amount ?? 0;
    return { category: c.category, current: c.amount, previous: p, change: pctChange(c.amount, p), diff: c.amount - p };
  });
  const totalDiff = t.expenses - pt.expenses;
  const drivers = [...mom].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3);

  return (
    <div className="space-y-6">
      <PageIntro title="Spending analytics" description={`${range.label} · ${range.rangeLabel}`} actions={<div className="sm:hidden"><PeriodSelect /></div>} />

      <SectionCard className="border-ai/30 bg-ai-soft/30" title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-ai" /> What changed</span>} description={range.compareLabel}>
        <p className="text-sm text-foreground">
          Total spending {totalDiff >= 0 ? "rose" : "fell"} by <span className="font-semibold num">{formatINR(Math.abs(totalDiff))}</span> ({pt.expenses ? `${Math.round(Math.abs(totalDiff / pt.expenses) * 100)}%` : "no prior data"}) to <span className="font-semibold num">{formatINR(t.expenses)}</span>.
          {drivers.length > 0 && " Biggest contributors: "}
          {drivers.map((d, i) => (
            <span key={d.category}>
              <button className="font-semibold underline decoration-dotted underline-offset-2" onClick={() => goCat(d.category)}>{d.category}</button> ({d.diff >= 0 ? "+" : "−"}{formatINR(Math.abs(d.diff))}){i < drivers.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total spent" value={formatINR(t.expenses)} delta={pctChange(t.expenses, pt.expenses)} invert icon={BarChart3} />
        <KpiCard label="Average transaction" value={formatINR(avgTx)} hint={`${expenses.length} expenses`} icon={Receipt} tone="ai" />
        <KpiCard label="Weekday avg / day" value={formatINR(dow.weekdayAvg)} hint="Excl. recurring bills" icon={CalendarDays} />
        <KpiCard label="Weekend avg / day" value={formatINR(dow.weekendAvg)} delta={pctChange(dow.weekendAvg, dow.weekdayAvg)} invert hint="vs weekday" icon={CalendarDays} tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Monthly spending trend" description="Expenses and income per month">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={inrAxis} width={56} />
                <Tooltip content={<MoneyTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="income" name="Income" stroke="var(--success)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Category breakdown" description="Click a bar to inspect transactions">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={categories} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={inrAxis} />
                <YAxis type="category" dataKey="category" tick={axisTick} axisLine={false} tickLine={false} width={96} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="amount" name="Spent" radius={[0, 4, 4, 0]} className="cursor-pointer" onClick={(d: { category?: string }) => d.category && goCat(d.category)}>
                  {categories.map((c) => <Cell key={c.category} fill={CATEGORY_META[c.category].color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Income vs. expenses" description="Net position by month">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={inrAxis} width={56} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="income" name="Income" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Weekday vs. weekend" description="Average discretionary spend per day of week">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={dow.rows}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={inrAxis} width={56} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="avg" name="Avg / day" radius={[4, 4, 0, 0]}>
                  {dow.rows.map((r) => <Cell key={r.day} fill={r.weekend ? "var(--ai)" : "var(--chart-1)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Top merchants" description="Click to view transactions" bodyClassName="px-3">
          <ul>
            {merchants.map((m, i) => (
              <li key={m.merchant}>
                <Link to="/transactions" search={{ q: m.merchant }} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent">
                  <span className="w-4 text-xs text-muted-foreground num">{i + 1}</span>
                  <Store className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{m.merchant}</span><span className="text-[11px] text-muted-foreground">{m.count} txns · {m.category}</span></span>
                  <span className="text-sm font-semibold num">{formatINR(m.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Largest expenses" bodyClassName="px-3">
          <ul>
            {largest.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <CategoryDot category={x.category} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{x.merchant}</span><span className="text-[11px] text-muted-foreground">{formatDate(x.date, "d MMM yyyy")}</span></span>
                {x.anomaly?.flagged && <Badge variant="ai">Unusual</Badge>}
                <Amount value={x.amount} type="expense" className="text-sm" />
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title={<span className="flex items-center gap-2"><Repeat className="size-4 text-ai" /> Recurring expenses</span>} description={`${formatINR(recurring.reduce((s, r) => s + r.amount, 0))} per month in fixed commitments`} bodyClassName="px-3">
          <ul>
            {recurring.map((r) => (
              <li key={r.merchant} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{r.merchant}</span><span className="text-[11px] text-muted-foreground">Monthly · {r.count} payments seen</span></span>
                <span className="text-sm font-semibold num">{formatINR(r.amount)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Period-over-period comparison" description={range.compareLabel} bodyClassName="p-0 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground"><th className="px-5 py-2.5">Category</th><th className="px-3 py-2.5 text-right">Current</th><th className="px-3 py-2.5 text-right">Previous</th><th className="px-3 py-2.5 text-right">Difference</th><th className="px-5 py-2.5 text-right">Change</th></tr></thead>
            <tbody>
              {mom.map((r) => (
                <tr key={r.category} className="cursor-pointer border-b last:border-0 hover:bg-accent/50" onClick={() => goCat(r.category)}>
                  <td className="px-5 py-2.5"><CategoryBadge category={r.category} /></td>
                  <td className="px-3 py-2.5 text-right font-semibold num">{formatINR(r.current)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground num">{formatINR(r.previous)}</td>
                  <td className="px-3 py-2.5 text-right num">{formatINR(r.diff, { sign: true })}</td>
                  <td className="px-5 py-2.5 text-right"><DeltaBadge value={r.change} invert /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
