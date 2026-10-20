import { useDailyHistory } from "./useFinanceData";

/** Model output stays unavailable until the backend integration is implemented. */
export function useBudgetRecommendations() {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: async () => undefined,
  };
}

export function useForecast() {
  const history = useDailyHistory(180);
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    history,
    refetch: async () => undefined,
  };
}

export function useWellness() {
  return { data: undefined, isLoading: false, isFetching: false, refetch: async () => undefined };
}
