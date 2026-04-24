/** DTOs aligned with Identity `PlatformOrganizations` API (camelCase JSON). */

export interface PlatformOrganizationStatsDto {
  totalOrganizations: number;
  invitedPending: number;
  activeOrganizations: number;
}

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
  createdAt: string;
  updatedAt: string | null;
  internalNotes: string | null;
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
  stats: PlatformOrganizationStatsDto;
}

export interface CreatePlatformOrganizationRequest {
  name: string;
  firstAdminEmail: string;
  firstAdminFirstName?: string | null;
  firstAdminLastName?: string | null;
  internalNotes?: string | null;
}

export interface UpdatePlatformOrganizationRequest {
  name?: string | null;
  internalNotes?: string | null;
}

export interface PlatformOrganizationListQueryParams {
  skip: number;
  take: number;
  search?: string | null;
  orderBy?: string | null;
  orderDirection?: string | null;
  filterByStatus?: readonly string[] | null;
}

function normalizePlatformOrganizationListQueryParams(
  params: PlatformOrganizationListQueryParams
) {
  return {
    skip: params.skip,
    take: params.take,
    search: params.search?.trim() || undefined,
    orderBy: params.orderBy || "createdAt",
    orderDirection: params.orderDirection || "desc",
    filterByStatus:
      params.filterByStatus && params.filterByStatus.length > 0
        ? [...params.filterByStatus].sort()
        : undefined,
  };
}

export const platformOrganizationsPaths = {
  list: () => "/identity/platform-admin/organizations",
  detail: (tenantId: string) =>
    `/identity/platform-admin/organizations/${tenantId}`,
  create: () => "/identity/platform-admin/organizations",
  update: (tenantId: string) =>
    `/identity/platform-admin/organizations/${tenantId}`,
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

export const platformOrganizationsQueryKeys = {
  all: () => ["platformOrganizations"] as const,
  lists: () => [...platformOrganizationsQueryKeys.all(), "list"] as const,
  list: (params: PlatformOrganizationListQueryParams) =>
    [
      ...platformOrganizationsQueryKeys.lists(),
      normalizePlatformOrganizationListQueryParams(params),
    ] as const,
  details: () => [...platformOrganizationsQueryKeys.all(), "detail"] as const,
  detail: (tenantId: string) =>
    [...platformOrganizationsQueryKeys.details(), tenantId] as const,
} as const;
