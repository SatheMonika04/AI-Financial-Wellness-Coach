// Single place for browser persistence. Swap for backend persistence later.
const PREFIX = "moneymind:v1:";

export const storage = {
  get<T>(key: string): T | undefined {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  },
  set(key: string, value: unknown) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* quota or privacy mode — ignore */
    }
  },
  clearAll() {
    if (typeof window === "undefined") return;
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => window.localStorage.removeItem(k));
  },
};
