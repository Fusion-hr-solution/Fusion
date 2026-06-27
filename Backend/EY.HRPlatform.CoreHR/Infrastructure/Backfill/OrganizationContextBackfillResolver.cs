using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Infrastructure.Backfill;

/// <summary>Outcome of resolving an employee's backfill organization context.</summary>
public sealed record OrgContextResolution(Guid? OrgUnitId, string Source)
{
    public bool HasOrgContext => OrgUnitId is { } id && id != Guid.Empty;

    public static OrgContextResolution None { get; } = new(null, "None");
}

/// <summary>
/// Deterministic organization-context precedence for backfilling a primary
/// <c>WorkAssignment</c> (design D13):
/// <list type="number">
///   <item>existing canonical-compatible assignment data,</item>
///   <item>reliable primary/home <c>EmployeeOrgMembership</c>,</item>
///   <item>legacy <c>Employee.OrgUnitId</c>.</item>
/// </list>
/// When higher- and lower-priority sources disagree, or when multiple active primary/home
/// memberships resolve to different org units for one employee, the resolver records a
/// fail-fast diagnostic instead of overwriting or picking arbitrarily.
/// </summary>
public sealed class OrganizationContextBackfillResolver
{
    /// <param name="employee">The legacy employee being backfilled.</param>
    /// <param name="activePrimaryHomeMemberships">
    /// That employee's active (as-of <paramref name="asOf"/>) memberships that are primary or of
    /// type <see cref="OrgMembershipType.Home"/>.
    /// </param>
    /// <param name="existingCanonicalOrgUnitId">
    /// Org unit from an already-existing canonical primary assignment, when re-running backfill.
    /// </param>
    /// <param name="diagnostics">Accumulator for fail-fast findings.</param>
    public OrgContextResolution Resolve(
        Employee employee,
        IReadOnlyList<EmployeeOrgMembership> activePrimaryHomeMemberships,
        Guid? existingCanonicalOrgUnitId,
        DateTime asOf,
        List<WorkforceBackfillDiagnostic> diagnostics)
    {
        // Priority 1: existing canonical assignment data wins outright (idempotent re-run).
        if (existingCanonicalOrgUnitId is { } canonical && canonical != Guid.Empty)
            return new OrgContextResolution(canonical, "CanonicalAssignment");

        // Priority 2: reliable primary/home membership. Multiple distinct org units => conflict.
        var membershipOrgUnits = activePrimaryHomeMemberships
            .Where(m => m.IsEffectiveOn(asOf))
            .Select(m => m.OrgUnitId)
            .Distinct()
            .ToList();

        if (membershipOrgUnits.Count > 1)
        {
            diagnostics.Add(new WorkforceBackfillDiagnostic(
                WorkforceBackfillDiagnosticCodes.MultipleActivePrimaryMemberships,
                employee.Id,
                $"Employee has {membershipOrgUnits.Count} active primary/home memberships in different org units "
                + $"({string.Join(", ", membershipOrgUnits)}); resolve to a single primary org before backfill."));
            return OrgContextResolution.None;
        }

        Guid? membershipOrgUnit = membershipOrgUnits.Count == 1 ? membershipOrgUnits[0] : null;

        // Priority 3: legacy direct field.
        Guid? legacyOrgUnit = employee.OrgUnitId is { } legacy && legacy != Guid.Empty ? legacy : null;

        // Disagreement between the two present sources fails fast (never silently overwrite).
        if (membershipOrgUnit is { } m2 && legacyOrgUnit is { } l3 && m2 != l3)
        {
            diagnostics.Add(new WorkforceBackfillDiagnostic(
                WorkforceBackfillDiagnosticCodes.ConflictingOrgSources,
                employee.Id,
                $"Primary/home membership org unit ({m2}) disagrees with legacy Employee.OrgUnitId ({l3}); "
                + "reconcile the source data before backfill."));
            return OrgContextResolution.None;
        }

        if (membershipOrgUnit is { } chosenMembership)
            return new OrgContextResolution(chosenMembership, "PrimaryHomeMembership");

        if (legacyOrgUnit is { } chosenLegacy)
            return new OrgContextResolution(chosenLegacy, "LegacyEmployeeOrgUnit");

        // No org context anywhere — a readiness gap, not a fail-fast error.
        return OrgContextResolution.None;
    }
}
