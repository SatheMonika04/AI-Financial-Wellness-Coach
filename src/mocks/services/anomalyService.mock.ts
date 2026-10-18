import { format } from "date-fns";
import type { AnomalyService } from "@/services/anomalyService";
import { delay } from "@/services/apiClient";
import { TODAY } from "@/lib/period";

export const mockAnomalyService: AnomalyService = {
  async runDetection(transactions) {
    await delay(1200);
    return {
      analyzed: transactions.length,
      flagged: transactions.filter((t) => t.anomaly?.flagged).length,
      ranAt: format(TODAY, "yyyy-MM-dd'T'HH:mm"),
      source: "demo",
    };
  },
  async updateReview() {
    await delay(250);
  },
};
