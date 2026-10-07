import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { api, ensureCsrf, setCsrfToken } from "../lib/api";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<{ emailVerificationRequired: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeUser(value: Record<string, unknown>): User {
  return {
    id: Number(value.id ?? value.Id),
    email: String(value.email ?? value.Email ?? ""),
    fullName: String(value.fullName ?? value.FullName ?? ""),
    phone: (value.phone ?? value.Phone ?? null) as string | null,
    addressLine: (value.addressLine ?? value.AddressLine ?? null) as string | null,
    avatarUrl: (value.avatarUrl ?? value.AvatarUrl ?? null) as string | null,
    emailVerified: Boolean(value.emailVerified ?? value.EmailVerifiedAt),
    emailVerifiedAt: (value.emailVerifiedAt ?? value.EmailVerifiedAt ?? null) as string | null,
    role: String(value.role ?? value.Role ?? "customer") as User["role"]
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const result = await api<Record<string, unknown>>("/api/auth/me");
      setUser(normalizeUser(result.data));
      if (import.meta.env.VITE_SECURITY_MODE !== "baseline") {
        await ensureCsrf();
      }
    } catch {
      setUser(null);
      setCsrfToken(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{
      user: Record<string, unknown>;
      csrfToken?: string | null;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setCsrfToken(result.data.csrfToken);
    const nextUser = normalizeUser(result.data.user);
    setUser(nextUser);
    return nextUser;
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const result = await api<{ emailVerificationRequired?: boolean }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ fullName, email, password })
    });
    return { emailVerificationRequired: Boolean(result.data.emailVerificationRequired) };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
