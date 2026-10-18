import {
  AlertTriangle,
  BarChart3,
  Goal,
  HeartPulse,
  LayoutDashboard,
  type LucideIcon,
  ReceiptText,
  Settings,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";

export type NavPath =
  | "/"
  | "/transactions"
  | "/upload"
  | "/analytics"
  | "/budgets"
  | "/forecast"
  | "/anomalies"
  | "/wellness"
  | "/goals"
  | "/settings";

export interface NavItem {
  title: string;
  url: NavPath;
  icon: LucideIcon;
  group: "Money" | "AI Insights" | "Plan" | "Account";
  showPeriod?: boolean;
  ai?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Overview", url: "/", icon: LayoutDashboard, group: "Money", showPeriod: true },
  { title: "Transactions", url: "/transactions", icon: ReceiptText, group: "Money" },
  { title: "Upload Statements", url: "/upload", icon: Upload, group: "Money" },
  { title: "Spending Analytics", url: "/analytics", icon: BarChart3, group: "Money", showPeriod: true },
  { title: "Smart Budgets", url: "/budgets", icon: Wallet, group: "AI Insights", ai: true },
  { title: "Spending Forecast", url: "/forecast", icon: TrendingUp, group: "AI Insights", ai: true },
  { title: "Unusual Transactions", url: "/anomalies", icon: AlertTriangle, group: "AI Insights", ai: true },
  { title: "Financial Wellness", url: "/wellness", icon: HeartPulse, group: "Plan" },
  { title: "Financial Goals", url: "/goals", icon: Goal, group: "Plan" },
  { title: "Settings", url: "/settings", icon: Settings, group: "Account" },
];
