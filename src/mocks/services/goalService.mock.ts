import type { GoalService } from "@/services/goalService";
import { delay } from "@/services/apiClient";

export const mockGoalService: GoalService = {
  async create(goal) {
    await delay(300);
    return goal;
  },
  async update(goal) {
    await delay(250);
    return goal;
  },
  async remove() {
    await delay(250);
  },
};
