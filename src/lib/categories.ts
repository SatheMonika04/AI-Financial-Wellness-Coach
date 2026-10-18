import {
  BookOpen,
  Car,
  Clapperboard,
  HeartPulse,
  Home,
  type LucideIcon,
  PiggyBank,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Wallet,
  Zap,
  Shapes,
} from "lucide-react";
import type { BudgetCategory, Category, ExpenseCategory, PaymentMethod } from "@/types";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Housing",
  "Groceries",
  "Transportation",
  "Dining",
  "Shopping",
  "Healthcare",
  "Utilities",
  "Entertainment",
  "Education",
  "Other",
];

export const ALL_CATEGORIES: Category[] = ["Income", ...EXPENSE_CATEGORIES];
export const BUDGET_CATEGORIES: BudgetCategory[] = [...EXPENSE_CATEGORIES, "Savings"];

export const PAYMENT_METHODS: PaymentMethod[] = [
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Cash",
  "Auto Debit",
];

export const CATEGORY_META: Record<Category | "Savings", { color: string; icon: LucideIcon }> = {
  Income: { color: "var(--success)", icon: Wallet },
  Housing: { color: "var(--chart-1)", icon: Home },
  Groceries: { color: "var(--chart-2)", icon: ShoppingCart },
  Transportation: { color: "var(--chart-6)", icon: Car },
  Dining: { color: "var(--chart-4)", icon: Utensils },
  Shopping: { color: "var(--chart-3)", icon: ShoppingBag },
  Healthcare: { color: "var(--chart-5)", icon: HeartPulse },
  Utilities: { color: "var(--chart-8)", icon: Zap },
  Entertainment: { color: "var(--chart-7)", icon: Clapperboard },
  Education: { color: "var(--chart-9)", icon: BookOpen },
  Other: { color: "var(--chart-10)", icon: Shapes },
  Savings: { color: "var(--success)", icon: PiggyBank },
};
