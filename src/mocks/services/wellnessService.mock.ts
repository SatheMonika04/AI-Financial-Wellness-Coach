import type { WellnessComponent, WellnessLevel, WellnessScore } from "@/types";
import type { WellnessService } from "@/services/wellnessService";
import { delay } from "@/services/apiClient";
import { computeWellness } from "../wellnessEngine";

export const mockWellnessService: WellnessService = {
  async getScore(input): Promise<WellnessScore> {
    await delay(600);
    return computeWellness(input);
  },
};

export type { WellnessComponent, WellnessLevel };
