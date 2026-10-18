import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, Check, Eye, Loader2, Radar, ScanSearch, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryBadge, DemoBadge, EmptyState, KpiCard, PageIntro, ReviewBadge, SectionCard, SeverityBadge, axisTick } from "@/components/common";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";
import { useAppStore } from "@/store/AppStore";
import { anomalyService } from "@/services/anomalyService";
import { formatDate, formatINR } from "@/lib/format";
import { monthlySeries } from "@/lib/analytics";
import type { AnomalyReviewStatus } from "@/types";

export function AnomaliesPage() {
  const { state, actions } = useAppStore();
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [openTx, setOpenTx] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const flagged = useMemo(() => state.transactions.filter((t) => t.anomaly?.flagged), [state.transactions]);
  const list = flagged.filter((t) => (severity === "all" || t.anomaly!.severity === severity) && (status === "all" || t.anomaly!.reviewStatus === status));
  const high = flagged.filter((t) => t.anomaly!.severity === "high" && t.anomaly!.reviewStatus === "new");
  const trend = useMemo(() => {
    const months = monthlySeries([], 6);
    return months.map((m) => ({ label: m.label, count: flagged.filter((t) => t.date.startsWith(m.key)).length }));
  }, [flagged]);

  const run = async () => {
    setRunning(true);
    try {
      const r = await anomalyService.runDetection(state.transactions);
      setLastRun(r.ranAt);
      toast.success("Analysis complete", { description: `${r.analyzed} transactions analyzed · ${r.flagged} flagged (demo results)` });
    } finally {
      setRunning(false);
    }
  };
  const quick = async (id: string, s: AnomalyReviewStatus) => {
    await anomalyService.updateReview(id, s);
    actions.reviewAnomaly(id, s);
    toast.success(s === "reviewed" ? "Marked as reviewed" : "Alert dismissed");
  };

  return (
    <div className="space-y-6">
      <PageIntro
        title="Unusual transactions"
        description="Transactions that look different from your usual patterns. Unusual does not mean fraud — review them to confirm."
        badge={<DemoBadge label="Demo detections" tip="Flags and explanations are demo examples. They will be replaced by Isolation Forest output from the backend." />}
        actions={<Button variant="ai" onClick={run} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <ScanSearch />} Run analysis</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Transactions analyzed" value={state.transactions.length} icon={Radar} hint={lastRun ? `Last run ${lastRun.replace("T", " ")}` : "Demo dataset"} />
        <KpiCard label="Flagged" value={flagged.length} icon={AlertOctagon} tone="ai" hint={`${((flagged.length / Math.max(1, state.transactions.length)) * 100).toFixed(1)}% of all`} />
        <KpiCard label="High-priority alerts" value={high.length} icon={AlertOctagon} tone={high.length ? "destructive" : "success"} hint="High severity, not yet reviewed" />
        <KpiCard label="Reviewed / dismissed" value={flagged.filter((t) => t.anomaly!.reviewStatus !== "new").length} icon={ShieldCheck} tone="success" hint={`${flagged.filter((t) => t.anomaly!.reviewStatus === "new").length} awaiting review`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Recent anomaly trend" description="Flagged transactions per month">
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }} />
                <Area type="monotone" dataKey="count" name="Flagged" stroke="var(--ai)" fill="var(--ai-soft)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Scores are raw model outputs (lower = more unusual), not probabilities.</p>
        </SectionCard>

        <SectionCard
          className="xl:col-span-2"
          title="Flagged transactions"
          bodyClassName="p-0 pt-3"
          action={
            <>
              <Select value={severity} onValueChange={setSeverity}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All severity</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>
              <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="new">New</SelectItem><SelectItem value="reviewed">Reviewed</SelectItem><SelectItem value="dismissed">Dismissed</SelectItem></SelectContent></Select>
            </>
          }
        >
          {list.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nothing to review" description="No flagged transactions match these filters." />
          ) : (
            <ul className="divide-y border-t">
              {list.map((t) => (
                <li key={t.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{t.merchant}</p>
                      <SeverityBadge severity={t.anomaly!.severity} />
                      <ReviewBadge status={t.anomaly!.reviewStatus} />
                      <CategoryBadge category={t.category} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground num">{formatDate(t.date, "d MMM yyyy, h:mm a")} · {t.paymentMethod}{t.anomaly!.score != null && ` · score ${t.anomaly!.score.toFixed(3)}`}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground">{t.anomaly!.reasons[0]}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-display mr-2 text-lg font-semibold num">{formatINR(t.amount)}</span>
                    <Button size="icon" variant="ghost" aria-label="Open details" onClick={() => setOpenTx(t.id)}><Eye /></Button>
                    {t.anomaly!.reviewStatus === "new" && (
                      <>
                        <Button size="icon" variant="ghost" aria-label="Mark reviewed" onClick={() => quick(t.id, "reviewed")}><Check className="text-success" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Dismiss" onClick={() => quick(t.id, "dismissed")}><X /></Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
      <TransactionDetailSheet txId={openTx} onOpenChange={(o) => !o && setOpenTx(null)} />
    </div>
  );
}
