import { ApiError } from "@repo/api";
import type { AuthResponse, StoredAuth, AuthUser } from "../types";

// ── Factory helpers ──────────────────────────────────────────────────

export function makeAuthResponse(
  overrides: Partial<AuthResponse> = {}
): AuthResponse {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    employeeId: "employee-1",
    email: "john@example.com",
    fullName: "John Doe",
    roles: ["Employee"],
    accessProfiles: [],
    effectivePermissions: [],
    accessToken: "access-token-123",
    refreshToken: "refresh-token-456",
    accessTokenExpiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  500: "Internal Server Error",
};

export function makeApiError(
  errors: string[] = ["Something went wrong"],
  status = 400
): ApiError {
  return new ApiError(status, STATUS_TEXT[status] ?? "Error", errors, null);
}

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    employeeId: "employee-1",
    email: "john@example.com",
    fullName: "John Doe",
    roles: ["Employee"],
    accessProfiles: [],
    effectivePermissions: [],
    ...overrides,
  };
}

export function makeStoredAuth(
  overrides: Partial<StoredAuth> = {}
): StoredAuth {
  return {
    accessToken: "access-token-123",
    refreshToken: "refresh-token-456",
    accessTokenExpiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: makeAuthUser(),
    ...overrides,
  };
}
