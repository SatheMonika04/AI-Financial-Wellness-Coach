import type { ForecastResponse } from "@/types";
import { apiClient, ENDPOINTS } from "./apiClient";

export interface ForecastService {
  getForecast(req: { horizonDays: number }): Promise<ForecastResponse>;
}

const http: ForecastService = {
  getForecast: (req) => apiClient.post(ENDPOINTS.forecast, req),
};

export const forecastService = http;
