import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, CreditCard, Database, Download, Landmark, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageIntro, SectionCard } from "@/components/common";
import { useAppStore } from "@/store/AppStore";
import { API_CONFIG } from "@/services/apiClient";
import { downloadText, transactionsToCsv } from "@/lib/csv";
import type { AppSettings } from "@/types";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
  email: z.string().trim().email("Enter a valid email"),
  city: z.string().max(40).optional(),
});

export function SettingsPage() {
  const { state, actions } = useAppStore();
  const s = state.settings;
  const set = (patch: Partial<AppSettings>) => actions.setSettings({ ...s, ...patch });
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), values: { name: state.profile.name, email: state.profile.email, city: state.profile.city } });

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-0">
      <div className="min-w-0"><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageIntro title="Settings" description="Manage your profile, preferences and demo data." />
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="User profile">
          <form className="space-y-3" onSubmit={form.handleSubmit((v) => { actions.setProfile({ ...state.profile, ...v }); toast.success("Profile saved"); })}>
            {(["name", "email", "city"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={k} className="capitalize">{k}</Label>
                <Input id={k} {...form.register(k)} />
                {form.formState.errors[k] && <p className="text-xs text-destructive">{form.formState.errors[k]?.message}</p>}
              </div>
            ))}
            <Button type="submit" disabled={!form.formState.isDirty}>Save profile</Button>
          </form>
        </SectionCard>

        <SectionCard title="Financial preferences">
          <Row label="Currency" hint="All amounts are displayed in INR in this demo">
            <Select value={s.currency} onValueChange={(v) => { set({ currency: v as AppSettings["currency"] }); if (v !== "INR") toast.info("Display stays in ₹ until multi-currency is supported by the backend."); }}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="INR">₹ INR</SelectItem><SelectItem value="USD">$ USD</SelectItem><SelectItem value="EUR">€ EUR</SelectItem></SelectContent>
            </Select>
          </Row>
          <Row label="Low-confidence threshold" hint="Categories below this confidence are marked for review">
            <Select value={String(s.financial.lowConfidenceThreshold)} onValueChange={(v) => set({ financial: { ...s.financial, lowConfidenceThreshold: Number(v) } })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{[0.6, 0.7, 0.8].map((v) => <SelectItem key={v} value={String(v)}>{v * 100}%</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label="Theme" hint="Light is the default">
            <Select value={s.theme} onValueChange={(v) => set({ theme: v as AppSettings["theme"] })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent>
            </Select>
          </Row>
        </SectionCard>

        <SectionCard title="Notifications">
          {([
            ["anomalyAlerts", "Unusual transaction alerts", "Notify when a transaction is flagged"],
            ["budgetAlerts", "Budget alerts", "Notify when a category exceeds its budget"],
            ["weeklySummary", "Weekly summary", "A Sunday recap of your spending"],
            ["goalReminders", "Goal reminders", "Monthly contribution reminders"],
          ] as const).map(([k, l, h]) => (
            <Row key={k} label={l} hint={h}>
              <Switch checked={s.notifications[k]} onCheckedChange={(v) => set({ notifications: { ...s.notifications, [k]: v } })} />
            </Row>
          ))}
        </SectionCard>

        <SectionCard title="Privacy & data">
          <Row label="Save demo data in this browser" hint="Turn off to forget changes when you close the tab">
            <Switch checked={s.privacy.persistLocally} onCheckedChange={(v) => set({ privacy: { ...s.privacy, persistLocally: v } })} />
          </Row>
          <Row label="Share anonymized data to improve models" hint="Takes effect once the backend is connected">
            <Switch checked={s.privacy.shareAnonymized} onCheckedChange={(v) => set({ privacy: { ...s.privacy, shareAnonymized: v } })} />
          </Row>
          <Row label="Export all transactions" hint={`${state.transactions.length} records`}>
            <Button size="sm" variant="outline" onClick={() => { downloadText("moneymind-all-transactions.csv", transactionsToCsv(state.transactions)); toast.success("Export started"); }}><Download /> Export</Button>
          </Row>
        </SectionCard>

        <SectionCard title="Connected data sources" description={`Backend: ${API_CONFIG.useMocks ? "demo mode (mock services)" : API_CONFIG.baseUrl}`}>
          {[
            { n: "HDFC Bank – Savings", i: Landmark },
            { n: "ICICI Credit Card", i: CreditCard },
            { n: "Account Aggregator (Setu / Finvu)", i: Building2 },
            { n: "MoneyMind ML backend (FastAPI)", i: Database },
          ].map((d) => (
            <Row key={d.n} label={d.n}>
              <div className="flex items-center gap-2">
                <Badge variant="muted">Not connected</Badge>
                <Button size="sm" variant="outline" onClick={() => toast.info("Available after backend integration", { description: `${d.n} cannot be connected in demo mode.` })}><d.i /> Connect</Button>
              </div>
            </Row>
          ))}
        </SectionCard>

        <SectionCard title="Account actions">
          <Row label="Reset demo data" hint="Restore the original sample transactions, budgets and goals">
            <Button size="sm" variant="outline" onClick={() => { actions.resetDemo(); toast.success("Demo data restored"); }}><RotateCcw /> Reset</Button>
          </Row>
          <Row label="Clear all data" hint="Start empty — useful for testing empty states">
            <AlertDialog>
              <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 /> Clear</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Clear all data?</AlertDialogTitle><AlertDialogDescription>All transactions and goals will be removed from this browser. You can restore demo data at any time.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { actions.clearData(); toast.success("All data cleared"); }}>Clear data</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Row>
        </SectionCard>
      </div>
    </div>
  );
}
