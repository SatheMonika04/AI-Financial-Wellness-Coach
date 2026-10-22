import type { AnomalyReviewStatus, AnomalyResult, AnomalyRunSummary, Transaction } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface AnomalyService {
  runDetection(
    transactions: Transaction[],
  ): Promise<AnomalyRunSummary & { results: (AnomalyResult & { id: string })[] }>;
  updateReview(id: string, status: AnomalyReviewStatus, note?: string): Promise<void>;
}

const http: AnomalyService = {
  runDetection: (transactions) =>
    apiClient.post(ENDPOINTS.anomalies, { transaction_ids: transactions.map((t) => t.id) }),
  updateReview: (id, status, note) =>
    apiClient.patch(ENDPOINTS.anomalyReview(id), { status, note }),
};

export const anomalyService = http;
