import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { format, isValid, parse, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Copy, FileSpreadsheet, FileText, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CategoryBadge, ConfidenceMeter, DemoBadge, PageIntro, SectionCard } from "@/components/common";
import { useAppStore } from "@/store/AppStore";
import { transactionService } from "@/services/transactionService";
import { categorizationService } from "@/services/categorizationService";
import { buildSampleCsv } from "@/mocks/statements";
import { ALL_CATEGORIES } from "@/lib/categories";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, ColumnMapping, ImportCandidate, StatementParseResult } from "@/types";

const STEPS = ["Upload file", "Review data", "Review categories", "Confirm import"];
const MAX = 10 * 1024 * 1024;
const NONE = "__none__";

function normalizeDate(v: string): string | null {
  const s = v.trim();
  const fmts = ["yyyy-MM-dd HH:mm", "yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "dd/MM/yyyy HH:mm", "d MMM yyyy"];
  for (const f of fmts) {
    const d = parse(s, f, new Date(2026, 0, 1));
    if (isValid(d)) return format(d, "yyyy-MM-dd'T'HH:mm");
  }
  const d = parseISO(s);
  return isValid(d) ? format(d, "yyyy-MM-dd'T'HH:mm") : null;
}

function merchantFrom(desc: string) {
  const parts = desc.split(/[/–-]/).map((p) => p.trim()).filter(Boolean);
  const m = (parts[0]?.toUpperCase() === "UPI" || parts[0]?.toUpperCase() === "POS" ? parts[1] : parts[0]) ?? desc;
  return m.replace(/^(POS|UPI)\s+/i, "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40);
}

export function UploadPage() {
  const { state, actions } = useAppStore();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<StatementParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(0); setFile(null); setParsed(null); setMapping(null); setCandidates([]); setProgress(0); setStage(""); setError(null); setDone(null);
  };

  const pickFile = (f: File) => {
    setError(null);
    const ext = f.name.toLowerCase().split(".").pop();
    if (ext !== "csv" && ext !== "pdf") return setError("Only CSV or PDF bank statements are supported.");
    if (f.size > MAX) return setError("File is larger than 10 MB.");
    if (f.size === 0) return setError("The file is empty.");
    setFile(f);
  };

  const useSample = () => pickFile(new File([buildSampleCsv(state.transactions)], "hdfc-statement-oct-2026.csv", { type: "text/csv" }));

  const process = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const stages = ["Uploading file", "Reading statement", "Extracting transactions"];
    try {
      for (let i = 0; i < stages.length; i++) {
        setStage(stages[i]);
        for (let p = i * 33; p <= (i + 1) * 33; p += 11) {
          setProgress(p);
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      const res = await transactionService.parseStatement(file, { existing: state.transactions });
      setProgress(100);
      setParsed(res);
      setMapping(res.suggestedMapping);
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const col = (name?: string) => (parsed && name ? parsed.headers.indexOf(name) : -1);

  const buildRows = () => {
    if (!parsed || !mapping) return [];
    const [di, de, am, ty] = [col(mapping.date), col(mapping.description), col(mapping.amount), col(mapping.type)];
    return parsed.rows.map((r, i) => {
      const raw = parseFloat((r[am] ?? "").replace(/[₹,\s]/g, ""));
      const tv = ty >= 0 ? (r[ty] ?? "") : "";
      const isIncome = ty >= 0 ? /cr|credit|income|deposit/i.test(tv) : raw > 0;
      return { key: `r${i}`, date: normalizeDate(r[di] ?? ""), description: r[de] ?? "", amount: Math.abs(raw), type: isIncome ? ("income" as const) : ("expense" as const) };
    });
  };
  const previewRows = buildRows();
  const invalid = previewRows.filter((r) => !r.date || !r.description || !r.amount || Number.isNaN(r.amount));

  const categorize = async () => {
    const valid = previewRows.filter((r) => r.date && r.description && r.amount);
    setBusy(true);
    try {
      const preds = await categorizationService.categorize(valid.map((r) => ({ description: r.description, amount: r.amount, type: r.type })));
      setCandidates(
        valid.map((r, i) => {
          const merchant = merchantFrom(r.description);
          const dup = state.transactions.find((t) => t.date.slice(0, 10) === r.date!.slice(0, 10) && t.amount === Math.round(r.amount) && r.description.toLowerCase().includes(t.merchant.toLowerCase().split(" ")[0]));
          return { key: r.key, date: r.date!, merchant, description: r.description, amount: Math.round(r.amount), type: r.type, prediction: preds[i], category: preds[i].predictedCategory, duplicateOf: dup?.id, include: !dup };
        }),
      );
      setStep(2);
    } catch (e) {
      toast.error("Categorization failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const items = await transactionService.importTransactions(candidates.filter((c) => c.include));
      actions.addTransactions(items);
      setDone(items.length);
      toast.success(`Imported ${items.length} transactions`);
    } catch (e) {
      toast.error("Import failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const update = (key: string, patch: Partial<ImportCandidate>) => setCandidates((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const included = candidates.filter((c) => c.include);
  const lowConf = candidates.filter((c) => c.prediction.needsReview);
  const dups = candidates.filter((c) => c.duplicateOf);

  return (
    <div>
      <PageIntro title="Upload statements" description="Import CSV or PDF bank statements. Transactions are extracted, categorized and checked for duplicates before import." badge={<DemoBadge label="Demo processing" tip="Parsing of PDFs and ML categorization are simulated in demo mode. CSV files are read in your browser." />} />

      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-xs font-semibold", i === step && !done && "border-ai text-ai", (i < step || done != null) && "text-success")}>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-[11px]", i === step && !done && "border-ai bg-ai-soft", (i < step || done != null) && "border-success bg-success-soft")}>{i < step || done != null ? "✓" : i + 1}</span>
            <span className="truncate">{s}</span>
          </li>
        ))}
      </ol>

      {done != null ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-8" /></span>
            <div>
              <h2 className="font-display text-xl font-semibold">Import complete</h2>
              <p className="mt-1 text-sm text-muted-foreground">{done} transactions were added and are now included in your overview, analytics and budgets.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild><Link to="/transactions">View transactions</Link></Button>
              <Button asChild variant="outline"><Link to="/analytics">Open analytics</Link></Button>
              <Button variant="ghost" onClick={reset}>Import another file</Button>
            </div>
          </div>
        </SectionCard>
      ) : step === 0 ? (
        <SectionCard>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
            className={cn("flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors", drag ? "border-ai bg-ai-soft/50" : "border-border bg-muted/30")}
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-card text-ai shadow-card"><UploadCloud className="size-6" /></span>
            <div>
              <p className="font-display font-semibold">Drag & drop your bank statement</p>
              <p className="text-xs text-muted-foreground">CSV or PDF · up to 10 MB</p>
            </div>
            <input ref={input} type="file" accept=".csv,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => input.current?.click()}>Browse files</Button>
              <Button variant="soft" onClick={useSample}>Use sample statement</Button>
            </div>
          </div>
          {error && <p className="mt-3 flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive"><AlertTriangle className="size-4" /> {error}</p>}
          {file && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">{file.name.endsWith(".pdf") ? <FileText /> : <FileSpreadsheet />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB {busy && `· ${stage}…`}</p>
                {busy && <Progress value={progress} className="mt-2 h-1.5" />}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" disabled={busy} onClick={() => setFile(null)}>Remove</Button>
                <Button disabled={busy} onClick={process}>{busy && <Loader2 className="animate-spin" />} Process file</Button>
              </div>
            </div>
          )}
        </SectionCard>
      ) : step === 1 && parsed && mapping ? (
        <SectionCard title="Review extracted data" description={`${parsed.rows.length} rows from ${parsed.fileName}${parsed.fileType === "pdf" ? " · demo extraction (real PDF parsing runs on the backend)" : ""}`}>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            {(["date", "description", "amount", "type"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label className="capitalize">{k === "type" ? "Debit / credit (optional)" : `${k} column`}</Label>
                <Select value={mapping[k] ?? NONE} onValueChange={(v) => setMapping({ ...mapping, [k]: v === NONE ? undefined : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {k === "type" && <SelectItem value={NONE}>— None (signed amounts) —</SelectItem>}
                    {parsed.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {invalid.length > 0 && <p className="mb-3 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground"><AlertTriangle className="size-4" /> {invalid.length} rows have an invalid date, description or amount and will be skipped. Check your column mapping.</p>}
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground"><th className="px-4 py-2">Date</th><th className="px-4 py-2">Description</th><th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
              <tbody>
                {previewRows.slice(0, 12).map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-4 py-2 num">{r.date ? formatDate(r.date, "d MMM yyyy") : <span className="text-destructive">Invalid</span>}</td>
                    <td className="max-w-[320px] truncate px-4 py-2">{r.description}</td>
                    <td className="px-4 py-2 capitalize text-muted-foreground">{r.type}</td>
                    <td className="px-4 py-2 text-right num">{Number.isNaN(r.amount) ? <span className="text-destructive">Invalid</span> : formatINR(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="ghost" onClick={reset}>Back</Button>
            <Button variant="ai" disabled={busy || previewRows.length === invalid.length} onClick={categorize}>{busy && <Loader2 className="animate-spin" />} Categorize transactions</Button>
          </div>
        </SectionCard>
      ) : step === 2 ? (
        <SectionCard title="Review categories" description="Demo categorization results — confirm low-confidence predictions and skip duplicates." action={<DemoBadge label="Demo predictions" />}>
          <div className="mb-4 flex flex-wrap gap-2">
            {lowConf.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning-foreground"><AlertTriangle className="size-3.5" /> {lowConf.length} low-confidence categories</span>}
            {dups.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-lg bg-destructive-soft px-3 py-1.5 text-xs font-medium text-destructive"><Copy className="size-3.5" /> {dups.length} possible duplicates (unchecked)</span>}
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground"><th className="px-4 py-2">Import</th><th className="px-4 py-2">Transaction</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Confidence</th><th className="px-4 py-2">Flags</th></tr></thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.key} className={cn("border-t", !c.include && "opacity-60")}>
                    <td className="px-4 py-2"><Checkbox checked={c.include} onCheckedChange={(v) => update(c.key, { include: !!v })} aria-label="Include" /></td>
                    <td className="max-w-[260px] px-4 py-2"><p className="truncate font-semibold">{c.merchant}</p><p className="truncate text-xs text-muted-foreground">{formatDate(c.date, "d MMM")} · {c.description}</p></td>
                    <td className={cn("px-4 py-2 text-right font-semibold num", c.type === "income" && "text-success")}>{c.type === "income" ? "+" : "−"}{formatINR(c.amount)}</td>
                    <td className="px-4 py-2">
                      <Select value={c.category} onValueChange={(v) => update(c.key, { category: v as Category })}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{ALL_CATEGORIES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2"><ConfidenceMeter value={c.prediction.confidence} /></td>
                    <td className="px-4 py-2 text-xs">
                      {c.duplicateOf && <span className="block font-medium text-destructive">Possible duplicate</span>}
                      {c.prediction.needsReview && c.category === c.prediction.predictedCategory && <span className="block font-medium text-warning-foreground">Please confirm</span>}
                      {c.category !== c.prediction.predictedCategory && <span className="block text-muted-foreground">Edited</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button disabled={!included.length} onClick={() => setStep(3)}>Continue</Button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Confirm import">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Transactions to import", included.length],
              ["Skipped", candidates.length - included.length],
              ["Total debits", formatINR(included.filter((c) => c.type === "expense").reduce((s, c) => s + c.amount, 0))],
              ["Total credits", formatINR(included.filter((c) => c.type === "income").reduce((s, c) => s + c.amount, 0))],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="font-display text-xl font-semibold num">{v}</p></div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">{[...new Set(included.map((c) => c.category))].map((c) => <CategoryBadge key={c} category={c} />)}</div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button variant="success" disabled={busy} onClick={doImport}>{busy && <Loader2 className="animate-spin" />} Import {included.length} transactions</Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
