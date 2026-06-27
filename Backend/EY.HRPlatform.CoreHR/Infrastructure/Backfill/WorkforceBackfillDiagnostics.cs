namespace EY.HRPlatform.CoreHR.Infrastructure.Backfill;

/// <summary>
/// A single fail-fast finding from the workforce backfill. Diagnostics are accumulated across
/// the whole tenant and, if any exist, abort the backfill with actionable detail — the backfill
/// never silently defaults, quarantines, or partially applies.
/// </summary>
public sealed record WorkforceBackfillDiagnostic(string Code, Guid? EmployeeId, string Message);

/// <summary>Counts produced by a successful backfill of one tenant.</summary>
public sealed record WorkforceBackfillResult(
    Guid TenantId,
    int EmploymentsCreated,
    int WorkAssignmentsCreated,
    int ManagerRelationshipsCreated,
    int EmployeesWithoutOrgContext);

/// <summary>
/// Thrown when fail-fast backfill validation finds invalid, ambiguous, overlapping, or
/// cross-tenant workforce data. Carries every diagnostic so operators can repair the source
/// data in one pass. No canonical truth is written when this is thrown.
/// </summary>
public sealed class WorkforceBackfillException : Exception
{
    public WorkforceBackfillException(Guid tenantId, IReadOnlyList<WorkforceBackfillDiagnostic> diagnostics)
        : base(BuildMessage(tenantId, diagnostics))
    {
        TenantId = tenantId;
        Diagnostics = diagnostics;
    }

    public Guid TenantId { get; }
    public IReadOnlyList<WorkforceBackfillDiagnostic> Diagnostics { get; }

    private static string BuildMessage(Guid tenantId, IReadOnlyList<WorkforceBackfillDiagnostic> diagnostics)
    {
        var lines = diagnostics.Select(d => d.EmployeeId is { } id
            ? $"  [{d.Code}] employee {id}: {d.Message}"
            : $"  [{d.Code}] {d.Message}");
        return $"Workforce backfill aborted for tenant {tenantId} with {diagnostics.Count} blocking issue(s):"
            + Environment.NewLine
            + string.Join(Environment.NewLine, lines);
    }
}

/// <summary>Diagnostic codes for fail-fast backfill conditions (stable for tests and operators).</summary>
public static class WorkforceBackfillDiagnosticCodes
{
    public const string InvalidHireDate = "INVALID_HIRE_DATE";
    public const string MissingEndDateForInactive = "MISSING_END_DATE_FOR_INACTIVE";
    public const string SelfManagement = "SELF_MANAGEMENT";
    public const string ManagerNotFound = "MANAGER_NOT_FOUND";
    public const string ManagerCrossTenant = "MANAGER_CROSS_TENANT";
    public const string ManagerCycle = "MANAGER_CYCLE";
    public const string ManagerAssignmentMissing = "MANAGER_ASSIGNMENT_MISSING";
    public const string OrgUnitNotFound = "ORG_UNIT_NOT_FOUND";
    public const string OrgUnitInactive = "ORG_UNIT_INACTIVE";
    public const string OrgUnitCrossTenant = "ORG_UNIT_CROSS_TENANT";
    public const string ConflictingOrgSources = "CONFLICTING_ORG_SOURCES";
    public const string MultipleActivePrimaryMemberships = "MULTIPLE_ACTIVE_PRIMARY_MEMBERSHIPS";
    public const string ResponsibleManagerInvalid = "RESPONSIBLE_MANAGER_INVALID";
    public const string AlreadyBackfilled = "ALREADY_BACKFILLED";
}
