import { useEffect, useMemo, useState } from "react";
import { parseISO, subDays, startOfMonth } from "date-fns";
import { ArrowDownUp, Download, Eye, FilterX, ReceiptText, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Amount,
  CategoryBadge,
  EmptyState,
  PageIntro,
  ReviewBadge,
  SectionCard,
} from "@/components/common";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";
import { useAppStore } from "@/store/AppStore";
import { ALL_CATEGORIES, PAYMENT_METHODS } from "@/lib/categories";
import { formatDate, formatINR } from "@/lib/format";
import { TODAY } from "@/lib/period";
import { downloadText, transactionsToCsv } from "@/lib/csv";
import { totals } from "@/lib/analytics";

export interface TxSearch {
  category?: string;
  q?: string;
  anomaly?: string;
}

const DATE_OPTS = [
  { v: "all", l: "All time" },
  { v: "7", l: "Last 7 days" },
  { v: "30", l: "Last 30 days" },
  { v: "90", l: "Last 90 days" },
  { v: "month", l: "This month" },
];
const PAGE = 15;

export function TransactionsPage({ search }: { search: TxSearch }) {
  const { state } = useAppStore();
  const [q, setQ] = useState(search.q ?? "");
  const [category, setCategory] = useState(search.category ?? "all");
  const [type, setType] = useState("all");
  const [method, setMethod] = useState("all");
  const [anomaly, setAnomaly] = useState(search.anomaly ?? "all");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">(
    "date_desc",
  );
  const [page, setPage] = useState(1);
  const [openTx, setOpenTx] = useState<string | null>(null);

  useEffect(() => {
    setCategory(search.category ?? "all");
    setQ(search.q ?? "");
    setAnomaly(search.anomaly ?? "all");
  }, [search.category, search.q, search.anomaly]);
  useEffect(() => setPage(1), [q, category, type, method, anomaly, range, sort]);

  const filtered = useMemo(() => {
    const start =
      range === "all"
        ? null
        : range === "month"
          ? startOfMonth(TODAY)
          : subDays(TODAY, Number(range));
    const ql = q.trim().toLowerCase();
    const list = state.transactions.filter((t) => {
      if (ql && !`${t.merchant} ${t.description}`.toLowerCase().includes(ql)) return false;
      if (category !== "all" && t.category !== category) return false;
      if (type !== "all" && t.type !== type) return false;
      if (method !== "all" && t.paymentMethod !== method) return false;
      if (anomaly === "flagged" && !t.anomaly?.flagged) return false;
      if (anomaly === "clear" && t.anomaly?.flagged) return false;
      if (anomaly === "review" && !t.prediction?.needsReview) return false;
      if (start && parseISO(t.date) < start) return false;
      return true;
    });
    const [k, dir] = sort.split("_") as ["date" | "amount", "asc" | "desc"];
    return list.sort((a, b) => {
      const d = k === "date" ? (a.date < b.date ? -1 : 1) : a.amount - b.amount;
      return dir === "asc" ? d : -d;
    });
  }, [state.transactions, q, category, type, method, anomaly, range, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const t = totals(filtered);
  const active =
    q ||
    category !== "all" ||
    type !== "all" ||
    method !== "all" ||
    anomaly !== "all" ||
    range !== "all";
  const clear = () => {
    setQ("");
    setCategory("all");
    setType("all");
    setMethod("all");
    setAnomaly("all");
    setRange("all");
  };
  const exportCsv = () => {
    if (!filtered.length) return toast.error("Nothing to export");
    downloadText(`moneymind-transactions-${filtered.length}.csv`, transactionsToCsv(filtered));
    toast.success(`Exported ${filtered.length} transactions`);
  };
  const toggleSort = (k: "date" | "amount") =>
    setSort((s) => (s === `${k}_desc` ? `${k}_asc` : `${k}_desc`));

  return (
    <div>
      <PageIntro
        title="Transactions"
        description="Search, filter, recategorize and export every transaction. Categories come from the AI categorization model."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download /> Export CSV
          </Button>
        }
      />
      <SectionCard bodyClassName="p-0">
        <div className="grid gap-2 border-b p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search merchant or description"
              className="pl-9"
            />
          </div>
          <Filter value={range} onChange={setRange} options={DATE_OPTS.map((d) => [d.v, d.l])} />
          <Filter
            value={category}
            onChange={setCategory}
            options={[["all", "All categories"], ...ALL_CATEGORIES.map((c) => [c, c])]}
          />
          <Filter
            value={type}
            onChange={setType}
            options={[
              ["all", "All types"],
              ["income", "Income"],
              ["expense", "Expense"],
            ]}
          />
          <Filter
            value={method}
            onChange={setMethod}
            options={[["all", "All methods"], ...PAYMENT_METHODS.map((m) => [m, m])]}
          />
          <Filter
            value={anomaly}
            onChange={setAnomaly}
            options={[
              ["all", "Any status"],
              ["flagged", "Unusual only"],
              ["clear", "Not flagged"],
              ["review", "Low confidence"],
            ]}
          />
          <Button variant="ghost" onClick={clear} disabled={!active}>
            <FilterX /> Clear
          </Button>
        </div>
        {state.hydrated && state.transactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground num">{filtered.length}</span>{" "}
              transactions
            </span>
            <span>
              Income <span className="font-semibold text-success num">{formatINR(t.income)}</span>
            </span>
            <span>
              Expenses{" "}
              <span className="font-semibold text-foreground num">{formatINR(t.expenses)}</span>
            </span>
          </div>
        )}
        {!state.hydrated ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={
              state.transactions.length === 0
                ? "No transaction data is available yet"
                : "No transactions match"
            }
            description={
              state.transactions.length === 0
                ? "Transaction records will appear here when available."
                : "Try adjusting the filters or clearing your search."
            }
            action={
              state.transactions.length === 0 ? undefined : active ? (
                <Button size="sm" variant="outline" onClick={clear}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("date")}
                    >
                      Date <ArrowDownUp className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">Merchant / Description</th>
                  <th className="px-3 py-2.5 font-medium">Category</th>
                  <th className="px-3 py-2.5 font-medium">Payment</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("amount")}
                    >
                      Amount <ArrowDownUp className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">Categorization</th>
                  <th className="px-3 py-2.5 font-medium">Anomaly</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b transition-colors last:border-0 hover:bg-accent/50"
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground num">
                      {formatDate(tx.date, "d MMM yy")}
                      <span className="block text-[11px]">{formatDate(tx.date, "h:mm a")}</span>
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <p className="truncate font-semibold">{tx.merchant}</p>
                      <p className="truncate text-xs text-muted-foreground">{tx.description}</p>
                    </td>
                    <td className="px-3 py-3">
                      <CategoryBadge category={tx.category} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {tx.paymentMethod ?? "Not provided"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-xs font-semibold ${tx.type === "income" ? "text-success" : "text-muted-foreground"}`}
                      >
                        {tx.type === "income" ? "Income" : "Expense"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Amount value={tx.amount} type={tx.type} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {tx.prediction
                        ? `${tx.prediction.predictedCategory} · model output`
                        : "Not available"}
                    </td>
                    <td className="px-3 py-3">
                      {tx.anomaly?.flagged ? (
                        <ReviewBadge status={tx.anomaly.reviewStatus} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setOpenTx(tx.id)}>
                        <Eye /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </SectionCard>
      <TransactionDetailSheet txId={openTx} onOpenChange={(o) => !o && setOpenTx(null)} />
    </div>
  );
}

function Filter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
