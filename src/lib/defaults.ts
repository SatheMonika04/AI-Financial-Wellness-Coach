import type { AppSettings } from "@/types";

export const DEFAULT_SETTINGS: AppSettings = {
  currency: "INR",
  theme: "light",
  notifications: { anomalyAlerts: false, budgetAlerts: false, weeklySummary: false, goalReminders: false },
  privacy: { persistLocally: true, shareAnonymized: false },
  financial: { monthStartDay: 1, lowConfidenceThreshold: 0.7 },
};
