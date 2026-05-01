import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { IUser } from "@shared/schema";

interface AuthContextType {
  user: IUser | null;
  token: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setUser(data.data.user || data.data);
            } else {
              localStorage.removeItem("token");
              setToken(null);
            }
          } else {
            localStorage.removeItem("token");
            setToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    const data = await res.json();
    if (data.success) {
      const { token: newToken, user: newUser } = data.data;
      localStorage.setItem("token", newToken);
      setToken(newToken);
      setUser(newUser);
    } else {
      throw new Error(data.error || "Login failed");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // ignore
    }
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAdmin, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
