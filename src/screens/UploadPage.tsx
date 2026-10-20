import { useRef, useState } from "react";
import { format, isValid, parse, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Copy, FileSpreadsheet, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryBadge, EmptyState, PageIntro, SectionCard } from "@/components/common";
import { useAppStore } from "@/store/AppStore";
import { parseCsv } from "@/lib/csv";
import { ALL_CATEGORIES } from "@/lib/categories";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, ColumnMapping, ImportCandidate } from "@/types";

const NONE = "__none__";
const MAX = 10 * 1024 * 1024;
const STEPS = ["Upload CSV", "Review rows", "Assign categories"];

function normalizeDate(value: string): string | null {
  const input = value.trim();
  for (const pattern of [
    "yyyy-MM-dd HH:mm",
    "yyyy-MM-dd",
    "dd/MM/yyyy",
    "dd-MM-yyyy",
    "dd/MM/yyyy HH:mm",
    "d MMM yyyy",
  ]) {
    const date = parse(input, pattern, new Date());
    if (isValid(date)) return format(date, "yyyy-MM-dd'T'HH:mm");
  }
  const date = parseISO(input);
  return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm") : null;
}

function merchantFrom(description: string) {
  const first =
    description
      .split(/[/-]/)
      .map((part) => part.trim())
      .filter(Boolean)[0] ?? description;
  return first.replace(/^(POS|UPI)\s+/i, "").slice(0, 60);
}

export function UploadPage() {
  const { state, actions } = useAppStore();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [done, setDone] = useState<number | null>(null);

  const chooseFile = (selected: File) => {
    if (!selected.name.toLowerCase().endsWith(".csv"))
      return setError(
        "Choose a CSV file. PDF parsing will be available after backend integration.",
      );
    if (selected.size > MAX) return setError("File is larger than 10 MB.");
    if (!selected.size) return setError("The file is empty.");
    setError(null);
    setFile(selected);
  };

  const processFile = async () => {
    if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("The CSV file has no transaction rows.");
      const [columns, ...data] = parsed;
      const find = (pattern: RegExp) => columns.find((column) => pattern.test(column)) ?? "";
      setHeaders(columns);
      setRows(data);
      setMapping({
        date: find(/date/i) || columns[0] || "",
        description: find(/narration|description|details|particular|merchant/i) || columns[1] || "",
        amount: find(/amount|value|debit|withdrawal/i) || columns[2] || "",
        type: find(/dr\/cr|type|cr\/dr|credit\/debit/i) || undefined,
      });
      setStep(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this CSV file.");
    }
  };

  const index = (key?: string) => (key ? headers.indexOf(key) : -1);
  const preview = mapping
    ? rows.map((row, i) => {
        const amountText = (row[index(mapping.amount)] ?? "").replace(/[₹,\s]/g, "");
        const signedAmount = Number.parseFloat(amountText);
        const typeText = row[index(mapping.type)] ?? "";
        const income = mapping.type ? /cr|credit|income|deposit/i.test(typeText) : signedAmount > 0;
        return {
          key: `row-${i}`,
          date: normalizeDate(row[index(mapping.date)] ?? ""),
          description: row[index(mapping.description)] ?? "",
          amount: Math.abs(signedAmount),
          type: income ? ("income" as const) : ("expense" as const),
        };
      })
    : [];
  const invalid = preview.filter(
    (row) => !row.date || !row.description || !Number.isFinite(row.amount) || row.amount === 0,
  );

  const makeCandidates = () => {
    const valid = preview.filter(
      (row) => row.date && row.description && Number.isFinite(row.amount) && row.amount > 0,
    );
    setCandidates(
      valid.map((row) => {
        const merchant = merchantFrom(row.description);
        const duplicate = state.transactions.find(
          (tx) =>
            tx.date.slice(0, 10) === row.date!.slice(0, 10) &&
            tx.amount === Math.round(row.amount) &&
            tx.description.toLowerCase() === row.description.toLowerCase(),
        );
        return {
          key: row.key,
          date: row.date!,
          merchant,
          description: row.description,
          amount: Math.round(row.amount),
          type: row.type,
          category: null,
          duplicateOf: duplicate?.id,
          include: !duplicate,
        };
      }),
    );
    setStep(2);
  };

  const importRows = () => {
    const selected = candidates.filter((candidate) => candidate.include && candidate.category);
    const stamp = Date.now().toString(36);
    actions.addTransactions(
      selected.map((candidate, i) => ({
        id: `import_${stamp}_${i}`,
        date: candidate.date,
        merchant: candidate.merchant,
        description: candidate.description,
        category: candidate.category as Category,
        type: candidate.type,
        amount: candidate.amount,
        status: "completed" as const,
        source: "import" as const,
      })),
    );
    setDone(selected.length);
    toast.success(`Imported ${selected.length} transactions`);
  };

  const update = (key: string, patch: Partial<ImportCandidate>) =>
    setCandidates((items) =>
      items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  const included = candidates.filter((candidate) => candidate.include);
  const reset = () => {
    setStep(0);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping(null);
    setCandidates([]);
    setDone(null);
    setError(null);
  };

  return (
    <div>
      <PageIntro
        title="Upload statements"
        description="Import transaction rows from a CSV statement. Rows are read in your browser; categories are assigned manually."
      />
      <ol className="mb-6 grid grid-cols-3 gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(
              "rounded-xl border bg-card px-3 py-2.5 text-xs font-semibold",
              i === step && done == null && "border-ai text-ai",
              i < step && "text-success",
            )}
          >
            <span className="mr-2">{i < step || done != null ? "✓" : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {done != null ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2 className="size-10 text-success" />
            <div>
              <h2 className="font-display text-xl font-semibold">Import complete</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {done} transaction records were added to this browser.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={reset} variant="outline">
                Import another CSV
              </Button>
              <Button
                onClick={() => {
                  window.location.assign("/transactions");
                }}
              >
                View transactions
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : step === 0 ? (
        <SectionCard>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const selected = event.dataTransfer.files[0];
              if (selected) chooseFile(selected);
            }}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-14 text-center"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-card text-ai shadow-card">
              <UploadCloud className="size-6" />
            </span>
            <div>
              <p className="font-display font-semibold">Choose a bank statement CSV</p>
              <p className="text-xs text-muted-foreground">
                Up to 10 MB. No file is uploaded to a server.
              </p>
            </div>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => event.target.files?.[0] && chooseFile(event.target.files[0])}
            />
            <Button variant="outline" onClick={() => input.current?.click()}>
              Browse files
            </Button>
          </div>
          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border p-4">
              <FileSpreadsheet className="size-5 text-ai" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{file.name}</span>
              <Button onClick={processFile}>Read CSV</Button>
            </div>
          )}
          {error && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="size-4" />
              {error}
            </p>
          )}
        </SectionCard>
      ) : step === 1 && mapping ? (
        <SectionCard title="Review CSV rows" description={`${rows.length} rows from ${file?.name}`}>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            {(["date", "description", "amount", "type"] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label className="capitalize">
                  {key === "type" ? "Debit / credit (optional)" : `${key} column`}
                </Label>
                <Select
                  value={mapping[key] ?? NONE}
                  onValueChange={(value) =>
                    setMapping({ ...mapping, [key]: value === NONE ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose column" />
                  </SelectTrigger>
                  <SelectContent>
                    {key === "type" && <SelectItem value={NONE}>Signed amounts</SelectItem>}
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {invalid.length > 0 && (
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
              <AlertTriangle className="size-4" />
              {invalid.length} invalid rows will be skipped.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 12).map((row) => (
                  <tr key={row.key} className="border-t">
                    <td className="px-4 py-2">
                      {row.date ? formatDate(row.date, "d MMM yyyy") : "Invalid"}
                    </td>
                    <td className="px-4 py-2">{row.description}</td>
                    <td className="px-4 py-2 capitalize">{row.type}</td>
                    <td className="px-4 py-2 text-right">
                      {Number.isFinite(row.amount) ? formatINR(row.amount) : "Invalid"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="ghost" onClick={reset}>
              Back
            </Button>
            <Button disabled={preview.length === invalid.length} onClick={makeCandidates}>
              Review categories
            </Button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="Assign categories"
          description="Choose a category for each record. No AI classification is performed."
        >
          {candidates.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No valid rows to import"
              description="Go back and check the column mapping."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Import</th>
                    <th className="px-3 py-2">Transaction</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.key} className="border-t">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={candidate.include}
                          onCheckedChange={(checked) =>
                            update(candidate.key, { include: !!checked })
                          }
                          aria-label="Import row"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold">{candidate.merchant}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(candidate.date, "d MMM")} · {candidate.description}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right">{formatINR(candidate.amount)}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={candidate.category ?? NONE}
                          onValueChange={(value) =>
                            update(candidate.key, {
                              category: value === NONE ? null : (value as Category),
                            })
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Choose category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Choose category</SelectItem>
                            {ALL_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {candidate.duplicateOf ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <Copy className="size-3" />
                            Possible duplicate
                          </span>
                        ) : !candidate.category ? (
                          "Choose category"
                        ) : (
                          <CategoryBadge category={candidate.category} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-5 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={importRows}
              disabled={!included.length || included.some((candidate) => !candidate.category)}
            >
              Import {included.length} transactions
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
