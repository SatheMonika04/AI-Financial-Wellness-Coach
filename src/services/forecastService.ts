import type { ForecastRequest, ForecastResponse } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface ForecastService {
  getForecast(req: ForecastRequest): Promise<ForecastResponse>;
}

const http: ForecastService = {
  getForecast: (req) => apiClient.post(ENDPOINTS.forecast, req),
};

export const forecastService = http;
