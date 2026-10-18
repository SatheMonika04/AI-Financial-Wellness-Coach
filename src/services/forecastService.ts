import type { ForecastRequest, ForecastResponse } from "@/types";
import { API_CONFIG, apiClient, ENDPOINTS } from "./apiClient";
import { mockForecastService } from "@/mocks/services/forecastService.mock";

export interface ForecastService {
  getForecast(req: ForecastRequest): Promise<ForecastResponse>;
}

const http: ForecastService = {
  getForecast: (req) => apiClient.post(ENDPOINTS.forecast, req),
};

export const forecastService = API_CONFIG.useMocks ? mockForecastService : http;
