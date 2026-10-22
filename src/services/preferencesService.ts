import type { AppSettings, FinancialProfile } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export type PreferencesResponse = { profile: FinancialProfile; settings: AppSettings };

export const preferencesService = {
  get: () => apiClient.get<PreferencesResponse>(ENDPOINTS.preferences),
  save: (value: PreferencesResponse) =>
    apiClient.put<PreferencesResponse>(ENDPOINTS.preferences, value),
};
