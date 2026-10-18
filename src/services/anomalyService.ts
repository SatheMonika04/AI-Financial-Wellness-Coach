import type { AnomalyReviewStatus, AnomalyRunSummary, Transaction } from "@/types";
import { API_CONFIG, apiClient, ENDPOINTS } from "./apiClient";
import { mockAnomalyService } from "@/mocks/services/anomalyService.mock";

export interface AnomalyService {
  runDetection(transactions: Transaction[]): Promise<AnomalyRunSummary>;
  updateReview(id: string, status: AnomalyReviewStatus, note?: string): Promise<void>;
}

const http: AnomalyService = {
  runDetection: (transactions) => apiClient.post(ENDPOINTS.anomalies, { transaction_ids: transactions.map((t) => t.id) }),
  updateReview: (id, status, note) => apiClient.patch(ENDPOINTS.anomalyReview(id), { status, note }),
};

export const anomalyService = API_CONFIG.useMocks ? mockAnomalyService : http;
