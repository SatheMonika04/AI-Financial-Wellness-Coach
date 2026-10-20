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

const profileSchema = z.object({
  name: z.string().trim().max(60),
  email: z.union([z.literal(""), z.string().email("Enter a valid email")]),
  city: z.string().max(40).optional(),
});

export function SettingsPage() {
  const { state, actions } = useAppStore();
  const settings = state.settings;
  const setSettings = (patch: Partial<AppSettings>) =>
    actions.setSettings({ ...settings, ...patch });
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      name: state.profile.name,
      email: state.profile.email,
      city: state.profile.city ?? "",
    },
  });

  return (
    <div className="space-y-6">
      <PageIntro title="Settings" description="Manage your profile and preferences." />
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Profile">
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((v) => {
              actions.setProfile({ ...state.profile, ...v });
              toast.success("Profile saved");
            })}
          >
            {(["name", "email", "city"] as const).map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key} className="capitalize">
                  {key}
                </Label>
                <Input id={key} {...form.register(key)} />
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
              onCheckedChange={(dark) => setSettings({ theme: dark ? "dark" : "light" })}
            />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">Save data in this browser</p>
              <p className="text-xs text-muted-foreground">
                Keep imported records and preferences on this device
              </p>
            </div>
            <Switch
              checked={settings.privacy.persistLocally}
              onCheckedChange={(persistLocally) =>
                setSettings({ privacy: { ...settings.privacy, persistLocally } })
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
          description={`${state.transactions.length} transaction records`}
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
                    Transactions, goals, budgets and profile details saved in this browser will be
                    removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      actions.clearData();
                      toast.success("Local data cleared");
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
          description="Bank connections, model results and account sync will be added in a future integration task."
        >
          <p className="text-sm text-muted-foreground">No external data sources are connected.</p>
        </SectionCard>
      </div>
    </div>
  );
}
