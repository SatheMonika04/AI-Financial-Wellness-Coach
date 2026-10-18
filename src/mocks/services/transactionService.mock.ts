import type { PaymentMethod, Transaction } from "@/types";
import type { TransactionService } from "@/services/transactionService";
import { delay } from "@/services/apiClient";
import { parseCsv } from "@/lib/csv";
import { mockPdfExtraction } from "../statements";

function guessMapping(headers: string[]) {
  const find = (re: RegExp) => headers.find((h) => re.test(h)) ?? "";
  return {
    date: find(/date/i) || headers[0] || "",
    description: find(/narration|description|details|particular|merchant/i) || headers[1] || "",
    amount: find(/amount|value|debit|withdrawal/i) || headers[2] || "",
    type: find(/dr\/cr|type|cr\/dr|credit\/debit/i) || undefined,
  };
}

function guessMethod(d: string): PaymentMethod {
  if (/upi/i.test(d)) return "UPI";
  if (/pos|card/i.test(d)) return "Debit Card";
  if (/neft|imps|rtgs/i.test(d)) return "Net Banking";
  return "UPI";
}

export const mockTransactionService: TransactionService = {
  async update(_id, patch) {
    await delay(300);
    return patch;
  },
  async parseStatement(file, { existing }) {
    await delay(700);
    if (file.name.toLowerCase().endsWith(".pdf")) return mockPdfExtraction(file.name, existing);
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("The CSV file has no transaction rows.");
    const [headers, ...data] = rows;
    return { fileName: file.name, fileType: "csv", headers, rows: data, suggestedMapping: guessMapping(headers), source: "demo" };
  },
  async importTransactions(rows) {
    await delay(800);
    const stamp = Date.now().toString(36);
    return rows.map<Transaction>((r, i) => ({
      id: `imp_${stamp}_${i}`,
      date: r.date,
      merchant: r.merchant,
      description: r.description,
      category: r.category,
      type: r.type,
      paymentMethod: guessMethod(r.description),
      amount: r.amount,
      status: "completed",
      prediction: { ...r.prediction, userOverridden: r.category !== r.prediction.predictedCategory },
      source: "import",
    }));
  },
};
