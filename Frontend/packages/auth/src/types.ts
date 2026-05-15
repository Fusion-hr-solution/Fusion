// ── Request DTOs (matches backend models) ───────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
  hireDate: string; // ISO date string
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ── Response DTOs ────────────────────────────────────────────────────

export interface AuthResponse {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  accessTokenExpiration: string; // ISO date string
  employeeId?: string | null;
}

// ── Client-side auth state ───────────────────────────────────────────

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  employeeId?: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiration: string;
  user: AuthUser;
}
