import type { BudgetCategory, BudgetModelFeatures, BudgetRecommendationResponse, FinancialProfile } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface BudgetRecommendationRequest {
  profile: FinancialProfile;
  features: BudgetModelFeatures;
  currentBudgets: Record<BudgetCategory, number>;
}

export interface BudgetService {
  getRecommendations(req: BudgetRecommendationRequest): Promise<BudgetRecommendationResponse>;
}

const http: BudgetService = {
  getRecommendations: (req) => apiClient.post(ENDPOINTS.budgetRecommendations, req),
};

export const budgetService = http;
