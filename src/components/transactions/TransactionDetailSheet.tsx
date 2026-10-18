import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrainCircuit, Check, Loader2, ShieldAlert, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/AppStore";
import { ALL_CATEGORIES } from "@/lib/categories";
import { formatDate, formatINR } from "@/lib/format";
import { monthlySeries } from "@/lib/analytics";
import { transactionService } from "@/services/transactionService";
import { anomalyService } from "@/services/anomalyService";
import { Amount, CategoryBadge, ConfidenceMeter, DemoBadge, MoneyTooltip, ReviewBadge, SeverityBadge, axisTick, inrAxis } from "@/components/common";
import type { AnomalyReviewStatus, Category } from "@/types";

const schema = z.object({
  merchant: z.string().trim().min(2, "Merchant is required").max(60),
  description: z.string().trim().min(2, "Description is required").max(120),
  category: z.string(),
  notes: z.string().max(240).optional(),
});
type FormValues = z.infer<typeof schema>;

export function TransactionDetailSheet({ txId, onOpenChange }: { txId: string | null; onOpenChange: (open: boolean) => void }) {
  const { state, actions } = useAppStore();
  const tx = state.transactions.find((t) => t.id === txId) ?? null;
  const [reviewing, setReviewing] = useState<AnomalyReviewStatus | null>(null);
  const [note, setNote] = useState("");

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { merchant: "", description: "", category: "Other", notes: "" } });
  useEffect(() => {
    if (tx) form.reset({ merchant: tx.merchant, description: tx.description, category: tx.category, notes: tx.notes ?? "" });
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx?.id]);

  const history = useMemo(() => {
    if (!tx) return null;
    const merchantTx = state.transactions.filter((t) => t.merchant === tx.merchant && t.id !== tx.id);
    const catTx = state.transactions.filter((t) => t.category === tx.category && t.id !== tx.id);
    const avg = (arr: typeof merchantTx) => (arr.length ? arr.reduce((s, t) => s + t.amount, 0) / arr.length : null);
    return {
      merchantMonthly: monthlySeries(merchantTx, 6).map((m) => ({ label: m.label, amount: tx.type === "income" ? m.income : m.expenses })),
      categoryMonthly: monthlySeries(catTx, 6).map((m) => ({ label: m.label, amount: tx.type === "income" ? m.income : m.expenses })),
      merchantAvg: avg(merchantTx),
      merchantCount: merchantTx.length,
    };
  }, [tx, state.transactions]);

  const onSubmit = async (v: FormValues) => {
    if (!tx) return;
    const patch = {
      merchant: v.merchant,
      description: v.description,
      category: v.category as Category,
      notes: v.notes,
      prediction: { ...tx.prediction, userOverridden: v.category !== tx.prediction.predictedCategory, needsReview: false },
    };
    try {
      await transactionService.update(tx.id, patch);
      actions.updateTransaction(tx.id, patch);
      toast.success("Transaction updated", { description: v.category !== tx.category ? `Category changed to ${v.category}` : undefined });
      form.reset(v);
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
    }
  };

  const review = async (status: AnomalyReviewStatus) => {
    if (!tx) return;
    setReviewing(status);
    try {
      await anomalyService.updateReview(tx.id, status, note || undefined);
      actions.reviewAnomaly(tx.id, status, note || undefined);
      toast.success(status === "reviewed" ? "Marked as reviewed" : status === "dismissed" ? "Alert dismissed" : "Reopened");
      setNote("");
    } finally {
      setReviewing(null);
    }
  };

  return (
    <Sheet open={!!tx} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {tx && history && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-2">
                <CategoryBadge category={tx.category} />
                {tx.anomaly?.flagged && <SeverityBadge severity={tx.anomaly.severity} />}
              </div>
              <SheetTitle className="font-display text-xl">{tx.merchant}</SheetTitle>
              <SheetDescription>{tx.description}</SheetDescription>
              <div className="pt-1">
                <Amount value={tx.amount} type={tx.type} className="font-display text-3xl" />
              </div>
            </SheetHeader>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Date & time", formatDate(tx.date, "d MMM yyyy, h:mm a")],
                ["Payment method", tx.paymentMethod],
                ["Type", tx.type === "income" ? "Income" : "Expense"],
                ["Status", tx.status],
                ["Source", tx.source === "import" ? "Imported statement" : tx.source === "manual" ? "Manual" : "Demo data"],
                ["Recurring", tx.recurring ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">{k}</dt>
                  <dd className="font-medium capitalize text-foreground">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 rounded-xl border bg-ai-soft/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <BrainCircuit className="size-4 text-ai" /> AI categorization
                </p>
                <DemoBadge />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  Predicted: <span className="font-semibold text-foreground">{tx.prediction.predictedCategory}</span>
                </span>
                <ConfidenceMeter value={tx.prediction.confidence} threshold={state.settings.financial.lowConfidenceThreshold} />
              </div>
              {tx.prediction.userOverridden && <p className="mt-2 text-xs text-muted-foreground">You changed the category manually — this correction can be used as model feedback.</p>}
              {tx.prediction.needsReview && !tx.prediction.userOverridden && <p className="mt-2 text-xs font-medium text-warning-foreground">Low confidence — please confirm the category below.</p>}
            </div>

            {tx.anomaly?.flagged && (
              <div className="mt-5 rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><ShieldAlert className="size-4 text-destructive" /> Why this was flagged</p>
                  <ReviewBadge status={tx.anomaly.reviewStatus} />
                </div>
                <ul className="space-y-1.5 text-sm text-foreground">
                  {tx.anomaly.reasons.map((r) => (
                    <li key={r} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />{r}</li>
                  ))}
                </ul>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {tx.anomaly.score != null && (
                    <div className="rounded-lg bg-muted/60 px-3 py-2">
                      <p className="text-muted-foreground">Model score</p>
                      <p className="font-semibold num">{tx.anomaly.score.toFixed(3)} <span className="font-normal text-muted-foreground">(threshold {tx.anomaly.threshold?.toFixed(2) ?? "—"})</span></p>
                    </div>
                  )}
                  {tx.anomaly.typicalAmount != null && tx.anomaly.typicalAmount > 0 && (
                    <div className="rounded-lg bg-muted/60 px-3 py-2">
                      <p className="text-muted-foreground">vs typical at merchant</p>
                      <p className="font-semibold num">{formatINR(tx.anomaly.typicalAmount)} → {(tx.amount / tx.anomaly.typicalAmount).toFixed(1)}×</p>
                    </div>
                  )}
                </div>
                {tx.anomaly.featureContributions && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tx.anomaly.featureContributions.map((f) => (
                      <span key={f.feature} className="rounded-md border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{f.feature}: <span className="text-foreground">{f.value}</span></span>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground">An unusual transaction is not necessarily fraud. Lower scores are more unusual; scores are not probabilities.</p>
                <Textarea className="mt-3" rows={2} placeholder="Add a review note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="success" disabled={!!reviewing} onClick={() => review("reviewed")}>{reviewing === "reviewed" ? <Loader2 className="animate-spin" /> : <Check />} Mark reviewed</Button>
                  <Button size="sm" variant="outline" disabled={!!reviewing} onClick={() => review("dismissed")}>{reviewing === "dismissed" ? <Loader2 className="animate-spin" /> : <X />} Dismiss</Button>
                  {tx.anomaly.reviewStatus !== "new" && <Button size="sm" variant="ghost" disabled={!!reviewing} onClick={() => review("new")}>Reopen</Button>}
                </div>
                <Separator className="my-4" />
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Review history</p>
                <ol className="space-y-2 border-l pl-4">
                  {tx.anomaly.reviewHistory.map((h, i) => (
                    <li key={i} className="relative text-xs">
                      <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-ai" />
                      <span className="font-semibold capitalize text-foreground">{h.action}</span> <span className="text-muted-foreground">· {formatDate(h.at, "d MMM, h:mm a")}</span>
                      {h.note && <p className="text-muted-foreground">{h.note}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { title: `At ${tx.merchant}`, data: history.merchantMonthly, sub: history.merchantAvg ? `Avg ${formatINR(history.merchantAvg)} · ${history.merchantCount} txns` : "No other transactions" },
                { title: `${tx.category} overall`, data: history.categoryMonthly, sub: "Last 6 months" },
              ].map((c) => (
                <div key={c.title} className="rounded-xl border p-3">
                  <p className="truncate text-xs font-semibold">{c.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{c.sub}</p>
                  <div className="mt-2 h-24">
                    <ResponsiveContainer>
                      <BarChart data={c.data}>
                        <XAxis dataKey="label" tick={{ ...axisTick, fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis hide tickFormatter={inrAxis} />
                        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
                        <Bar dataKey="amount" name="Spent" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-3 rounded-xl border p-4">
              <p className="text-sm font-semibold">Edit transaction</p>
              <div className="space-y-1.5">
                <Label htmlFor="merchant">Merchant</Label>
                <Input id="merchant" {...form.register("merchant")} />
                {form.formState.errors.merchant && <p className="text-xs text-destructive">{form.formState.errors.merchant.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Input id="description" {...form.register("description")} />
                {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={2} {...form.register("notes")} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Save changes
                </Button>
              </div>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
