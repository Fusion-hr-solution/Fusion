import type { ApiClient } from "./types";

export type PeopleEmploymentState = "Active" | "Scheduled" | "Former" | "Incomplete";
export type PeopleOrganizationScope = "Direct" | "Subtree";
export type PeopleSortField = "Name" | "EmployeeNumber" | "EmploymentDate";
export type PeopleSortDirection = "Asc" | "Desc";
export type EmployeeNumberMode = "Generated" | "Manual";

export interface PeopleManagerDto {
  employeeKey: string;
  displayName: string;
  employeeNumber: string;
}

export interface PeopleWorkDto {
  orgUnitId: string | null;
  jobTitle: string;
  organizationName: string;
  organizationPath: string;
  location: string | null;
  effectiveFrom: string;
  isHistorical: boolean;
}

export interface PeopleRowDto {
  employeeKey: string;
  employeeNumber: string;
  displayName: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  employmentState: PeopleEmploymentState;
  employmentStart: string | null;
  employmentEnd: string | null;
  work: PeopleWorkDto | null;
  primaryManager: PeopleManagerDto | null;
  completeness: "Complete" | "WorkDetailsUnavailable" | string;
}

export interface PeoplePageDto {
  items: PeopleRowDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PeopleQueryParams {
  q?: string | null;
  state?: PeopleEmploymentState | null;
  orgUnitId?: string | null;
  organizationScope?: PeopleOrganizationScope;
  sort?: PeopleSortField;
  direction?: PeopleSortDirection;
  page?: number;
  pageSize?: number;
  /** Transient handoff filter: show only the cohort added by a completed Workforce Import. */
  importBatch?: string | null;
}

export interface PeopleProfileIdentityDto {
  employeeKey: string;
  employeeNumber: string;
  displayName: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  workEmail: string | null;
  phone: string | null;
}

export interface PeopleProfileEmploymentDto {
  state: PeopleEmploymentState;
  start: string | null;
  end: string | null;
  employmentType: string | null;
}

export interface PeopleProfileReportDto {
  employeeKey: string;
  employeeNumber: string;
  displayName: string;
  jobTitle: string | null;
}

export type PeopleChangeKind =
  | "Work"
  | "Manager"
  | "EmploymentStarted"
  | "EmploymentEnded"
  | "WorkEstablished";

export interface PeopleChangeFieldDto {
  label: string;
  from: string | null;
  to: string | null;
}

export interface PeopleUpcomingChangeDto {
  effectiveDate: string;
  kind: PeopleChangeKind;
  employeeKey: string;
  fields: PeopleChangeFieldDto[];
}

export interface PeopleTimelineEventDto {
  effectiveDate: string;
  kind: PeopleChangeKind;
  title: string;
  isFuture: boolean;
  fields: PeopleChangeFieldDto[];
}

export interface PeopleTimelineDto {
  upcoming: PeopleUpcomingChangeDto[];
  timeline: PeopleTimelineEventDto[];
}

export interface PeopleProfileDto {
  identity: PeopleProfileIdentityDto;
  employment: PeopleProfileEmploymentDto;
  work: PeopleWorkDto | null;
  primaryManager: PeopleManagerDto | null;
  directReportCount: number;
  directReports: PeopleProfileReportDto[];
  completeness: "Complete" | "EmploymentUnavailable" | "WorkDetailsUnavailable" | string;
  version: number;
  /** The effective date this snapshot was resolved for (Today by default). */
  viewedDate: string;
  /** True when viewing a non-Today date; the snapshot is read-only. */
  isAsOf: boolean;
  /** Scheduled future changes, present only on the Today view. */
  upcoming: PeopleUpcomingChangeDto[];
}

export interface MaintenanceResultDto {
  employeeKey: string;
  effectiveDate: string;
  isScheduled: boolean;
}

export interface AffectedReportDto {
  displayName: string;
  employeeNumber: string;
}

export interface EndEmploymentPreviewDto {
  lastEmployedDate: string;
  directReportCount: number;
  directReports: AffectedReportDto[];
}

export interface ChangeWorkRequestBody {
  effectiveDate: string;
  orgUnitId: string;
  jobTitle: string;
  location?: string | null;
}

export interface ChangeManagerByKeyRequestBody {
  effectiveDate: string;
  managerEmployeeId?: string | null;
}

export interface EndEmploymentRequestBody {
  lastEmployedDate: string;
  note?: string | null;
}

export interface PeopleAccessStatusDto {
  state: "Linked" | "NoFusionAccess" | string;
  label: string;
  detail: string | null;
}

export interface ManagerOptionDto {
  employeeId: string;
  employeeKey: string;
  employeeNumber: string;
  displayName: string;
  jobTitle: string;
  organizationName: string;
  organizationPath: string;
  availability: "Available" | "Scheduled" | string;
}

export interface EstablishmentRequestBase {
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  workEmail?: string | null;
  phone?: string | null;
  employeeNumberMode: EmployeeNumberMode;
  employeeNumber?: string | null;
  employmentType?: string | null;
  orgUnitId: string;
  jobTitle: string;
  location?: string | null;
  primaryManagerEmployeeId?: string | null;
}

export interface HireEmployeeRequest extends EstablishmentRequestBase {
  startDate: string;
}

export interface AddExistingEmployeeRequest extends EstablishmentRequestBase {
  employmentStart: string;
  workDetailsEffectiveFrom: string;
}

export interface EstablishmentSuggestionDto {
  employeeKey: string;
  employeeNumber: string;
  displayName: string;
  reason: string;
}

export interface EstablishmentReviewRequest {
  firstName: string;
  lastName: string;
  workEmail?: string | null;
  employeeNumberMode: EmployeeNumberMode;
  employeeNumber?: string | null;
}

export interface EstablishmentConflictDto {
  kind: "EmployeeNumber" | "WorkEmail" | string;
  employeeKey: string;
  employeeNumber: string;
  displayName: string;
  message: string;
}

export interface EstablishmentReviewDto {
  conflict: EstablishmentConflictDto | null;
  suggestions: EstablishmentSuggestionDto[];
}

export interface EstablishmentResultDto {
  employeeKey: string;
  employeeNumber: string;
  displayName: string;
  workEmail: string | null;
  employmentState: PeopleEmploymentState;
  employmentStart: string;
  workDetailsEffectiveFrom: string;
  jobTitle: string;
  organizationName: string;
  organizationPath: string;
  location: string | null;
  primaryManagerName: string | null;
  reviewSuggestions: EstablishmentSuggestionDto[];
}

export const corePeoplePaths = {
  people: () => "/corehr/employees/people",
  profile: (employeeKey: string) => `/corehr/employees/people/${encodeURIComponent(employeeKey)}`,
  timeline: (employeeKey: string) => `/corehr/employees/people/${encodeURIComponent(employeeKey)}/timeline`,
  accessStatus: (employeeKey: string) => `/corehr/employees/people/${encodeURIComponent(employeeKey)}/access-status`,
  managerOptions: () => "/corehr/employees/people/manager-options",
  establishmentReview: () => "/corehr/employees/people/establishment-review",
  changeWork: (employeeKey: string) => `/corehr/employees/people/${encodeURIComponent(employeeKey)}/change-work`,
  changeManager: (employeeKey: string) => `/corehr/employees/people/${encodeURIComponent(employeeKey)}/change-manager`,
  endEmployment: (employeeKey: string) => `/corehr/employees/people/${encodeURIComponent(employeeKey)}/end-employment`,
  endEmploymentPreview: (employeeKey: string) => `/corehr/employees/people/${encodeURIComponent(employeeKey)}/end-employment/preview`,
  hire: () => "/corehr/employees/hire",
  addExisting: () => "/corehr/employees/add-existing",
} as const;

export const corePeopleQueryKeys = {
  all: () => ["corePeople"] as const,
  lists: () => [...corePeopleQueryKeys.all(), "list"] as const,
  list: (params: PeopleQueryParams) => [...corePeopleQueryKeys.lists(), params] as const,
  profiles: () => [...corePeopleQueryKeys.all(), "profile"] as const,
  profile: (employeeKey: string, asOf?: string | null) =>
    [...corePeopleQueryKeys.profiles(), employeeKey, asOf ?? "today"] as const,
  timeline: (employeeKey: string) => [...corePeopleQueryKeys.profiles(), employeeKey, "timeline"] as const,
  endEmploymentPreview: (employeeKey: string, lastEmployedDate: string) =>
    [...corePeopleQueryKeys.profiles(), employeeKey, "end-preview", lastEmployedDate] as const,
  accessStatus: (employeeKey: string) => [...corePeopleQueryKeys.profiles(), employeeKey, "access"] as const,
  managerOptions: (effectiveDate: string, q: string) =>
    [...corePeopleQueryKeys.all(), "managerOptions", effectiveDate, q] as const,
} as const;

/** Canonical typed transport for the Workforce Slice 1 People surface. */
export function createCorePeopleApi(client: ApiClient) {
  return {
    people: (params: PeopleQueryParams, signal?: AbortSignal) =>
      client.get<PeoplePageDto>(corePeoplePaths.people(), {
        params: { ...params },
        signal,
      }),
    profile: (employeeKey: string, asOf?: string | null, signal?: AbortSignal) =>
      client.get<PeopleProfileDto>(corePeoplePaths.profile(employeeKey), {
        params: asOf ? { asOf } : undefined,
        signal,
      }),
    timeline: (employeeKey: string, signal?: AbortSignal) =>
      client.get<PeopleTimelineDto>(corePeoplePaths.timeline(employeeKey), { signal }),
    endEmploymentPreview: (employeeKey: string, lastEmployedDate: string, signal?: AbortSignal) =>
      client.get<EndEmploymentPreviewDto>(corePeoplePaths.endEmploymentPreview(employeeKey), {
        params: { lastEmployedDate },
        signal,
      }),
    changeWork: (employeeKey: string, request: ChangeWorkRequestBody) =>
      client.post<MaintenanceResultDto>(corePeoplePaths.changeWork(employeeKey), request),
    changeManager: (employeeKey: string, request: ChangeManagerByKeyRequestBody) =>
      client.post<MaintenanceResultDto>(corePeoplePaths.changeManager(employeeKey), request),
    endEmployment: (employeeKey: string, request: EndEmploymentRequestBody) =>
      client.post<MaintenanceResultDto>(corePeoplePaths.endEmployment(employeeKey), request),
    accessStatus: (employeeKey: string, signal?: AbortSignal) =>
      client.get<PeopleAccessStatusDto>(corePeoplePaths.accessStatus(employeeKey), { signal }),
    managerOptions: (effectiveDate: string, q = "", signal?: AbortSignal) =>
      client.get<ManagerOptionDto[]>(corePeoplePaths.managerOptions(), {
        params: { effectiveDate, q, limit: 30 },
        signal,
      }),
    establishmentReview: (request: EstablishmentReviewRequest) =>
      client.post<EstablishmentReviewDto>(corePeoplePaths.establishmentReview(), request),
    hire: (request: HireEmployeeRequest) =>
      client.post<EstablishmentResultDto>(corePeoplePaths.hire(), request),
    addExisting: (request: AddExistingEmployeeRequest) =>
      client.post<EstablishmentResultDto>(corePeoplePaths.addExisting(), request),
  };
}
