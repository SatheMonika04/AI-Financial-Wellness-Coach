import type { ImportCandidate, StatementParseResult, Transaction } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface TransactionService {
  update(id: string, patch: Partial<Transaction>): Promise<Partial<Transaction>>;
  parseStatement(file: File, ctx: { existing: Transaction[] }): Promise<StatementParseResult>;
  importTransactions(rows: ImportCandidate[]): Promise<Transaction[]>;
}

const httpTransactionService: TransactionService = {
  update: (id, patch) => apiClient.patch(ENDPOINTS.transaction(id), patch),
  parseStatement: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient.upload(ENDPOINTS.uploadStatement, fd);
  },
  importTransactions: (rows) => apiClient.post(ENDPOINTS.importTransactions, { rows }),
};

export const transactionService: TransactionService = httpTransactionService;
