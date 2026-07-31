export type EmployeeRosterStatus = "Active" | "Inactive";

export type EmployeeReadinessFilter =
  | "Ready"
  | "NeedsAttention"
  | "MissingRequiredField"
  | "MissingOrgUnit"
  | "ReportingIssue"
  | "NoManagerAssigned"
  | "ManagerInactive"
  | "ManagerMissing"
  | "DeactivationBlocked";

export type EmployeeAccessFilter =
  | "NotInvited"
  | "Invited"
  | "AccountActive"
  | "NeedsReview";

export type EmployeeReadinessSeverity = "Attention" | "Blocker";

export type EmployeeReadinessFixTargetKind =
  | "ProfileIdentity"
  | "ProfileEmployment"
  | "ProfileOrganization"
  | "ReportingRelationships"
  | "ProfileStatus"
  | "ImportHistoryDetail";

export interface EmployeeReadinessFixTargetDto {
  kind: EmployeeReadinessFixTargetKind;
  employeeId?: string | null;
  employeeKey?: string | null;
  importHistoryId?: string | null;
  fieldKey?: string | null;
}

export interface EmployeeReadinessIssueDto {
  code:
    | "MissingRequiredField"
    | "MissingOrgUnit"
    | "NoManagerAssigned"
    | "ManagerInactive"
    | "ManagerMissing"
    | "DeactivationBlocked";
  label: string;
  severity: EmployeeReadinessSeverity;
  fieldKey: string | null;
  fixTarget: EmployeeReadinessFixTargetDto;
}

export interface EmployeeReadinessSummaryDto {
  employeeStateIssueCount: number;
  blockingIssueCount: number;
  employeeStateIssues: EmployeeReadinessIssueDto[];
  blockingIssues: EmployeeReadinessIssueDto[];
  hasEmployeeStateIssues: boolean;
  hasBlockingIssues: boolean;
}

export interface WorkforceReadinessIssueCountsDto {
  missingRequiredFields: number;
  missingOrgUnit: number;
  noManagerAssigned: number;
  managerInactive: number;
  managerMissing: number;
  deactivationBlocked: number;
  unresolvedImportIssues: number;
}

export interface WorkforceReadinessSummaryDto {
  activeEmployeeCount: number;
  readyEmployeeCount: number;
  employeesNeedingAttention: number;
  readinessScore: number;
  issueCounts: WorkforceReadinessIssueCountsDto;
}

export type EmployeeHierarchyStatus =
  | "Healthy"
  | "Root"
  | "NoManagerAssigned"
  | "ManagerInactive"
  | "ManagerMissing";

export type EmployeeRosterSortField = "Name" | "Email" | "HireDate" | "Status";

export type EmployeeRosterSortDirection = "Asc" | "Desc";

export interface EmployeeRosterItem {
  id: string;
  stableEmployeeKey: string;
  employeeNumber?: string | null;
  preferredName?: string | null;
  displayName?: string;
  fullName?: string;
  firstName: string;
  lastName: string;
  email: string;
  orgUnitId: string | null;
  orgUnitName: string | null;
  jobTitle: string | null;
  status: EmployeeRosterStatus;
  hireDate: string;
  managerId: string | null;
  managerName: string | null;
  hierarchyStatus: EmployeeHierarchyStatus;
  directReportCount: number;
  readiness: EmployeeReadinessSummaryDto;
  version: number;
}

export interface EmployeeRosterPageDto {
  items: EmployeeRosterItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface EmployeeRosterQueryParams {
  search?: string;
  status?: EmployeeRosterStatus;
  orgUnitId?: string;
  orgUnitCode?: string;
  managerId?: string;
  access?: EmployeeAccessFilter;
  readiness?: EmployeeReadinessFilter;
  sortBy: EmployeeRosterSortField;
  sortDir: EmployeeRosterSortDirection;
  page: number;
  pageSize: number;
}

export interface EmployeeHierarchyNodeDto {
  employee: EmployeeRosterItem;
  depth: number;
}

export interface EmployeeReportingLinesDto {
  employee: EmployeeRosterItem;
  managerChain: EmployeeHierarchyNodeDto[];
  directReports: EmployeeHierarchyNodeDto[];
  downline: EmployeeHierarchyNodeDto[];
  directReportCount: number;
  downlineCount: number;
}

export interface EmployeeOrgUnitOption {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
}

export interface EmployeeOrgUnitPageDto {
  items: EmployeeOrgUnitOption[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface EmployeeDetailsEmploymentDto {
  employmentId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "Active" | "Ended";
  employmentType: string | null;
}

export interface EmployeeDetailsWorkAssignmentDto {
  workAssignmentId: string;
  employmentId: string;
  orgUnitId: string;
  orgUnitName: string | null;
  orgUnitType: string | null;
  jobTitle: string;
  workLocation: string | null;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface EmployeeDetailsManagerDto {
  relationshipId: string;
  managerEmployeeId: string;
  managerWorkAssignmentId: string;
  managerFirstName: string;
  managerLastName: string;
  managerEmail: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  managerFullName: string;
}

export interface EmployeeDetailsHistorySummaryDto {
  employmentCount: number;
  workAssignmentCount: number;
  managerRelationshipCount: number;
}

export interface EmployeeDetailsDto {
  id: string;
  tenantId: string;
  stableEmployeeKey: string;
  employeeNumber?: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string;
  phone: string | null;
  currentEmployment: EmployeeDetailsEmploymentDto | null;
  currentWorkAssignment: EmployeeDetailsWorkAssignmentDto | null;
  currentManager: EmployeeDetailsManagerDto | null;
  historySummary: EmployeeDetailsHistorySummaryDto;
  readiness: EmployeeReadinessSummaryDto;
  createdAt: string;
  updatedAt: string | null;
  version: number;
  fullName: string;
  displayName: string;
}

export type WorkforceAccountProvisioningState =
  | "Unprovisioned"
  | "InvitePending"
  | "InviteExpired"
  | "InviteRevoked"
  | "InviteAccepted"
  | "Active"
  | "Inactive"
  | "Conflict";

export type WorkforceAccountConflictKind =
  | "PendingInviteExists"
  | "EmailAlreadyRegistered"
  | "EmployeeEmailMismatch";

export type WorkforceInvitationDeliveryState =
  | "NotAttempted"
  | "Suppressed"
  | "Skipped"
  | "Sent"
  | "Failed";

export interface WorkforceAccountConflictDto {
  kind: WorkforceAccountConflictKind;
  message: string;
  blocking: boolean;
  suggestedAction: string | null;
}

export interface WorkforceAccountStatusDto {
  employeeId: string;
  email: string;
  fullName: string | null;
  role: string;
  accessProfiles: Array<{
    id: string;
    name: string;
    type: "SystemSeeded" | "Custom";
    isSystemProtected: boolean;
  }>;
  provisioningState: WorkforceAccountProvisioningState;
  userId: string | null;
  isActive: boolean | null;
  lastLoginAt: string | null;
  inviteId: string | null;
  inviteCreatedAt: string | null;
  inviteExpiresAt: string | null;
  inviteLink: string | null;
  deliveryStatus: WorkforceInvitationDeliveryState | null;
  deliveryMessage: string | null;
  deliveryRecordedAt?: string | null;
  conflict: WorkforceAccountConflictDto | null;
}

export interface WorkforceAccountSubject {
  employeeId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  accessProfileId?: string | null;
}

export type WorkforceAccountBulkProvisionOutcome =
  | "Created"
  | "Pending"
  | "Active"
  | "Inactive"
  | "Conflict";

export interface WorkforceAccountBulkProvisionResultDto {
  employeeId: string;
  outcome: WorkforceAccountBulkProvisionOutcome;
  message: string;
  account: WorkforceAccountStatusDto;
}

export interface WorkforceBulkInviteResultItemDto {
  employeeId: string;
  displayName: string;
  email: string;
  outcome: string;
  message: string;
}

export interface WorkforceBulkInviteResponseDto {
  items: WorkforceBulkInviteResultItemDto[];
  totalRequested: number;
  invitedCount: number;
  refreshedCount: number;
  alreadyActiveCount: number;
  skippedCount: number;
}

export interface WorkforceAccountSummaryDto {
  activeAccountCount: number;
  inactiveAccountCount: number;
  pendingInviteCount: number;
  acceptedInviteCount: number;
  expiredInviteCount: number;
  revokedInviteCount: number;
  trackedEmployeeCount: number;
  attentionQueueCount: number;
}
