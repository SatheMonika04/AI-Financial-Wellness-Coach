import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/AppStore";
import { budgetService } from "@/services/budgetService";
import { forecastService } from "@/services/forecastService";
import { wellnessService } from "@/services/wellnessService";
import { useDailyHistory, useModelFeatures, wellnessInputFor } from "./useFinanceData";
import { byCategory, inRange } from "@/lib/analytics";
import { subDays } from "date-fns";
import { TODAY } from "@/lib/period";
import { useMemo } from "react";
import type { ExpenseCategory } from "@/types";

export function useBudgetRecommendations() {
  const { state } = useAppStore();
  const features = useModelFeatures();
  return useQuery({
    queryKey: ["budget-recommendations", state.profile, features, state.budgets],
    queryFn: () => budgetService.getRecommendations({ profile: state.profile, features, currentBudgets: state.budgets }),
    enabled: state.hydrated,
    placeholderData: keepPreviousData,
  });
}

export function useForecast(horizonDays = 30) {
  const { state } = useAppStore();
  const history = useDailyHistory(180);
  const categoryLast30 = useMemo(() => {
    const out: Partial<Record<ExpenseCategory, number>> = {};
    byCategory(inRange(state.transactions, subDays(TODAY, 29), TODAY)).forEach((c) => (out[c.category] = c.amount));
    return out;
  }, [state.transactions]);
  const sig = history.reduce((s, p) => s + p.amount, 0);
  const query = useQuery({
    queryKey: ["forecast", horizonDays, history.length, sig],
    queryFn: () => forecastService.getForecast({ history, horizonDays, categoryLast30 }),
    enabled: state.hydrated,
  });
  return { ...query, history };
}

export function useWellness() {
  const { state } = useAppStore();
  const input = useMemo(() => wellnessInputFor(state, 1), [state]);
  const query = useQuery({
    queryKey: ["wellness", input],
    queryFn: () => wellnessService.getScore(input),
    enabled: state.hydrated,
    placeholderData: keepPreviousData,
  });
  return { ...query, input };
}
