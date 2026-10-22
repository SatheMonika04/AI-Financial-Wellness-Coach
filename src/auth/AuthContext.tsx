import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient, ENDPOINTS } from "@/services/apiClient";

export type AuthUser = { id: number; name: string; email: string; created_at: string };
type AuthStatus = "loading" | "authenticated" | "unauthenticated";
type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
};
const Context = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const refresh = async () => {
    try {
      const current = await apiClient.get<AuthUser>(ENDPOINTS.me);
      setUser(current);
      setStatus("authenticated");
      return current;
    } catch {
      setUser(null);
      setStatus("unauthenticated");
      return null;
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      refresh,
      login: async (email, password) => {
        const authenticated = await apiClient.post<AuthUser>(ENDPOINTS.login, { email, password });
        setUser(authenticated);
        setStatus("authenticated");
        return authenticated;
      },
      logout: async () => {
        try {
          await apiClient.post(ENDPOINTS.logout);
        } finally {
          setUser(null);
          setStatus("unauthenticated");
        }
      },
    }),
    [status, user],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
