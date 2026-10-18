import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { differenceInCalendarMonths, format, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, GraduationCap, Laptop, MoreVertical, Pencil, PiggyBank, Plane, Plus, ShieldCheck, Target, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, KpiCard, PageIntro, ProgressBar } from "@/components/common";
import { useAppStore } from "@/store/AppStore";
import { goalService } from "@/services/goalService";
import { formatINR, formatPct } from "@/lib/format";
import { TODAY } from "@/lib/period";
import type { FinancialGoal, GoalType } from "@/types";

const TYPES: { v: GoalType; l: string; icon: typeof Target }[] = [
  { v: "emergency", l: "Emergency fund", icon: ShieldCheck },
  { v: "gadget", l: "Gadget / purchase", icon: Laptop },
  { v: "education", l: "Education", icon: GraduationCap },
  { v: "travel", l: "Travel", icon: Plane },
  { v: "savings", l: "General savings", icon: PiggyBank },
  { v: "other", l: "Other", icon: Target },
];

const schema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(50),
    type: z.enum(["emergency", "gadget", "education", "travel", "savings", "other"]),
    targetAmount: z.coerce.number().min(1000, "Minimum ₹1,000"),
    currentAmount: z.coerce.number().min(0, "Cannot be negative"),
    targetDate: z.string().refine((v) => !!v && parseISO(v) > TODAY, "Choose a future date"),
  })
  .refine((v) => v.currentAmount <= v.targetAmount, { path: ["currentAmount"], message: "Cannot exceed target" });
type Form = z.infer<typeof schema>;

export const monthlyNeeded = (g: FinancialGoal) => {
  const months = Math.max(1, differenceInCalendarMonths(parseISO(g.targetDate), TODAY));
  return Math.max(0, (g.targetAmount - g.currentAmount) / months);
};

export function GoalsPage() {
  const { state, actions } = useAppStore();
  const [editing, setEditing] = useState<FinancialGoal | null | "new">(null);
  const [deleting, setDeleting] = useState<FinancialGoal | null>(null);
  const active = state.goals.filter((g) => !g.completed);
  const saved = state.goals.reduce((s, g) => s + g.currentAmount, 0);
  const target = active.reduce((s, g) => s + g.targetAmount, 0);
  const monthly = active.reduce((s, g) => s + monthlyNeeded(g), 0);

  const toggleComplete = async (g: FinancialGoal) => {
    const next = { ...g, completed: !g.completed, currentAmount: !g.completed ? g.targetAmount : g.currentAmount };
    await goalService.update(next);
    actions.upsertGoal(next);
    toast.success(next.completed ? `🎉 "${g.name}" completed` : `"${g.name}" reopened`);
  };

  return (
    <div className="space-y-6">
      <PageIntro title="Financial goals" description="Track what you're saving for and how much to set aside each month." actions={<Button onClick={() => setEditing("new")}><Plus /> Add goal</Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Active goals" value={active.length} icon={Target} tone="ai" hint={`${state.goals.length - active.length} completed`} />
        <KpiCard label="Total saved" value={formatINR(saved)} icon={PiggyBank} tone="success" />
        <KpiCard label="Remaining to target" value={formatINR(Math.max(0, target - active.reduce((s, g) => s + g.currentAmount, 0)))} icon={Target} />
        <KpiCard label="Suggested monthly" value={formatINR(monthly)} icon={CalendarDays} tone="ai" hint={`${formatPct(monthly / (state.profile.monthlyIncome || 1))} of income`} />
      </div>

      {state.goals.length === 0 ? (
        <div className="surface-card"><EmptyState icon={Target} title="No goals yet" description="Create your first goal — an emergency fund is a great start." action={<Button onClick={() => setEditing("new")}><Plus /> Add goal</Button>} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.goals.map((g) => {
            const meta = TYPES.find((t) => t.v === g.type) ?? TYPES[5];
            const pct = g.currentAmount / g.targetAmount;
            const months = differenceInCalendarMonths(parseISO(g.targetDate), TODAY);
            return (
              <div key={g.id} className="surface-card animate-rise flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${g.completed ? "bg-success-soft text-success" : "bg-ai-soft text-ai"}`}><meta.icon className="size-5" /></span>
                    <div className="min-w-0"><p className="font-display truncate font-semibold">{g.name}</p><p className="text-xs text-muted-foreground">{meta.l}</p></div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Goal actions"><MoreVertical /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(g)}><Pencil /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleComplete(g)}>{g.completed ? <><RotateCcw /> Reopen</> : <><CheckCircle2 /> Mark completed</>}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(g)}><Trash2 /> Remove</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <p className="font-display text-2xl font-semibold num">{formatINR(g.currentAmount)}</p>
                  <p className="text-xs text-muted-foreground num">of {formatINR(g.targetAmount)}</p>
                </div>
                <ProgressBar value={pct} status={g.completed ? "success" : "ok"} className="mt-2" />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatPct(pct)}</span>
                  <span>{formatINR(Math.max(0, g.targetAmount - g.currentAmount))} remaining</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="size-3.5" /> {format(parseISO(g.targetDate), "d MMM yyyy")}</span>
                  {g.completed ? <Badge variant="success"><CheckCircle2 /> Completed</Badge> : months < 0 ? <Badge variant="destructive">Past deadline</Badge> : <span className="font-semibold">{formatINR(monthlyNeeded(g))}/mo · {months} mo left</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GoalDialog goal={editing} onClose={() => setEditing(null)} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove "{deleting?.name}"?</AlertDialogTitle><AlertDialogDescription>This goal and its progress will be removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (!deleting) return; await goalService.remove(deleting.id); actions.removeGoal(deleting.id); toast.success("Goal removed"); setDeleting(null); }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GoalDialog({ goal, onClose }: { goal: FinancialGoal | null | "new"; onClose: () => void }) {
  const { actions } = useAppStore();
  const g = goal && goal !== "new" ? goal : null;
  const form = useForm<Form>({
    resolver: zodResolver(schema) as never,
    values: g ? { name: g.name, type: g.type, targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: g.targetDate } : { name: "", type: "savings", targetAmount: 50000, currentAmount: 0, targetDate: "2027-06-30" },
  });
  const e = form.formState.errors;
  const submit = async (v: Form) => {
    const next: FinancialGoal = g ? { ...g, ...v, completed: v.currentAmount >= v.targetAmount } : { id: `goal_${Date.now().toString(36)}`, ...v, completed: v.currentAmount >= v.targetAmount, createdAt: format(TODAY, "yyyy-MM-dd") };
    await (g ? goalService.update(next) : goalService.create(next));
    actions.upsertGoal(next);
    toast.success(g ? "Goal updated" : "Goal created");
    onClose();
  };
  return (
    <Dialog open={!!goal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{g ? "Edit goal" : "New financial goal"}</DialogTitle><DialogDescription>Set a target and deadline — we'll suggest a monthly contribution.</DialogDescription></DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label>Goal name</Label><Input {...form.register("name")} placeholder="e.g. New laptop" />{e.name && <p className="text-xs text-destructive">{e.name.message}</p>}</div>
          <div className="col-span-2 space-y-1">
            <Label>Type</Label>
            <Controller control={form.control} name="type" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent></Select>
            )} />
          </div>
          <div className="space-y-1"><Label>Target amount (₹)</Label><Input type="number" {...form.register("targetAmount")} />{e.targetAmount && <p className="text-xs text-destructive">{e.targetAmount.message}</p>}</div>
          <div className="space-y-1"><Label>Current savings (₹)</Label><Input type="number" {...form.register("currentAmount")} />{e.currentAmount && <p className="text-xs text-destructive">{e.currentAmount.message}</p>}</div>
          <div className="col-span-2 space-y-1"><Label>Target date</Label><Input type="date" {...form.register("targetDate")} />{e.targetDate && <p className="text-xs text-destructive">{e.targetDate.message}</p>}</div>
          <DialogFooter className="col-span-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={form.formState.isSubmitting}>{g ? "Save changes" : "Create goal"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
