import type { Transaction } from "@/types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function transactionsToCsv(txs: Transaction[]) {
  const header = [
    "Date",
    "Merchant",
    "Description",
    "Category",
    "Payment method",
    "Type",
    "Amount (INR)",
    "Status",
    "AI confidence",
    "Anomaly",
  ];
  const lines = txs.map((t) =>
    [
      t.date.replace("T", " "),
      t.merchant,
      t.description,
      t.category,
      t.paymentMethod,
      t.type,
      t.type === "expense" ? -t.amount : t.amount,
      t.status,
      t.prediction?.confidence.toFixed(2) ?? "",
      t.anomaly?.flagged ? t.anomaly.reviewStatus : "",
    ]
      .map((value) => esc(value ?? ""))
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function downloadText(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
