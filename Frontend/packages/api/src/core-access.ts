export type PermissionScope =
  | "None"
  | "Self"
  | "DirectReports"
  | "OrgUnit"
  | "Tenant"
  | "Module"
  | "Platform";

export interface CorePermissionCatalogItemDto {
  permissionKey: string;
  label: string;
  group: string;
  helperText: string | null;
  allowedScopes: PermissionScope[];
}

export interface EffectivePermissionGrantDto {
  permissionKey: string;
  scope: PermissionScope;
  label: string;
  group: string;
  helperText: string | null;
  allowedScopes: PermissionScope[];
}

export interface AccessProfileAssignmentSummaryDto {
  id: string;
  name: string;
  type: "SystemSeeded" | "Custom";
  isSystemProtected: boolean;
}

export interface AccessProfileSummaryDto
  extends AccessProfileAssignmentSummaryDto {
  description: string | null;
  assignedUserCount: number;
  createdAt: string;
  updatedAt: string | null;
  version: number;
  grants: EffectivePermissionGrantDto[];
}

export interface UserAccessAssignmentDto {
  userId: string;
  employeeId: string | null;
  email: string;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  accessProfiles: AccessProfileAssignmentSummaryDto[];
}

export interface CurrentUserAccessDto {
  tenantId: string;
  accessProfiles: AccessProfileAssignmentSummaryDto[];
  effectivePermissions: EffectivePermissionGrantDto[];
}

export interface AccessAuditEventDto {
  id: string;
  occurredAt: string;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  beforeJson: string | null;
  afterJson: string | null;
  correlationId: string | null;
}

export interface AccessProfileGrantInputDto {
  permissionKey: string;
  scope: PermissionScope;
}

export interface CreateAccessProfileRequest {
  name: string;
  description?: string | null;
  grants: AccessProfileGrantInputDto[];
}

export interface UpdateAccessProfileRequest {
  name: string;
  description?: string | null;
  grants: AccessProfileGrantInputDto[];
}

export interface SetUserAccessProfilesRequest {
  accessProfileIds: string[];
}

export interface BulkSetUserAccessProfilesRequest {
  userIds: string[];
  accessProfileIds: string[];
}

export const coreAccessPaths = {
  me: () => "/identity/core-access/me",
  catalog: () => "/identity/core-access/catalog",
  profiles: () => "/identity/core-access/profiles",
  profile: (profileId: string) => `/identity/core-access/profiles/${profileId}`,
  assignments: () => "/identity/core-access/assignments",
  assignment: (userId: string) => `/identity/core-access/assignments/${userId}`,
  audit: () => "/identity/core-access/audit",
} as const;

export const coreAccessQueryKeys = {
  all: () => ["core-access"] as const,
  me: () => [...coreAccessQueryKeys.all(), "me"] as const,
  catalog: () => [...coreAccessQueryKeys.all(), "catalog"] as const,
  profiles: () => [...coreAccessQueryKeys.all(), "profiles"] as const,
  profile: (profileId: string) =>
    [...coreAccessQueryKeys.profiles(), profileId] as const,
  assignments: () => [...coreAccessQueryKeys.all(), "assignments"] as const,
  audit: () => [...coreAccessQueryKeys.all(), "audit"] as const,
} as const;
