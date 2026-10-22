import type { ImportCandidate, StatementParseResult, Transaction } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface TransactionService {
  list(): Promise<{ items: Transaction[]; total: number }>;
  update(id: string, patch: Partial<Transaction>): Promise<Partial<Transaction>>;
  parseStatement(file: File, ctx: { existing: Transaction[] }): Promise<StatementParseResult>;
  importTransactions(rows: ImportCandidate[]): Promise<{
    transactions: Transaction[];
    importedRows: number;
    duplicateRowsSkipped: number;
    invalidRows: number;
  }>;
}

const httpTransactionService: TransactionService = {
  list: async () => {
    const pageSize = 500;
    const first = await apiClient.get<{ items: Transaction[]; total: number }>(
      `${ENDPOINTS.transactions}?page=1&page_size=${pageSize}`,
    );
    const items = [...first.items];
    for (let page = 2; items.length < first.total; page += 1) {
      const next = await apiClient.get<{ items: Transaction[]; total: number }>(
        `${ENDPOINTS.transactions}?page=${page}&page_size=${pageSize}`,
      );
      if (!next.items.length) break;
      items.push(...next.items);
    }
    return { items, total: first.total };
  },
  update: (id, patch) => apiClient.patch(ENDPOINTS.transaction(id), patch),
  parseStatement: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient.upload(ENDPOINTS.uploadStatement, fd);
  },
  importTransactions: async (rows) => {
    const result = await apiClient.post<{
      transactions: Transaction[];
      importedRows: number;
      duplicateRowsSkipped: number;
      invalidRows: number;
    }>(ENDPOINTS.importTransactions, { rows });
    return result;
  },
};

export const transactionService: TransactionService = httpTransactionService;
