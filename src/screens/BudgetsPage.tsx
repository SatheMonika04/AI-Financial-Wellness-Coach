import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, ChevronDown, Loader2, Pencil, RefreshCw, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CategoryBadge, EmptyState, KpiCard, MoneyTooltip, PageIntro, ProgressBar, SectionCard, axisTick, inrAxis } from "@/components/common";
import { useAppStore } from "@/store/AppStore";
import { useBudgetRows, useModelFeatures } from "@/hooks/useFinanceData";
import { useBudgetRecommendations } from "@/hooks/useModels";
import { formatINR, formatPct } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { inRange, totals } from "@/lib/analytics";
import { TODAY } from "@/lib/period";
import { startOfMonth } from "date-fns";
import type { BudgetRecommendation, ExpenseCategory } from "@/types";
import { AlertTriangle, PiggyBank, ReceiptText } from "lucide-react";

const optNum = z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional());
const profileSchema = z.object({
  monthlyIncome: z.coerce.number().min(1000, "Enter a valid monthly income"),
  age: z.preprocess((v) => (v === "" ? undefined : Number(v)), z.number().int().min(16).max(100).optional()),
  occupation: z.string().max(60).optional(),
  savingsGoal: optNum,
  financialGoal: z.string().max(80).optional(),
  creditScore: z.preprocess((v) => (v === "" ? undefined : Number(v)), z.number().int().min(300, "300–900").max(900, "300–900").optional()),
  totalDebt: optNum,
  focusCategory: z.string().optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

export function BudgetsPage() {
  const { state, actions } = useAppStore();
  const rows = useBudgetRows("month");
  const features = useModelFeatures();
  const { data, isLoading, isFetching, refetch, isError } = useBudgetRecommendations();
  const mtd = totals(inRange(state.transactions, startOfMonth(TODAY), TODAY));
  const totalBudget = EXPENSE_CATEGORIES.reduce((s, c) => s + state.budgets[c], 0);
  const atRisk = rows.filter((r) => r.status !== "ok");

  const chart = rows.map((r) => ({ label: r.category, Spent: r.spent, Budget: r.budget, Recommended: data?.recommendations.find((x) => x.category === r.category)?.recommended ?? 0 }));

  if (!state.hydrated) return <div className="space-y-6"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>;
  if (!data) return (
    <div className="space-y-6">
      <PageIntro title="Budgets" description="Your budget summary will appear here when budget data is available." />
      <ProfileCard />
      <SectionCard><EmptyState icon={Wallet} title="No budget data available" description="Your budget summary will appear here when budget data is available." /></SectionCard>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageIntro title="Smart budgets" description="Budget recommendations will appear once the required financial data and model are available." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Monthly income" value={formatINR(state.profile.monthlyIncome)} icon={Wallet} tone="success" hint="From your profile" />
        <KpiCard label="Expenses this month" value={formatINR(mtd.expenses)} icon={ReceiptText} hint={`${formatPct(mtd.expenses / (totalBudget || 1))} of budget`} />
        <KpiCard label="Remaining budget" value={formatINR(totalBudget - mtd.expenses)} icon={PiggyBank} tone={totalBudget - mtd.expenses < 0 ? "destructive" : "ai"} hint={`of ${formatINR(totalBudget)}`} />
        <KpiCard label="Approaching / over" value={atRisk.length} icon={AlertTriangle} tone={atRisk.length ? "warning" : "success"} hint={atRisk.map((r) => r.category).slice(0, 3).join(", ") || "All on track"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ProfileCard />
        <SectionCard className="xl:col-span-2" title="Budget vs. actual vs. recommended" description="This month">
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={56} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={inrAxis} width={56} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Spent" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Budget" fill="var(--chart-10)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Recommended" fill="var(--ai)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Recommended category budgets"
        description={data ? `Generated ${data.generatedAt.replace("T", " ")} · based on 3-month averages` : "Loading…"}
        action={<Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Regenerate</Button>}
      >
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">Could not load recommendations. <button className="underline" onClick={() => refetch()}>Try again</button></p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.recommendations.map((r) => (
              <RecommendationCard key={r.category} rec={r} spentThisMonth={r.category === "Savings" ? Math.max(0, mtd.savings) : rows.find((x) => x.category === r.category)?.spent ?? 0} />
            ))}
          </div>
        )}
      </SectionCard>

      <Collapsible>
        <SectionCard title="Model input preview" description="Features prepared for the budget recommendation model" action={<CollapsibleTrigger asChild><Button size="sm" variant="ghost">Show <ChevronDown /></Button></CollapsibleTrigger>}>
          <CollapsibleContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/60 p-3 text-sm"><p className="text-xs text-muted-foreground">Expense-to-income</p><p className="font-semibold num">{features.expenseToIncome.toFixed(3)}</p></div>
              <div className="rounded-lg bg-muted/60 p-3 text-sm"><p className="text-xs text-muted-foreground">Debt-to-income (annual)</p><p className="font-semibold num">{features.debtToIncome?.toFixed(3) ?? "Not provided"}</p></div>
              <div className="rounded-lg bg-muted/60 p-3 text-sm"><p className="text-xs text-muted-foreground">Monthly income</p><p className="font-semibold num">{formatINR(features.monthlyIncome)}</p></div>
            </div>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted/60 p-3 text-[11px] text-muted-foreground">{JSON.stringify(features, null, 2)}</pre>
          </CollapsibleContent>
        </SectionCard>
      </Collapsible>
    </div>
  );

  function RecommendationCard({ rec, spentThisMonth }: { rec: BudgetRecommendation; spentThisMonth: number }) {
    const decision = state.decisions[rec.category] ?? "pending";
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(rec.recommended));
    useEffect(() => setValue(String(rec.recommended)), [rec.recommended]);
    const current = state.budgets[rec.category];
    const diff = rec.recommended - current;
    const pct = current ? spentThisMonth / current : 0;
    const isSavings = rec.category === "Savings";

    const accept = (amount: number) => {
      actions.setBudget(rec.category, amount);
      actions.setDecision(rec.category, "accepted");
      setEditing(false);
      toast.success(`${rec.category} budget set to ${formatINR(amount)}`);
    };

    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <CategoryBadge category={rec.category} />
          <Badge variant={decision === "accepted" ? "success" : decision === "rejected" ? "muted" : "ai"} className="capitalize">{decision}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-muted-foreground">{isSavings ? "Avg saved" : "3-mo avg"}</p><p className="text-sm font-semibold num">{formatINR(rec.actual)}</p></div>
          <div><p className="text-muted-foreground">Current</p><p className="text-sm font-semibold num">{formatINR(current)}</p></div>
          <div><p className="text-muted-foreground">AI suggests</p><p className="text-sm font-semibold text-ai num">{formatINR(rec.recommended)}</p></div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{isSavings ? "Saved" : "Spent"} this month: <span className="font-semibold text-foreground num">{formatINR(spentThisMonth)}</span></span>
            <span className={diff === 0 ? "" : diff < 0 ? "text-success" : "text-warning-foreground"}>{diff === 0 ? "No change" : `${formatINR(diff, { sign: true })} vs current`}</span>
          </div>
          <ProgressBar value={pct} status={isSavings ? "success" : pct > 1 ? "over" : pct > 0.85 ? "warning" : "ok"} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{rec.explanation}</p>
        {editing ? (
          <div className="mt-3 flex gap-2">
            <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="h-8" />
            <Button size="sm" onClick={() => { const n = Number(value); if (!Number.isFinite(n) || n < 0) return toast.error("Enter a valid amount"); accept(Math.round(n)); }}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="success" onClick={() => accept(rec.recommended)} disabled={decision === "accepted" && current === rec.recommended}><Check /> Accept</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil /> Adjust</Button>
            <Button size="sm" variant="ghost" onClick={() => { actions.setDecision(rec.category, "rejected"); toast("Recommendation rejected", { description: `${rec.category} budget stays at ${formatINR(current)}` }); }}><X /> Reject</Button>
          </div>
        )}
      </div>
    );
  }
}

function ProfileCard() {
  const { state, actions } = useAppStore();
  const p = state.profile;
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema) as never,
    values: { monthlyIncome: p.monthlyIncome, age: p.age, occupation: p.occupation, savingsGoal: p.savingsGoal, financialGoal: p.financialGoal, creditScore: p.creditScore, totalDebt: p.totalDebt, focusCategory: p.focusCategory },
  });
  const e = form.formState.errors;
  const submit = (v: ProfileForm) => {
    actions.setProfile({ ...p, ...v, focusCategory: v.focusCategory as ExpenseCategory | undefined });
    toast.success("Financial profile updated", { description: "Recommendations are being regenerated." });
  };
  const field = (name: keyof ProfileForm, label: string, type = "number") => (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs">{label}</Label>
      <Input id={name} type={type} className="h-9" {...form.register(name)} />
      {e[name] && <p className="text-[11px] text-destructive">{String(e[name]?.message)}</p>}
    </div>
  );
  return (
    <SectionCard title="Financial profile" description="Inputs used by the recommendation model">
      <form onSubmit={form.handleSubmit(submit)} className="grid grid-cols-2 gap-3">
        {field("monthlyIncome", "Monthly income (₹)")}
        {field("age", "Age")}
        <div className="col-span-2">{field("occupation", "Occupation", "text")}</div>
        {field("savingsGoal", "Monthly savings goal (₹)")}
        {field("totalDebt", "Total debt (₹)")}
        {field("creditScore", "Credit score (optional)")}
        <div className="space-y-1">
          <Label className="text-xs">Focus category</Label>
          <Select value={form.watch("focusCategory") ?? ""} onValueChange={(v) => form.setValue("focusCategory", v, { shouldDirty: true })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2">{field("financialGoal", "Financial goal", "text")}</div>
        <Button type="submit" className="col-span-2" disabled={!form.formState.isDirty}>Update & regenerate</Button>
      </form>
    </SectionCard>
  );
}
