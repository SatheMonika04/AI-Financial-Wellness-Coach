// HTTP client boundary for a future backend integration. No request runs until a service is used.

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

type RequestOptions = { method?: string; body?: unknown; formData?: FormData; signal?: AbortSignal };

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  try {
    const res = await fetch(`${API_CONFIG.baseUrl}${path}`, {
      method: opts.method ?? "GET",
      headers: opts.formData ? undefined : { "Content-Type": "application/json" },
      body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal ?? controller.signal,
    });
    const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
    if (!res.ok) throw new ApiError(typeof data === "object" && data && "detail" in data ? String((data as { detail: unknown }).detail) : res.statusText, res.status, data);
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", formData }),
};

/** Centralised endpoint paths — adjust once the FastAPI routes are final. */
export const ENDPOINTS = {
  transactions: "/transactions",
  transaction: (id: string) => `/transactions/${id}`,
  uploadStatement: "/statements/upload",
  importTransactions: "/transactions/import",
  categorize: "/ml/categorize",
  budgetRecommendations: "/ml/budget-recommendations",
  forecast: "/ml/forecast",
  anomalies: "/ml/anomalies",
  anomalyReview: (id: string) => `/ml/anomalies/${id}/review`,
  wellness: "/wellness/score",
  goals: "/goals",
  goal: (id: string) => `/goals/${id}`,
};

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
