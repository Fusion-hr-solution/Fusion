import type {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  AuthResponse,
  ApiResponse,
  StoredAuth,
} from "./types";

// ── API base URL ─────────────────────────────────────────────────────

const API_BASE_URL =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__NEXT_PUBLIC_API_URL
    ? String((window as unknown as Record<string, unknown>).__NEXT_PUBLIC_API_URL)
    : "http://localhost:5000";

const ENDPOINTS = {
  login: `${API_BASE_URL}/api/identity/auth/login`,
  register: `${API_BASE_URL}/api/identity/auth/register`,
  refresh: `${API_BASE_URL}/api/identity/auth/refresh`,
  logout: `${API_BASE_URL}/api/identity/auth/logout`,
} as const;

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

  const json: ApiResponse<T> = await res.json();
  return json;
}

// ── Public API ───────────────────────────────────────────────────────

export async function login(
  request: LoginRequest,
): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>(ENDPOINTS.login, request);
}

export async function register(
  request: RegisterRequest,
): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>(ENDPOINTS.register, request);
}

export async function refreshToken(
  request: RefreshTokenRequest,
): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>(ENDPOINTS.refresh, request);
}

export async function logout(accessToken: string): Promise<void> {
  await post(ENDPOINTS.logout, {}, accessToken);
}

// ── Token storage (localStorage + cookie) ────────────────────────────

const STORAGE_KEY = "ey_hr_auth";

export function persistAuth(auth: StoredAuth): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
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
    document.cookie = "ey_hr_authenticated=; path=/; max-age=0; SameSite=Lax";
  }
}
