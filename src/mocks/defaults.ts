import type { AppSettings, BudgetCategory, FinancialGoal, FinancialProfile } from "@/types";

export const DEFAULT_PROFILE: FinancialProfile = {
  name: "Prathmesh Ambulge",
  email: "prathmesh@example.com",
  city: "Bengaluru",
  monthlyIncome: 95000,
  age: 27,
  occupation: "Software Engineer",
  savingsGoal: 25000,
  financialGoal: "Build a 6-month emergency fund",
  creditScore: 762,
  totalDebt: 180000,
  focusCategory: "Dining",
};

export const DEFAULT_BUDGETS: Record<BudgetCategory, number> = {
  Housing: 22000,
  Groceries: 9000,
  Transportation: 5000,
  Dining: 5000,
  Shopping: 6000,
  Healthcare: 3500,
  Utilities: 4500,
  Entertainment: 2000,
  Education: 1500,
  Other: 2500,
  Savings: 25000,
};

export const DEFAULT_GOALS: FinancialGoal[] = [
  { id: "goal_1", name: "Emergency fund", type: "emergency", targetAmount: 300000, currentAmount: 142000, targetDate: "2027-06-30", completed: false, createdAt: "2026-01-10" },
  { id: "goal_2", name: "New MacBook Pro", type: "gadget", targetAmount: 180000, currentAmount: 64000, targetDate: "2027-02-28", completed: false, createdAt: "2026-04-02" },
  { id: "goal_3", name: "MS application fund", type: "education", targetAmount: 250000, currentAmount: 38000, targetDate: "2027-12-31", completed: false, createdAt: "2026-05-18" },
  { id: "goal_4", name: "Ladakh trip", type: "travel", targetAmount: 60000, currentAmount: 60000, targetDate: "2026-09-15", completed: true, createdAt: "2026-02-20" },
  { id: "goal_5", name: "General savings", type: "savings", targetAmount: 100000, currentAmount: 21500, targetDate: "2027-03-31", completed: false, createdAt: "2026-07-01" },
];

export const DEFAULT_SETTINGS: AppSettings = {
  currency: "INR",
  theme: "light",
  notifications: { anomalyAlerts: true, budgetAlerts: true, weeklySummary: false, goalReminders: true },
  privacy: { persistLocally: true, shareAnonymized: false },
  financial: { monthStartDay: 1, lowConfidenceThreshold: 0.7 },
};
