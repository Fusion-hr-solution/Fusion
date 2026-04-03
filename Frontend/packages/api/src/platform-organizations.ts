/** DTOs aligned with Identity `PlatformOrganizations` API (camelCase JSON). */

export interface PlatformOrganizationInviteStatusDto {
  inviteId: string | null;
  status: string;
  email: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  inviteLink: string | null;
}

export interface PlatformOrganizationSummaryDto {
  id: string;
  name: string;
  operationalStatus: string;
  firstAdminStatus: string;
  activeUserCount: number;
  pendingInviteCount: number;
  createdAt: string;
  lastActivityAt: string | null;
  isActive: boolean;
  isArchived: boolean;
}

export interface PlatformOrganizationDetailDto {
  id: string;
  name: string;
  operationalStatus: string;
  firstAdminStatus: string;
  createdAt: string;
  updatedAt: string | null;
  internalNotes: string | null;
  planTier: string | null;
  activeUserCount: number;
  pendingInviteCount: number;
  lastActivityAt: string | null;
  isActive: boolean;
  isArchived: boolean;
  primaryAdminEmail: string | null;
  firstAdminInvite: PlatformOrganizationInviteStatusDto;
}

export interface PlatformOrganizationCreatedDto {
  organization: PlatformOrganizationDetailDto;
  inviteLink: string;
}

export interface PlatformOrganizationPagedListDto {
  items: PlatformOrganizationSummaryDto[];
  totalCount: number;
}

export interface CreatePlatformOrganizationRequest {
  name: string;
  firstAdminEmail: string;
  firstAdminFirstName?: string | null;
  firstAdminLastName?: string | null;
  planTier?: string | null;
  internalNotes?: string | null;
}

export const platformOrganizationsPaths = {
  list: () => "/identity/platform-admin/organizations",
  detail: (tenantId: string) =>
    `/identity/platform-admin/organizations/${tenantId}`,
  create: () => "/identity/platform-admin/organizations",
  suspend: (tenantId: string) =>
    `/identity/platform-admin/organizations/${tenantId}/suspend`,
  reactivate: (tenantId: string) =>
    `/identity/platform-admin/organizations/${tenantId}/reactivate`,
  archive: (tenantId: string) =>
    `/identity/platform-admin/organizations/${tenantId}/archive`,
  resendFirstAdmin: (tenantId: string) =>
    `/identity/platform-admin/organizations/${tenantId}/first-admin-invite/resend`,
  revokeFirstAdmin: (tenantId: string) =>
    `/identity/platform-admin/organizations/${tenantId}/first-admin-invite/revoke`,
} as const;
