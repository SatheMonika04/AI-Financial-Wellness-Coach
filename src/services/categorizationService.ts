import type { CategoryPrediction } from "@/types";
import { API_CONFIG, apiClient, ENDPOINTS } from "./apiClient";
import { mockCategorizationService } from "@/mocks/services/categorizationService.mock";

export interface CategorizationInput {
  description: string;
  amount: number;
  type: "income" | "expense";
}

export interface CategorizationService {
  categorize(items: CategorizationInput[]): Promise<CategoryPrediction[]>;
}

const http: CategorizationService = {
  categorize: (items) => apiClient.post(ENDPOINTS.categorize, { items }),
};

export const categorizationService = API_CONFIG.useMocks ? mockCategorizationService : http;
