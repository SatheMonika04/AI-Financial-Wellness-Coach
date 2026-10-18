import type { WellnessInput, WellnessScore } from "@/types";
import { API_CONFIG, apiClient, ENDPOINTS } from "./apiClient";
import { mockWellnessService } from "@/mocks/services/wellnessService.mock";

export interface WellnessService {
  getScore(input: WellnessInput): Promise<WellnessScore>;
}

const http: WellnessService = {
  getScore: (input) => apiClient.post(ENDPOINTS.wellness, input),
};

export const wellnessService = API_CONFIG.useMocks ? mockWellnessService : http;
