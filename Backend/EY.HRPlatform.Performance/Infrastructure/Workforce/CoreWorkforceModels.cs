namespace EY.HRPlatform.Performance.Infrastructure.Workforce;

/// <summary>
/// Minimal projection of a Core workforce employee summary. Only the fields Performance
/// snapshots are mapped; extra JSON fields from Core are ignored on deserialization.
/// </summary>
public sealed record CoreEmployeeSummary(
    Guid EmployeeId,
    string StableEmployeeKey,
    string FullName,
    string DisplayName,
    string WorkEmail,
    string? JobTitle,
    bool IsActive,
    CoreOrgAssignment? OrgUnit,
    CoreManagerSummary? Manager);

public sealed record CoreOrgAssignment(
    Guid OrgUnitId,
    string Name);

public sealed record CoreManagerSummary(
    Guid EmployeeId,
    string DisplayName);
