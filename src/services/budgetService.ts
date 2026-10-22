import type { BudgetCategory, BudgetRecommendationResponse } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface BudgetService {
  list(): Promise<{ category: BudgetCategory; monthlyLimit: number }[]>;
  put(category: BudgetCategory, monthlyLimit: number): Promise<unknown>;
  remove(category: BudgetCategory): Promise<void>;
  getRecommendations(): Promise<BudgetRecommendationResponse>;
}

const http: BudgetService = {
  list: () => apiClient.get(ENDPOINTS.budgets),
  put: (category, monthlyLimit) => apiClient.put(ENDPOINTS.budget(category), { monthlyLimit }),
  remove: (category) => apiClient.delete(ENDPOINTS.budget(category)),
  getRecommendations: () => apiClient.get(ENDPOINTS.budgetRecommendations),
};

export const budgetService = http;
