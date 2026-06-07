using EY.HRPlatform.CoreHR.Models.Responses;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Dtos;

public sealed record WorkforceManagerSummaryDto(
    Guid EmployeeId,
    string DisplayName,
    string Email,
    bool IsActive);

public sealed record WorkforceOrgAssignmentDto(
    Guid OrgUnitId,
    string StableOrgUnitKey,
    string Name,
    string Type,
    string? ParentStableOrgUnitKey,
    string Path,
    int Level,
    bool IsActive,
    int PublishedStructureVersion);

public sealed record WorkforceDataQualityDto(
    string State,
    bool HasEmployeeStateIssues,
    bool HasOperationalBlockers,
    IReadOnlyList<string> IssueCodes);

public sealed record WorkforceEmployeeSummaryDto(
    Guid EmployeeId,
    string StableEmployeeKey,
    string? EmployeeNumber,
    string FirstName,
    string LastName,
    string? PreferredName,
    string DisplayName,
    string FullName,
    string WorkEmail,
    string? JobTitle,
    DateTime HireDate,
    string EmploymentStatus,
    bool IsActive,
    WorkforceOrgAssignmentDto? OrgUnit,
    WorkforceManagerSummaryDto? Manager,
    int DirectReportCount,
    WorkforceDataQualityDto DataQuality,
    uint Version);

public sealed record WorkforceAccessProfileSummaryDto(
    Guid Id,
    string Name);

public sealed record WorkforceAccessSubjectSummaryDto(
    Guid EmployeeId,
    string StableEmployeeKey,
    string? EmployeeNumber,
    string FirstName,
    string LastName,
    string? PreferredName,
    string DisplayName,
    string WorkEmail,
    string EmploymentStatus,
    bool IsActive,
    int DirectReportCount,
    string AccessState,
    string AccessStateLabel,
    string? AccessStateDetail,
    IReadOnlyList<WorkforceAccessProfileSummaryDto> AccessProfiles,
    string InvitationLabel,
    string LastActivityLabel,
    DateTime? LastActivityAt,
    string? DeliveryState,
    string? ReviewReason,
    string ProvisioningState,
    Guid? UserId);

public sealed record WorkforceAccessRosterSummaryDto(
    int TotalCount,
    int NotInvitedCount,
    int InvitePendingCount,
    int ActiveAccountCount,
    int NeedsReviewCount);

public sealed record WorkforceManagerScopeDto(
    string ScopeType,
    Guid ManagerEmployeeId,
    int DirectReportCount,
    bool IncludesIndirectReports);

public sealed record WorkforceCurrentUserContextDto(
    Guid UserId,
    Guid TenantId,
    Guid? EmployeeId,
    IReadOnlyList<string> Roles,
    WorkforceEmployeeSummaryDto? Employee,
    WorkforceManagerScopeDto? ManagerScope,
    bool IsWorkforceLinked,
    int PublishedStructureVersion,
    bool IsStructureOperational);

public sealed record WorkforceEmployeeResolveRequest(
    IReadOnlyList<Guid> EmployeeIds);

public sealed record WorkforceOrgUnitSummaryDto(
    Guid Id,
    string StableKey,
    string Name,
    string Type,
    string? ParentStableKey,
    string Path,
    int Level,
    bool IsActive,
    int PublishedStructureVersion);

public sealed record WorkforceOrgUnitTreeNodeDto(
    Guid Id,
    string StableKey,
    string Name,
    string Type,
    string? ParentStableKey,
    string Path,
    int Level,
    bool IsActive,
    int PublishedStructureVersion,
    IReadOnlyList<WorkforceOrgUnitTreeNodeDto> Children);

public sealed record WorkforceOrgUnitTreeDto(
    IReadOnlyList<WorkforceOrgUnitTreeNodeDto> Roots,
    int PublishedStructureVersion);

public sealed record WorkforceEmployeeSearchResponseDto(
    PagedResponse<WorkforceEmployeeSummaryDto> Results);

public sealed record WorkforceAccessSubjectSearchResponseDto(
    PagedResponse<WorkforceAccessSubjectSummaryDto> Results);

public sealed record WorkforceBulkInviteRequest(
    string? Search,
    string? Access,
    Guid? ProfileId,
    string? EmployeeStatus,
    string? DeliveryState,
    string? EmployeeKey,
    IReadOnlyList<Guid>? SpecificEmployeeIds,
    Guid AccessProfileId);

public sealed record WorkforceBulkInviteResultItemDto(
    Guid EmployeeId,
    string DisplayName,
    string Email,
    string Outcome,
    string Message);

public sealed record WorkforceBulkInviteResponseDto(
    IReadOnlyList<WorkforceBulkInviteResultItemDto> Items,
    int TotalRequested,
    int InvitedCount,
    int RefreshedCount,
    int AlreadyActiveCount,
    int SkippedCount);
