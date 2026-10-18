import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Area, ComposedChart, CartesianGrid, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { endOfMonth, format, parseISO, startOfMonth, subDays } from "date-fns";
import { CalendarClock, Cpu, History, Info, Loader2, PiggyBank, RefreshCw, TrendingUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryDot, DeltaBadge, DemoBadge, EmptyState, KpiCard, MoneyTooltip, PageIntro, SectionCard, axisTick, inrAxis } from "@/components/common";
import { useAppStore } from "@/store/AppStore";
import { useForecast } from "@/hooks/useModels";
import { inRange, totals } from "@/lib/analytics";
import { formatINR, pctChange } from "@/lib/format";
import { TODAY } from "@/lib/period";

export function ForecastPage() {
  const { state } = useAppStore();
  const { data, isLoading, isFetching, refetch, history } = useForecast(30);
  const [view, setView] = useState("60");

  const chart = useMemo(() => {
    if (!data || data.status !== "ready") return [];
    const hist = history.slice(-Number(view)).map((h) => ({ date: h.date, label: format(parseISO(h.date), "d MMM"), actual: h.amount, predicted: null as number | null, lower: undefined as number | undefined, upper: undefined as number | undefined }));
    const fut = data.points.map((p) => ({ date: p.date, label: format(parseISO(p.date), "d MMM"), actual: null as number | null, predicted: p.predicted, lower: p.lower, upper: p.upper }));
    return [...hist, ...fut];
  }, [data, history, view]);

  if (isLoading || !state.hydrated) return <div className="space-y-6"><Skeleton className="h-16" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-96" /></div>;

  if (!data || data.status === "insufficient_data") {
    return (
      <div>
        <PageIntro title="Spending forecast" />
        <SectionCard>
          <EmptyState icon={History} title="Not enough history to forecast" description={`The forecasting model needs at least ${data?.minHistoryDays ?? 30} days of transactions. You currently have ${history.filter((h) => h.amount > 0).length} days with spending.`} action={<Button asChild><Link to="/upload"><Upload /> Upload statements</Link></Button>} />
        </SectionCard>
      </div>
    );
  }

  const next7 = data.points.slice(0, 7).reduce((s, p) => s + p.predicted, 0);
  const next30 = data.points.reduce((s, p) => s + p.predicted, 0);
  const last7 = history.slice(-7).reduce((s, p) => s + p.amount, 0);
  const last30 = history.slice(-30).reduce((s, p) => s + p.amount, 0);
  const monthEnd = format(endOfMonth(TODAY), "yyyy-MM-dd");
  const mtd = totals(inRange(state.transactions, startOfMonth(TODAY), TODAY));
  const rest = data.points.filter((p) => p.date <= monthEnd).reduce((s, p) => s + p.predicted, 0);
  const projected = mtd.expenses + rest;
  const lastMonth = totals(inRange(state.transactions, startOfMonth(subDays(startOfMonth(TODAY), 1)), endOfMonth(subDays(startOfMonth(TODAY), 1))));
  const hasIntervals = data.points.some((p) => p.lower != null && p.upper != null);
  const todayKey = format(TODAY, "d MMM");

  return (
    <div className="space-y-6">
      <PageIntro
        title="Spending forecast"
        description="Projected daily spending based on your historical patterns."
        badge={<DemoBadge label="Demo forecast" tip="Predictions are a simple demo baseline. Real predictions will come from the saved forecasting model through the backend." />}
        actions={<Button variant="outline" onClick={() => refetch()} disabled={isFetching}>{isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh forecast</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Next 7 days" value={formatINR(next7)} delta={pctChange(next7, last7)} invert hint="vs last 7 days" icon={TrendingUp} tone="ai" />
        <KpiCard label="Next 30 days" value={formatINR(next30)} delta={pctChange(next30, last30)} invert hint="vs last 30 days" icon={CalendarClock} tone="ai" />
        <KpiCard label="Projected month-end expenses" value={formatINR(projected)} delta={pctChange(projected, lastMonth.expenses)} invert hint="vs last month" icon={TrendingUp} />
        <KpiCard label="Projected savings" value={formatINR(mtd.income - projected)} hint={`Income ${formatINR(mtd.income, { compact: true })}`} icon={PiggyBank} tone={mtd.income - projected >= 0 ? "success" : "destructive"} />
      </div>

      <SectionCard
        title="Actual vs. predicted spending"
        description="Solid = historical · dashed = forecast"
        action={
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-8">
              <TabsTrigger value="30" className="text-xs">30D</TabsTrigger>
              <TabsTrigger value="60" className="text-xs">60D</TabsTrigger>
              <TabsTrigger value="120" className="text-xs">120D</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={chart}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={inrAxis} width={56} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              {hasIntervals && <Area dataKey="upper" name="Upper bound" stroke="none" fill="var(--ai-soft)" />}
              <ReferenceLine x={todayKey} stroke="var(--muted-foreground)" strokeDasharray="3 3" label={{ value: "Today", fontSize: 11, fill: "var(--muted-foreground)", position: "top" }} />
              <Line type="monotone" dataKey="actual" name="Historical" stroke="var(--chart-1)" strokeWidth={2} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="predicted" name="Forecast" stroke="var(--ai)" strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {!hasIntervals && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Info className="size-3" /> Prediction intervals will be shown when the forecasting model provides them.</p>}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title="Category forecast" description="Next 30 days vs last 30 days">
          {data.categoryForecasts?.length ? (
            <>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={data.categoryForecasts}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="category" tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={inrAxis} width={56} />
                    <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="last30" name="Last 30 days" fill="var(--chart-10)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="next30" name="Next 30 days" fill="var(--ai)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.categoryForecasts.map((c) => (
                  <div key={c.category} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <CategoryDot category={c.category} />
                    <span className="flex-1 truncate">{c.category}</span>
                    <span className="font-semibold num">{formatINR(c.next30)}</span>
                    <DeltaBadge value={pctChange(c.next30, c.last30)} invert />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={TrendingUp} title="Category forecasts unavailable" description="Shown when the model returns category-level predictions." />
          )}
        </SectionCard>

        <SectionCard title={<span className="flex items-center gap-2"><Cpu className="size-4 text-ai" /> Model information</span>}>
          <dl className="space-y-3 text-sm">
            {[
              ["Status", <Badge key="s" variant="ai">Demo mode — model not connected</Badge>],
              ["Generated", data.generatedAt.replace("T", " ")],
              ["Forecast horizon", `${data.horizonDays} days`],
              ["Historical coverage", `${data.history.days} days (${data.history.start} → ${data.history.end})`],
              ["Minimum history", `${data.minHistoryDays} days`],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{data.explanation}</p>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">Features expected from the model</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{data.featuresUsed.map((f) => <span key={f} className="rounded-md border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{f}</span>)}</div>
        </SectionCard>
      </div>
    </div>
  );
}
