import type { WellnessScore } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface WellnessService {
  getScore(): Promise<WellnessScore>;
}

const http: WellnessService = {
  getScore: () => apiClient.get(ENDPOINTS.wellness),
};

export const wellnessService = http;
