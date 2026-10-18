// Shared data contracts. Backend (FastAPI) responses should be mapped to these shapes
// inside src/services/* so pages never depend on raw API schemas.

export type ExpenseCategory =
  | "Housing"
  | "Groceries"
  | "Transportation"
  | "Dining"
  | "Shopping"
  | "Healthcare"
  | "Utilities"
  | "Entertainment"
  | "Education"
  | "Other";

export type Category = ExpenseCategory | "Income";
export type BudgetCategory = ExpenseCategory | "Savings";

export type TransactionType = "income" | "expense";
export type PaymentMethod = "UPI" | "Credit Card" | "Debit Card" | "Net Banking" | "Cash" | "Auto Debit";
export type TransactionStatus = "completed" | "pending" | "failed";
export type DataSource = "demo" | "model";

/** Output of the expense categorization pipeline. */
export interface CategoryPrediction {
  predictedCategory: Category;
  /** 0–1 confidence returned by the classifier */
  confidence: number;
  needsReview: boolean;
  userOverridden?: boolean;
}

export type AnomalySeverity = "low" | "medium" | "high";
export type AnomalyReviewStatus = "new" | "reviewed" | "dismissed";

export interface ReviewEvent {
  at: string;
  action: "flagged" | AnomalyReviewStatus;
  note?: string;
}

/** Output of the Isolation Forest pipeline. `score` is a raw model score, not a probability. */
export interface AnomalyResult {
  flagged: boolean;
  score?: number;
  threshold?: number;
  severity: AnomalySeverity;
  reasons: string[];
  featureContributions?: { feature: string; value: string; note?: string }[];
  typicalAmount?: number;
  reviewStatus: AnomalyReviewStatus;
  reviewHistory: ReviewEvent[];
  detectedAt: string;
  source: DataSource;
}

export interface Transaction {
  id: string;
  /** Local datetime "yyyy-MM-ddTHH:mm" */
  date: string;
  merchant: string;
  description: string;
  category: Category;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  amount: number;
  status: TransactionStatus;
  prediction: CategoryPrediction;
  anomaly?: AnomalyResult;
  source: "demo" | "import" | "manual";
  recurring?: boolean;
  notes?: string;
}

// ---------- Statement import ----------
export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  type?: string;
}

export interface StatementParseResult {
  fileName: string;
  fileType: "csv" | "pdf";
  headers: string[];
  rows: string[][];
  suggestedMapping: ColumnMapping;
  source: DataSource;
}

export interface ImportCandidate {
  key: string;
  date: string;
  merchant: string;
  description: string;
  amount: number;
  type: TransactionType;
  prediction: CategoryPrediction;
  category: Category;
  duplicateOf?: string;
  include: boolean;
}

// ---------- Budgets ----------
export interface FinancialProfile {
  name: string;
  email: string;
  city?: string;
  monthlyIncome: number;
  age?: number;
  occupation?: string;
  savingsGoal?: number;
  financialGoal?: string;
  creditScore?: number;
  totalDebt?: number;
  focusCategory?: ExpenseCategory;
}

/** Model-ready features for the budget recommendation model. */
export interface BudgetModelFeatures {
  monthlyIncome: number;
  categorySpending: Partial<Record<ExpenseCategory, number>>;
  spendingToIncome: Partial<Record<ExpenseCategory, number>>;
  debtToIncome: number | null;
  expenseToIncome: number;
}

export interface BudgetRecommendation {
  category: BudgetCategory;
  actual: number;
  current: number;
  recommended: number;
  explanation: string;
}

export interface BudgetRecommendationResponse {
  recommendations: BudgetRecommendation[];
  generatedAt: string;
  source: DataSource;
}

export type RecommendationDecision = "pending" | "accepted" | "rejected";

// ---------- Forecast ----------
export interface DailySpendPoint {
  date: string; // yyyy-MM-dd
  amount: number;
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  lower?: number;
  upper?: number;
}

export interface ForecastRequest {
  history: DailySpendPoint[];
  horizonDays: number;
  categoryLast30?: Partial<Record<ExpenseCategory, number>>;
}

export interface ForecastResponse {
  status: "ready" | "insufficient_data";
  source: DataSource;
  generatedAt: string;
  horizonDays: number;
  minHistoryDays: number;
  history: { start: string; end: string; days: number };
  points: ForecastPoint[];
  categoryForecasts?: { category: ExpenseCategory; next30: number; last30: number }[];
  explanation: string;
  featuresUsed: string[];
}

// ---------- Anomaly ----------
export interface AnomalyRunSummary {
  analyzed: number;
  flagged: number;
  ranAt: string;
  source: DataSource;
}

// ---------- Wellness ----------
export interface WellnessInput {
  monthlyIncome: number | null;
  avgMonthlyExpenses: number | null;
  savingsRate: number | null;
  budgetAdherence: number | null;
  totalDebt: number | null;
  emergencyFund: number | null;
  goalProgress: number | null;
  spendingVolatility: number | null;
}

export type WellnessLevel = "Excellent" | "Good" | "Fair" | "Needs attention" | "Insufficient data";

export interface WellnessComponent {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  detail: string;
}

export interface WellnessScore {
  overall: number | null;
  level: WellnessLevel;
  components: WellnessComponent[];
  factors: { label: string; impact: "positive" | "negative"; detail: string }[];
  recommendations: { title: string; detail: string; impact: "high" | "medium" | "low" }[];
  source: DataSource;
}

// ---------- Goals ----------
export type GoalType = "emergency" | "gadget" | "education" | "travel" | "savings" | "other";

export interface FinancialGoal {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // yyyy-MM-dd
  completed: boolean;
  createdAt: string;
}

// ---------- Settings ----------
export interface AppSettings {
  currency: "INR" | "USD" | "EUR";
  theme: "light" | "dark";
  notifications: {
    anomalyAlerts: boolean;
    budgetAlerts: boolean;
    weeklySummary: boolean;
    goalReminders: boolean;
  };
  privacy: {
    persistLocally: boolean;
    shareAnonymized: boolean;
  };
  financial: {
    monthStartDay: number;
    lowConfidenceThreshold: number;
  };
}

export type PeriodKey = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "last_12_months";
