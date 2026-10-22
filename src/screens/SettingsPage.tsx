import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageIntro, SectionCard } from "@/components/common";
import { useAppStore } from "@/store/AppStore";
import { downloadText, transactionsToCsv } from "@/lib/csv";
import type { AppSettings } from "@/types";
import { preferencesService } from "@/services/preferencesService";
import { useAuth } from "@/auth/AuthContext";

const profileSchema = z.object({
  name: z.string().trim().max(60),
  email: z.union([z.literal(""), z.string().email("Enter a valid email")]),
  city: z.string().max(40).optional(),
  age: z.union([z.coerce.number().int().min(18).max(120), z.literal("")]).optional(),
  occupation: z.string().max(60).optional(),
  savingsGoal: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  financialGoal: z.string().max(120).optional(),
  creditScore: z.union([z.coerce.number().int().min(0).max(1000), z.literal("")]).optional(),
  totalDebt: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
});

export function SettingsPage() {
  const { state, actions } = useAppStore();
  const { refresh } = useAuth();
  const settings = state.settings;
  const setSettings = async (patch: Partial<AppSettings>) => {
    try {
      const result = await preferencesService.save({
        profile: state.profile,
        settings: { ...settings, ...patch },
      });
      actions.setSettings(result.settings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save preferences");
    }
  };
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      name: state.profile.name,
      email: state.profile.email,
      city: state.profile.city ?? "",
      age: state.profile.age ?? "",
      occupation: state.profile.occupation ?? "",
      savingsGoal: state.profile.savingsGoal ?? "",
      financialGoal: state.profile.financialGoal ?? "",
      creditScore: state.profile.creditScore ?? "",
      totalDebt: state.profile.totalDebt ?? "",
    },
  });

  return (
    <div className="space-y-6">
      <PageIntro title="Settings" description="Manage your profile and preferences." />
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Profile">
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (v) => {
              try {
                const profile = {
                  ...state.profile,
                  ...v,
                  age: v.age === "" ? undefined : v.age,
                  savingsGoal: v.savingsGoal === "" ? undefined : v.savingsGoal,
                  creditScore: v.creditScore === "" ? undefined : v.creditScore,
                  totalDebt: v.totalDebt === "" ? undefined : v.totalDebt,
                };
                const result = await preferencesService.save({
                  profile,
                  settings: state.settings,
                });
                actions.setProfile(result.profile);
                await refresh();
                toast.success("Profile saved");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not save profile");
              }
            })}
          >
            {(
              [
                "name",
                "email",
                "city",
                "age",
                "occupation",
                "savingsGoal",
                "financialGoal",
                "creditScore",
                "totalDebt",
              ] as const
            ).map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key} className="capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </Label>
                <Input
                  id={key}
                  type={
                    ["age", "savingsGoal", "creditScore", "totalDebt"].includes(key)
                      ? "number"
                      : "text"
                  }
                  {...form.register(key)}
                />
                {form.formState.errors[key] && (
                  <p className="text-xs text-destructive">{form.formState.errors[key]?.message}</p>
                )}
              </div>
            ))}
            <Button type="submit" disabled={!form.formState.isDirty}>
              Save profile
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Preferences">
          <div className="flex items-center justify-between gap-4 border-b py-3">
            <div>
              <p className="text-sm font-medium">Dark theme</p>
              <p className="text-xs text-muted-foreground">Use a dark color theme</p>
            </div>
            <Switch
              checked={settings.theme === "dark"}
              onCheckedChange={(dark) => void setSettings({ theme: dark ? "dark" : "light" })}
            />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">Save preferences in this browser</p>
              <p className="text-xs text-muted-foreground">
                Keep display and period preferences on this device
              </p>
            </div>
            <Switch
              checked={settings.privacy.persistLocally}
              onCheckedChange={(persistLocally) =>
                void setSettings({ privacy: { ...settings.privacy, persistLocally } })
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Financial data is displayed in INR. Bank connections and account sync are not available
            yet.
          </p>
        </SectionCard>

        <SectionCard
          title="Local data"
          description={`${state.transactions.length} account transaction records`}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                downloadText("moneymind-transactions.csv", transactionsToCsv(state.transactions));
                toast.success("Export started");
              }}
            >
              <Download /> Export transactions
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 /> Clear local data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear local data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This clears the browser's cached preferences. Transactions, goals, budgets, and
                    profile details saved to your account remain available after reload.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      actions.clearData();
                      toast.success("Browser state cleared");
                      window.location.reload();
                    }}
                  >
                    Clear data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SectionCard>

        <SectionCard
          title="Backend integration"
          description="External bank connections are not configured. Transaction, budget, goal, profile, and preference data sync through your account."
        >
          <p className="text-sm text-muted-foreground">No external data sources are connected.</p>
        </SectionCard>
      </div>
    </div>
  );
}
