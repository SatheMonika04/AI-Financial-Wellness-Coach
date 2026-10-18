import type { StatementParseResult, Transaction } from "@/types";

const HEADERS = ["Txn Date", "Narration", "Amount", "Dr/Cr"];

/** Builds a sample bank statement CSV. Two rows deliberately duplicate existing records. */
export function buildSampleCsv(existing: Transaction[]) {
  const dupes = existing.filter((t) => t.type === "expense" && t.source === "demo" && !t.anomaly).slice(0, 2);
  const rows: string[][] = [
    ["2026-10-02 19:12", "UPI/ZEPTO MARKETPLACE/groceries", "642", "DR"],
    ["2026-10-03 08:40", "IRCTC E-TICKET PNR 4521", "1385", "DR"],
    ["2026-10-04 13:05", "POS DECATHLON WHITEFIELD", "2899", "DR"],
    ["2026-10-05 21:30", "UPI/DOMINOS PIZZA", "784", "DR"],
    ["2026-10-06 10:00", "NEFT CR – REFUND AMAZON", "1299", "CR"],
    ["2026-10-07 17:45", "UPI/MEDPLUS PHARMACY", "436", "DR"],
    ["2026-10-08 09:15", "UPI/SHARMA KIRANA STORE", "318", "DR"],
    ["2026-10-08 20:20", "TATA PLAY DTH RECHARGE", "450", "DR"],
    ["2026-10-09 12:10", "UPI/PAYTM-8823 MISC", "1200", "DR"],
    ...dupes.map((t) => [t.date.replace("T", " "), `${t.merchant.toUpperCase()} – ${t.description}`, String(t.amount), "DR"]),
  ];
  return [HEADERS, ...rows].map((r) => r.join(",")).join("\n");
}

/** Demo-only stand-in for backend PDF extraction. */
export function mockPdfExtraction(fileName: string, existing: Transaction[]): StatementParseResult {
  const text = buildSampleCsv(existing).split("\n").map((l) => l.split(","));
  return {
    fileName,
    fileType: "pdf",
    headers: text[0],
    rows: text.slice(1),
    suggestedMapping: { date: "Txn Date", description: "Narration", amount: "Amount", type: "Dr/Cr" },
    source: "demo",
  };
}
