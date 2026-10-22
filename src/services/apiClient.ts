// Shared HTTP client for the FastAPI backend.

const env = import.meta.env as Record<string, string | undefined>;

export const API_CONFIG = {
  baseUrl: (env.VITE_API_BASE_URL ?? "").replace(/\/$/, ""),
  timeoutMs: 20000,
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  try {
    const res = await fetch(`${API_CONFIG.baseUrl}${path}`, {
      method: opts.method ?? "GET",
      headers: opts.formData ? undefined : { "Content-Type": "application/json" },
      body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: "include",
      signal: opts.signal ?? controller.signal,
    });
    const data = res.headers.get("content-type")?.includes("json")
      ? await res.json()
      : await res.text();
    if (!res.ok)
      throw new ApiError(
        typeof data === "object" && data && "detail" in data
          ? formatApiDetail((data as { detail: unknown }).detail)
          : res.statusText,
        res.status,
        data,
      );
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError")
      throw new ApiError("The request timed out. Please try again.", 0);
    throw new ApiError("Could not reach the server. Please try again.", 0);
  } finally {
    clearTimeout(timer);
  }
}

function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item && "msg" in item ? String(item.msg) : "Invalid input",
      )
      .join(" ");
  }
  return "The request could not be completed.";
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", formData }),
};

/** Centralised endpoint paths — adjust once the FastAPI routes are final. */
export const ENDPOINTS = {
  signup: "/api/auth/signup",
  login: "/api/auth/login",
  me: "/api/auth/me",
  logout: "/api/auth/logout",
  transactions: "/api/transactions",
  transaction: (id: string) => `/api/transactions/${id}`,
  uploadStatement: "/api/statements/upload",
  importTransactions: "/api/transactions/import",
  dashboardSummary: "/api/dashboard/summary",
  budgets: "/api/budgets",
  budget: (category: string) => `/api/budgets/${encodeURIComponent(category)}`,
  goals: "/api/goals",
  goal: (id: string) => `/api/goals/${id}`,
  preferences: "/api/preferences",
  categorize: "/api/ml/categorize",
  budgetRecommendations: "/api/ml/budget-recommendations",
  forecast: "/api/ml/forecast",
  anomalies: "/api/ml/anomalies",
  anomalyReview: (id: string) => `/api/ml/anomalies/${id}/review`,
  wellness: "/api/wellness/score",
};
