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

export function BudgetsPage() {
  const { state, actions } = useAppStore();
  const rows = useBudgetRows("month");
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
        description="These limits are saved in this browser. Recommendations are unavailable until a model service is connected."
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
              save={(amount) => actions.setBudget(row.category, amount)}
            />
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="Financial profile"
        description="Profile details are stored locally and are not sent to a recommendation model."
      >
        <IncomeEditor
          initial={state.profile.monthlyIncome}
          save={(monthlyIncome) => actions.setProfile({ ...state.profile, monthlyIncome })}
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
  save: (amount: number) => void;
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
            onClick={() => {
              const amount = Number(value);
              if (!Number.isFinite(amount) || amount < 0)
                return toast.error("Enter a valid non-negative limit");
              save(amount);
              setEditing(false);
              toast.success("Monthly limit saved");
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

function IncomeEditor({ initial, save }: { initial: number; save: (amount: number) => void }) {
  const [value, setValue] = useState(String(initial || ""));
  return (
    <form
      className="flex max-w-md items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < 0)
          return toast.error("Enter a valid non-negative amount");
        save(amount);
        toast.success("Monthly income saved");
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
