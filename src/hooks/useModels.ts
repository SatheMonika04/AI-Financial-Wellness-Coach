import { useDailyHistory } from "./useFinanceData";
import type { BudgetRecommendationResponse, ForecastResponse, WellnessScore } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/AppStore";
import { forecastService } from "@/services/forecastService";
import { wellnessService } from "@/services/wellnessService";
import { budgetService } from "@/services/budgetService";

/** Model output stays unavailable until the backend integration is implemented. */
export function useBudgetRecommendations(): {
  data: BudgetRecommendationResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  isReady: boolean;
  refetch: () => Promise<BudgetRecommendationResponse | undefined>;
} {
  const { state } = useAppStore();
  const profile = state.profile;
  const isReady =
    state.hydrated &&
    profile.monthlyIncome > 0 &&
    profile.age != null &&
    !!profile.occupation &&
    profile.savingsGoal != null &&
    !!profile.financialGoal &&
    profile.creditScore != null &&
    profile.totalDebt != null;
  const query = useQuery({
    queryKey: ["budget-recommendations", state.transactions.length, profile],
    queryFn: () => budgetService.getRecommendations(),
    enabled: isReady,
    retry: false,
  });
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    isReady,
    refetch: async () => (await query.refetch()).data,
  };
}

export function useForecast(_horizonDays?: number): {
  data: ForecastResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  history: ReturnType<typeof useDailyHistory>;
  refetch: () => Promise<ForecastResponse | undefined>;
} {
  const history = useDailyHistory(180);
  const { state } = useAppStore();
  const horizonDays = _horizonDays ?? 30;
  const forecastTransactions = state.transactions.map((transaction) =>
    [
      transaction.id,
      transaction.date,
      transaction.amount,
      transaction.type,
      transaction.category,
    ].join(":"),
  );
  const query = useQuery({
    queryKey: ["forecast", horizonDays, forecastTransactions],
    queryFn: () => forecastService.getForecast({ horizonDays }),
    enabled: state.hydrated && state.transactions.length > 0,
    retry: false,
  });
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    history,
    refetch: async () => (await query.refetch()).data,
  };
}

export function useWellness(): {
  data: WellnessScore | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<WellnessScore | undefined>;
} {
  const { state } = useAppStore();
  const query = useQuery({
    queryKey: ["wellness-score", state.transactions.length],
    queryFn: () => wellnessService.getScore(),
    enabled: state.hydrated,
    retry: false,
  });
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: async () => (await query.refetch()).data,
  };
}
