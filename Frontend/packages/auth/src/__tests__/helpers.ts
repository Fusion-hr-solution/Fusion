import type { AuthResponse, ApiResponse, StoredAuth, AuthUser } from "../types";

// ── Factory helpers ──────────────────────────────────────────────────

export function makeAuthResponse(
  overrides: Partial<AuthResponse> = {},
): AuthResponse {
  return {
    userId: "user-1",
    email: "john@example.com",
    fullName: "John Doe",
    roles: ["Employee"],
    accessToken: "access-token-123",
    refreshToken: "refresh-token-456",
    accessTokenExpiration: new Date(
      Date.now() + 60 * 60 * 1000,
    ).toISOString(),
    ...overrides,
  };
}

export function makeSuccessResponse<T>(data: T): ApiResponse<T> {
  return { data, errors: [], isSuccess: true };
}

export function makeErrorResponse<T>(
  errors: string[] = ["Something went wrong"],
): ApiResponse<T> {
  return { data: null, errors, isSuccess: false };
}

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: "user-1",
    email: "john@example.com",
    fullName: "John Doe",
    roles: ["Employee"],
    ...overrides,
  };
}

export function makeStoredAuth(overrides: Partial<StoredAuth> = {}): StoredAuth {
  return {
    accessToken: "access-token-123",
    refreshToken: "refresh-token-456",
    accessTokenExpiration: new Date(
      Date.now() + 60 * 60 * 1000,
    ).toISOString(),
    user: makeAuthUser(),
    ...overrides,
  };
}
