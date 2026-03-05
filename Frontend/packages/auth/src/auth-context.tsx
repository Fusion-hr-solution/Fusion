"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthState, AuthUser, LoginRequest, RegisterRequest } from "./types";
import {
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

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadAuth();
    if (stored) {
      const expiry = new Date(stored.accessTokenExpiration);
      if (expiry > new Date()) {
        setUser(stored.user);
        setAccessToken(stored.accessToken);
        setRefreshToken(stored.refreshToken);
      } else if (stored.refreshToken) {
        apiRefresh({ refreshToken: stored.refreshToken })
          .then((res) => {
            if (res.isSuccess && res.data) {
              const d = res.data;
              setUser({
                userId: d.userId,
                email: d.email,
                fullName: d.fullName,
                roles: d.roles,
              });
              setAccessToken(d.accessToken);
              setRefreshToken(d.refreshToken);
              persistAuth({
                accessToken: d.accessToken,
                refreshToken: d.refreshToken,
                accessTokenExpiration: d.accessTokenExpiration,
                user: {
                  userId: d.userId,
                  email: d.email,
                  fullName: d.fullName,
                  roles: d.roles,
                },
              });
            } else {
              clearAuth();
            }
          })
          .catch(() => clearAuth());
      } else {
        clearAuth();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (req: LoginRequest): Promise<string[] | null> => {
      const res = await apiLogin(req);
      if (res.isSuccess && res.data) {
        const d = res.data;
        const authUser: AuthUser = {
          userId: d.userId,
          email: d.email,
          fullName: d.fullName,
          roles: d.roles,
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
      }
      return res.errors.length > 0
        ? res.errors
        : ["Login failed. Please try again."];
    },
    [],
  );

  const register = useCallback(
    async (req: RegisterRequest): Promise<string[] | null> => {
      const res = await apiRegister(req);
      if (res.isSuccess && res.data) {
        const d = res.data;
        const authUser: AuthUser = {
          userId: d.userId,
          email: d.email,
          fullName: d.fullName,
          roles: d.roles,
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
      }
      return res.errors.length > 0
        ? res.errors
        : ["Registration failed. Please try again."];
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
