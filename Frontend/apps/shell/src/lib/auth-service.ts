import { API_ENDPOINTS } from "@/config/api";
import type {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  AuthResponse,
  ApiResponse,
} from "@/types/auth";

// ── Helpers ──────────────────────────────────────────────────────────

async function post<T>(
  url: string,
  body: unknown,
  accessToken?: string | null,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  // Parse the response body regardless of status
  const json: ApiResponse<T> = await res.json();
  return json;
}

// ── Public API ───────────────────────────────────────────────────────

export async function login(
  request: LoginRequest,
): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>(API_ENDPOINTS.login, request);
}

export async function register(
  request: RegisterRequest,
): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>(API_ENDPOINTS.register, request);
}

export async function refreshToken(
  request: RefreshTokenRequest,
): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>(API_ENDPOINTS.refresh, request);
}

export async function logout(accessToken: string): Promise<void> {
  await post(API_ENDPOINTS.logout, {}, accessToken);
}

// ── Token storage (localStorage) ─────────────────────────────────────

const STORAGE_KEY = "ey_hr_auth";

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiration: string;
  user: {
    userId: string;
    email: string;
    fullName: string;
    roles: string[];
  };
}


export function persistAuth(auth: StoredAuth): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    // Set a cookie so Next.js middleware can gate protected routes
    document.cookie = `ey_hr_authenticated=true; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  }
}

export function loadAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    // Remove the auth cookie
    document.cookie = "ey_hr_authenticated=; path=/; max-age=0; SameSite=Lax";
  }
}
