import type { BudgetCategory, BudgetModelFeatures, BudgetRecommendationResponse, FinancialProfile } from "@/types";
import { API_CONFIG, apiClient, ENDPOINTS } from "./apiClient";
import { mockBudgetService } from "@/mocks/services/budgetService.mock";

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

export const budgetService = API_CONFIG.useMocks ? mockBudgetService : http;
