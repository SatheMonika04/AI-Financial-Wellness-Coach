import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CategoryBadge,
  EmptyState,
  KpiCard,
  PageIntro,
  ProgressBar,
  SectionCard,
} from "@/components/common";
import { useAppStore } from "@/store/AppStore";
import { useBudgetRows } from "@/hooks/useFinanceData";
import { formatINR, formatPct } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { PiggyBank, ReceiptText } from "lucide-react";
import { budgetService } from "@/services/budgetService";
import { preferencesService } from "@/services/preferencesService";
import { useBudgetRecommendations } from "@/hooks/useModels";

export function BudgetsPage() {
  const { state, actions } = useAppStore();
  const saveBudget = async (category: (typeof EXPENSE_CATEGORIES)[number], amount: number) => {
    await budgetService.put(category, amount);
    actions.setBudget(category, amount);
  };
  const saveProfile = async (profile: typeof state.profile) => {
    const result = await preferencesService.save({ profile, settings: state.settings });
    actions.setProfile(result.profile);
  };
  const applyRecommendation = async (
    category: (typeof EXPENSE_CATEGORIES)[number],
    amount: number,
  ) => {
    try {
      await saveBudget(category, amount);
      await recommendationQuery.refetch();
      toast.success(`${category} limit updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply this recommendation");
    }
  };
  const rows = useBudgetRows("month");
  const recommendationQuery = useBudgetRecommendations();
  const totalBudget = EXPENSE_CATEGORIES.reduce(
    (sum, category) => sum + (state.budgets[category] ?? 0),
    0,
  );
  const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);
  const atRisk = rows.filter((row) => row.budget > 0 && row.status !== "ok");

  if (!state.hydrated) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="space-y-6">
      <PageIntro
        title="Budgets"
        description="Set monthly limits for each category and compare them with your imported transactions."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Monthly income"
          value={state.profile.monthlyIncome ? formatINR(state.profile.monthlyIncome) : "—"}
          icon={Wallet}
          hint={state.profile.monthlyIncome ? "From your profile" : "Not provided"}
        />
        <KpiCard label="Expenses this month" value={formatINR(totalSpent)} icon={ReceiptText} />
        <KpiCard
          label="Monthly budget"
          value={formatINR(totalBudget)}
          icon={PiggyBank}
          hint={
            totalBudget
              ? `${formatPct(totalSpent / totalBudget)} used`
              : "Set category limits below"
          }
        />
        <KpiCard
          label="Near or over limit"
          value={atRisk.length}
          icon={Wallet}
          hint={
            atRisk
              .map((row) => row.category)
              .slice(0, 2)
              .join(", ") || "No limits exceeded"
          }
        />
      </div>

      <SectionCard
        title="Monthly category limits"
        description="Monthly category limits are saved to your account. Model recommendations will be shown when their inference is available."
      >
        {state.transactions.length === 0 && (
          <EmptyState
            icon={ReceiptText}
            title="No transaction data yet"
            description="You can set limits now. Actual spending will appear after you import a CSV statement."
          />
        )}
        <div className="divide-y">
          {rows.map((row) => (
            <BudgetRow
              key={row.category}
              row={row}
              initial={state.budgets[row.category] ?? 0}
              save={(amount) => saveBudget(row.category, amount)}
            />
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="Model budget recommendations"
        description="Predictions use the saved budget model and your recent transactions and profile. Review before applying."
      >
        {!recommendationQuery.isReady ? (
          <p className="text-sm text-muted-foreground">
            Complete monthly income, age, occupation, savings goal, financial goal, credit score,
            and total debt in Settings to run this model.
          </p>
        ) : recommendationQuery.isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        ) : recommendationQuery.isError ? (
          <p className="text-sm text-destructive">
            {recommendationQuery.error?.message ?? "Recommendations could not be loaded."}
          </p>
        ) : !recommendationQuery.data?.recommendations.length ? (
          <p className="text-sm text-muted-foreground">No recommendation results are available.</p>
        ) : (
          <div className="divide-y">
            {recommendationQuery.data.recommendations.map((item) => (
              <div key={item.category} className="flex flex-wrap items-center gap-3 py-3">
                <CategoryBadge category={item.category} className="min-w-36" />
                <p className="min-w-48 flex-1 text-xs text-muted-foreground">{item.explanation}</p>
                <span className="text-right text-xs">
                  Suggested <b>{formatINR(item.recommended)}/mo</b>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void applyRecommendation(item.category, item.recommended)}
                >
                  Apply
                </Button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard
        title="Financial profile"
        description="Your monthly income is saved to your account and used in supported calculations."
      >
        <IncomeEditor
          initial={state.profile.monthlyIncome}
          save={(monthlyIncome) => saveProfile({ ...state.profile, monthlyIncome })}
        />
      </SectionCard>
    </div>
  );
}

function BudgetRow({
  row,
  initial,
  save,
}: {
  row: ReturnType<typeof useBudgetRows>[number];
  initial: number;
  save: (amount: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(initial || ""));
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <CategoryBadge category={row.category} className="min-w-36" />
      <div className="min-w-32 flex-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Spent {formatINR(row.spent)}</span>
          <span className="text-muted-foreground">
            Limit {row.budget ? formatINR(row.budget) : "Not set"}
          </span>
        </div>
        <ProgressBar className="mt-2" value={row.pct} status={row.status} />
      </div>
      {editing ? (
        <div className="flex gap-2">
          <Input
            aria-label={`${row.category} monthly limit`}
            type="number"
            min="0"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-9 w-32"
          />
          <Button
            size="sm"
            onClick={async () => {
              const amount = Number(value);
              if (!Number.isFinite(amount) || amount < 0)
                return toast.error("Enter a valid non-negative limit");
              try {
                await save(amount);
                setEditing(false);
                toast.success("Monthly limit saved");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not save this limit");
              }
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setValue(initial ? String(initial) : "");
            setEditing(true);
          }}
        >
          <Pencil />
          {initial ? "Edit limit" : "Set limit"}
        </Button>
      )}
    </div>
  );
}

function IncomeEditor({
  initial,
  save,
}: {
  initial: number;
  save: (amount: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(initial || ""));
  return (
    <form
      className="flex max-w-md items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < 0)
          return toast.error("Enter a valid non-negative amount");
        try {
          await save(amount);
          toast.success("Monthly income saved");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not save income");
        }
      }}
    >
      <label className="flex-1 space-y-1 text-xs text-muted-foreground">
        Monthly income
        <Input
          type="number"
          min="0"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <Button type="submit">Save income</Button>
    </form>
  );
}
