import type { FinancialGoal } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface GoalService {
  create(goal: FinancialGoal): Promise<FinancialGoal>;
  update(goal: FinancialGoal): Promise<FinancialGoal>;
  remove(id: string): Promise<void>;
}

const http: GoalService = {
  create: (goal) => apiClient.post(ENDPOINTS.goals, goal),
  update: (goal) => apiClient.patch(ENDPOINTS.goal(goal.id), goal),
  remove: (id) => apiClient.delete(ENDPOINTS.goal(id)),
};

export const goalService = http;
