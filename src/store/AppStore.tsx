import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { format } from "date-fns";
import type {
  AnomalyReviewStatus,
  AppSettings,
  BudgetCategory,
  FinancialGoal,
  FinancialProfile,
  PeriodKey,
  RecommendationDecision,
  Transaction,
} from "@/types";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { storage } from "@/lib/storage";
import { TODAY } from "@/lib/period";

export interface AppState {
  hydrated: boolean;
  transactions: Transaction[];
  budgets: Record<BudgetCategory, number>;
  goals: FinancialGoal[];
  profile: FinancialProfile;
  settings: AppSettings;
  period: PeriodKey;
  decisions: Partial<Record<BudgetCategory, RecommendationDecision>>;
  readNotifications: string[];
}

type Persisted = Omit<AppState, "hydrated">;

type Action =
  | { type: "hydrate"; payload: Partial<Persisted> }
  | { type: "updateTransaction"; id: string; patch: Partial<Transaction> }
  | { type: "addTransactions"; items: Transaction[] }
  | { type: "reviewAnomaly"; id: string; status: AnomalyReviewStatus; note?: string }
  | { type: "setBudget"; category: BudgetCategory; amount: number }
  | { type: "setDecision"; category: BudgetCategory; decision: RecommendationDecision }
  | { type: "upsertGoal"; goal: FinancialGoal }
  | { type: "removeGoal"; id: string }
  | { type: "setProfile"; profile: FinancialProfile }
  | { type: "setSettings"; settings: AppSettings }
  | { type: "setPeriod"; period: PeriodKey }
  | { type: "markRead"; ids: string[] }
  | { type: "reset" };

function createInitial(): AppState {
  return {
    hydrated: false,
    transactions: [],
    budgets: {} as Record<BudgetCategory, number>,
    goals: [],
    profile: { name: "", email: "", monthlyIncome: 0 },
    settings: DEFAULT_SETTINGS,
    period: "this_month",
    decisions: {},
    readNotifications: [],
  };
}

function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case "hydrate":
      return { ...state, ...a.payload, hydrated: true };
    case "updateTransaction":
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t)),
      };
    case "addTransactions":
      return {
        ...state,
        transactions: [...a.items, ...state.transactions].sort((x, y) =>
          x.date < y.date ? 1 : -1,
        ),
      };
    case "reviewAnomaly":
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === a.id && t.anomaly
            ? {
                ...t,
                anomaly: {
                  ...t.anomaly,
                  reviewStatus: a.status,
                  reviewHistory: [
                    ...t.anomaly.reviewHistory,
                    { at: format(TODAY, "yyyy-MM-dd'T'HH:mm"), action: a.status, note: a.note },
                  ],
                },
              }
            : t,
        ),
      };
    case "setBudget":
      return { ...state, budgets: { ...state.budgets, [a.category]: a.amount } };
    case "setDecision":
      return { ...state, decisions: { ...state.decisions, [a.category]: a.decision } };
    case "upsertGoal": {
      const exists = state.goals.some((g) => g.id === a.goal.id);
      return {
        ...state,
        goals: exists
          ? state.goals.map((g) => (g.id === a.goal.id ? a.goal : g))
          : [a.goal, ...state.goals],
      };
    }
    case "removeGoal":
      return { ...state, goals: state.goals.filter((g) => g.id !== a.id) };
    case "setProfile":
      return { ...state, profile: a.profile };
    case "setSettings":
      return { ...state, settings: a.settings };
    case "setPeriod":
      return { ...state, period: a.period };
    case "markRead":
      return { ...state, readNotifications: [...new Set([...state.readNotifications, ...a.ids])] };
    case "reset":
      return { ...createInitial(), hydrated: true, settings: state.settings };
  }
}

// Ignore browser data persisted by the old demo version.
const KEY = "state-v2";

function useActions(dispatch: React.Dispatch<Action>) {
  return useMemo(
    () => ({
      updateTransaction: (id: string, patch: Partial<Transaction>) =>
        dispatch({ type: "updateTransaction", id, patch }),
      addTransactions: (items: Transaction[]) => dispatch({ type: "addTransactions", items }),
      reviewAnomaly: (id: string, status: AnomalyReviewStatus, note?: string) =>
        dispatch({ type: "reviewAnomaly", id, status, note }),
      setBudget: (category: BudgetCategory, amount: number) =>
        dispatch({ type: "setBudget", category, amount }),
      setDecision: (category: BudgetCategory, decision: RecommendationDecision) =>
        dispatch({ type: "setDecision", category, decision }),
      upsertGoal: (goal: FinancialGoal) => dispatch({ type: "upsertGoal", goal }),
      removeGoal: (id: string) => dispatch({ type: "removeGoal", id }),
      setProfile: (profile: FinancialProfile) => dispatch({ type: "setProfile", profile }),
      setSettings: (settings: AppSettings) => dispatch({ type: "setSettings", settings }),
      setPeriod: (period: PeriodKey) => dispatch({ type: "setPeriod", period }),
      markRead: (ids: string[]) => dispatch({ type: "markRead", ids }),
      clearData: () => dispatch({ type: "reset" }),
    }),
    [dispatch],
  );
}

type Ctx = { state: AppState; actions: ReturnType<typeof useActions> };
const AppStoreContext = createContext<Ctx | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitial());
  const actions = useActions(dispatch);

  useEffect(() => {
    const saved = storage.get<Partial<Persisted>>(KEY);
    dispatch({ type: "hydrate", payload: saved ?? {} });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const { hydrated: _h, ...rest } = state;
    if (state.settings.privacy.persistLocally) storage.set(KEY, rest);
    else storage.clearAll();
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
  }, [state.settings.theme]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}
