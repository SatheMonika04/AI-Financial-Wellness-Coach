import type { CategoryPrediction } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

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

export const categorizationService = http;
