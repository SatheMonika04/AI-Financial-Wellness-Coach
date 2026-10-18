import { Link } from "@tanstack/react-router";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Info, MinusCircle, PlusCircle, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState, PageIntro, ProgressBar, SectionCard, axisTick } from "@/components/common";
import { useAppStore } from "@/store/AppStore";
import { useWellness } from "@/hooks/useModels";
import { cn } from "@/lib/utils";

function ScoreRing({ score }: { score: number | null }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const v = score ?? 0;
  const color = score == null ? "var(--muted-foreground)" : v >= 80 ? "var(--success)" : v >= 65 ? "var(--chart-6)" : v >= 50 ? "var(--warning)" : "var(--destructive)";
  return (
    <div className="relative size-44">
      <svg viewBox="0 0 160 160" className="size-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-4xl font-semibold num">{score ?? "—"}</p>
          <p className="text-xs text-muted-foreground">out of 100</p>
        </div>
      </div>
    </div>
  );
}

export function WellnessPage() {
  const { state } = useAppStore();
  const { data, isLoading } = useWellness();
  const history: { label: string; score: number | null }[] = [];

  if (!state.hydrated) return <div className="space-y-6"><Skeleton className="h-16" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (isLoading || !data) return <div className="space-y-6"><PageIntro title="Financial wellness" description="Your financial wellness summary will appear here when real financial data is available." /><SectionCard><EmptyState icon={Info} title="No wellness results available" description="A wellness score and guidance will appear after financial data is processed by a connected model." /></SectionCard></div>;

  const prev = history.at(-2)?.score;
  const change = data.overall != null && prev != null ? data.overall - prev : null;

  return (
    <div className="space-y-6">
      <PageIntro title="Financial wellness" description="A guidance score built from your savings, spending, budgets, debt and goals." />

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Your wellness score" description={`Based on the last 3 completed months`}>
          <div className="flex flex-col items-center gap-3 text-center">
            <ScoreRing score={data.overall} />
            <Badge variant={data.overall == null ? "muted" : data.overall >= 65 ? "success" : data.overall >= 50 ? "warning" : "destructive"} className="text-sm">{data.level}</Badge>
            {change != null && <p className="text-xs text-muted-foreground">{change >= 0 ? "Up" : "Down"} <span className="font-semibold text-foreground">{Math.abs(change)} points</span> since last month</p>}
            {data.overall == null && <p className="text-xs text-muted-foreground">Add income, transactions and goals to calculate your score.</p>}
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-2" title="Score breakdown" description="Each factor is weighted; missing information is excluded rather than counted as zero">
          <div className="grid gap-4 sm:grid-cols-2">
            {data.components.map((c) => (
              <div key={c.key} className="rounded-xl border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">{c.label}</p>
                  {c.score == null ? <Badge variant="muted">Insufficient data</Badge> : <span className="font-display text-lg font-semibold num">{c.score}</span>}
                </div>
                <ProgressBar value={(c.score ?? 0) / 100} status={c.score == null ? "ok" : c.score >= 70 ? "success" : c.score >= 50 ? "warning" : "over"} />
                <p className="mt-2 text-xs text-muted-foreground">{c.detail} · weight {Math.round(c.weight * 100)}%</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Recent score changes" description="Monthly wellness score">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }} />
                <Line type="monotone" dataKey="score" name="Score" stroke="var(--success)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="What's helping & hurting">
          {data.factors.length === 0 ? (
            <EmptyState icon={Info} title="No strong factors yet" />
          ) : (
            <ul className="space-y-3">
              {data.factors.map((f) => (
                <li key={f.label} className="flex gap-3">
                  {f.impact === "positive" ? <PlusCircle className="mt-0.5 size-4 shrink-0 text-success" /> : <MinusCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
                  <div><p className="text-sm font-semibold">{f.label}</p><p className="text-xs text-muted-foreground">{f.detail}</p></div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Your action plan" description="Small steps with the biggest impact" action={<Button asChild size="sm" variant="ghost"><Link to="/goals"><Target /> Goals</Link></Button>}>
          <ol className="space-y-3">
            {data.recommendations.map((r, i) => (
              <li key={r.title} className="flex gap-3">
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", r.impact === "high" ? "bg-ai text-ai-foreground" : "bg-ai-soft text-ai")}>{i + 1}</span>
                <div><p className="text-sm font-semibold">{r.title}</p><p className="text-xs text-muted-foreground">{r.detail}</p></div>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <CheckCircle2 className="size-4 shrink-0" /> MoneyMind AI is a guidance tool and does not provide professional financial advice. Consult a certified financial planner for major decisions.
      </p>
    </div>
  );
}
