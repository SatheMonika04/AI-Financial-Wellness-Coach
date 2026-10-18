import type { WellnessInput, WellnessScore } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface WellnessService {
  getScore(input: WellnessInput): Promise<WellnessScore>;
}

const http: WellnessService = {
  getScore: (input) => apiClient.post(ENDPOINTS.wellness, input),
};

export const wellnessService = http;
