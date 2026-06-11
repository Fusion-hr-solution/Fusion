"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError } from "@repo/api";
import type { AuthState, AuthUser, LoginRequest, RegisterRequest } from "./types";
import {
  AUTH_STORAGE_EVENT,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  refreshToken as apiRefresh,
  persistAuth,
  loadAuth,
  clearAuth,
} from "./auth-service";

// ── Context types ────────────────────────────────────────────────────

export interface AuthContextValue extends AuthState {
  login: (req: LoginRequest) => Promise<string[] | null>;
  register: (req: RegisterRequest) => Promise<string[] | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyStoredAuth = useCallback((stored: ReturnType<typeof loadAuth>) => {
    if (!stored) {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      return;
    }

    setUser(stored.user);
    setAccessToken(stored.accessToken);
    setRefreshToken(stored.refreshToken);
  }, []);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadAuth();
    if (stored) {
      const expiry = new Date(stored.accessTokenExpiration);
      if (expiry > new Date()) {
        applyStoredAuth(stored);
        setIsLoading(false);
      } else if (stored.refreshToken) {
        apiRefresh({ refreshToken: stored.refreshToken })
          .then((d) => {
            const nextStored = {
              accessToken: d.accessToken,
              refreshToken: d.refreshToken,
              accessTokenExpiration: d.accessTokenExpiration,
              user: {
                userId: d.userId,
                email: d.email,
                fullName: d.fullName,
                roles: d.roles,
                employeeId: d.employeeId ?? null,
              },
            };

            applyStoredAuth(nextStored);
            persistAuth(nextStored);
          })
          .catch(() => {
            clearAuth();
            applyStoredAuth(null);
          })
          .finally(() => setIsLoading(false));
      } else {
        clearAuth();
        applyStoredAuth(null);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [applyStoredAuth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromStorage = () => {
      applyStoredAuth(loadAuth());
    };

    window.addEventListener(AUTH_STORAGE_EVENT, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(AUTH_STORAGE_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [applyStoredAuth]);

  const login = useCallback(
    async (req: LoginRequest): Promise<string[] | null> => {
      try {
        const d = await apiLogin(req);
        const authUser: AuthUser = {
          userId: d.userId,
          email: d.email,
          fullName: d.fullName,
          roles: d.roles,
          employeeId: d.employeeId ?? null,
        };
        setUser(authUser);
        setAccessToken(d.accessToken);
        setRefreshToken(d.refreshToken);
        persistAuth({
          accessToken: d.accessToken,
          refreshToken: d.refreshToken,
          accessTokenExpiration: d.accessTokenExpiration,
          user: authUser,
        });
        return null;
      } catch (err) {
        if (err instanceof ApiError) {
          return err.errors.length > 0 ? err.errors : ["Login failed. Please try again."];
        }
        return ["Login failed. Please try again."];
      }
    },
    [],
  );

  const register = useCallback(
    async (req: RegisterRequest): Promise<string[] | null> => {
      try {
        const d = await apiRegister(req);
        const authUser: AuthUser = {
          userId: d.userId,
          email: d.email,
          fullName: d.fullName,
          roles: d.roles,
          employeeId: d.employeeId ?? null,
        };
        setUser(authUser);
        setAccessToken(d.accessToken);
        setRefreshToken(d.refreshToken);
        persistAuth({
          accessToken: d.accessToken,
          refreshToken: d.refreshToken,
          accessTokenExpiration: d.accessTokenExpiration,
          user: authUser,
        });
        return null;
      } catch (err) {
        if (err instanceof ApiError) {
          return err.errors.length > 0 ? err.errors : ["Registration failed. Please try again."];
        }
        return ["Registration failed. Please try again."];
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    if (accessToken) {
      try {
        await apiLogout(accessToken);
      } catch {
        // best-effort server logout
      }
    }
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    clearAuth();
  }, [accessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken: refreshTokenValue,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, accessToken, refreshTokenValue, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
