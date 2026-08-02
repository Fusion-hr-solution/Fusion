import type {
  AccessProfileAssignmentSummaryDto,
  EffectivePermissionGrantDto,
} from "@repo/api";

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
  /** Present only when the account has exactly one Active tenant membership. */
  tenantId: string | null;
  /** Membership that authorizes the customer tenant context. */
  tenantMembershipId: string | null;
  /** Modules enabled for that tenant. Empty without a customer context. */
  moduleEntitlements: string[];
  email: string;
  fullName: string;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  accessTokenExpiration: string; // ISO date string
  employeeId?: string | null;
  accessProfiles: AccessProfileAssignmentSummaryDto[];
  effectivePermissions: EffectivePermissionGrantDto[];
}

// ── Client-side auth state ───────────────────────────────────────────

export interface AuthUser {
  userId: string;
  /**
   * Customer tenant, derived solely from exactly one Active membership. Null for
   * a Platform Administrator, and null when membership cardinality is corrupted,
   * so the UI can never render a workspace the backend would refuse.
   */
  tenantId: string | null;
  tenantMembershipId: string | null;
  /** Modules enabled for the customer tenant. Empty without a customer context. */
  moduleEntitlements: string[];
  email: string;
  fullName: string;
  roles: string[];
  employeeId?: string | null;
  accessProfiles: AccessProfileAssignmentSummaryDto[];
  effectivePermissions: EffectivePermissionGrantDto[];
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
