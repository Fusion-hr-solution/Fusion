namespace EY.HRPlatform.Performance.Features.CollectiveObjectives.Dtos;

/// <summary>
/// Read projection of a collective (team) objective with strategic parent provenance (D-15).
/// Exposes ParentStrategicId + ParentStrategicTitle but NOT the strategic parent's Description/body.
/// </summary>
public sealed record CollectiveObjectiveDto(
    Guid Id,
    Guid CycleId,
    Guid OwnerEmployeeId,
    Guid? ParentStrategicId,
    string? ParentStrategicTitle,
    string Title,
    string? Description,
    decimal? Weight,
    DateTime? DueDate,
    string Status,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt,
    uint Version);

/// <summary>HTTP request body for creating a collective objective.</summary>
public sealed record CreateCollectiveObjectiveRequest(
    Guid CycleId,
    Guid OrgUnitId,
    Guid StrategicParentId,
    string Title,
    string? Description,
    decimal? Weight,
    DateTime? DueDate);

/// <summary>HTTP request body for deciding a collective objective approval.</summary>
public sealed record DecideCollectiveObjectiveApprovalRequest(
    Guid WorkItemId,
    string Decision);
