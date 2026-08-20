using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>
/// Builds one bounded, tenant-scoped canonical snapshot for the resolver with set-based queries —
/// existing employees (identity, lifecycle, current work facts, work-email occupancy) and the
/// canonical Organization as-of the baseline plus known current validity. The resolver reads only
/// this snapshot; it never issues per-row canonical queries.
/// </summary>
public sealed class WorkforceImportSnapshotLoader(CoreHRDbContext context, IOrganizationService organization)
{
    public async Task<WorkforceCanonicalSnapshot> LoadAsync(DateOnly baseline, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var asOf = Flatten((await organization.GetHierarchyAsync(baseline, cancellationToken)).Roots).ToList();
        var validTodayIds = baseline < today
            ? Flatten((await organization.GetHierarchyAsync(today, cancellationToken)).Roots).Select(n => n.Unit.Id).ToHashSet()
            : asOf.Select(n => n.Unit.Id).ToHashSet();

        // Each unit's canonical history start (earliest Active effective state) — so the resolver can
        // check work-effective dates against the exact date the unit began to exist in Fusion. Units
        // with no timeline (legacy) are absent here and carry no history constraint (MinValue).
        var establishedFrom = (await context.OrgUnitEffectiveStates.AsNoTracking()
                .Where(s => s.LifecycleState == OrgUnitLifecycleState.Active)
                .GroupBy(s => s.OrgUnitId)
                .Select(g => new { OrgUnitId = g.Key, From = g.Min(x => x.EffectiveFrom) })
                .ToListAsync(cancellationToken))
            .ToDictionary(x => x.OrgUnitId, x => x.From);

        var orgById = new Dictionary<Guid, CanonicalOrgUnitRef>();
        var orgByCode = new Dictionary<string, CanonicalOrgUnitRef>(StringComparer.Ordinal);
        var orgByPath = new Dictionary<string, CanonicalOrgUnitRef>(StringComparer.Ordinal);
        var orgByName = new List<CanonicalOrgUnitRef>();
        foreach (var node in asOf)
        {
            var unit = node.Unit;
            var reference = new CanonicalOrgUnitRef(unit.Id, unit.Code, unit.Path, unit.Name, validTodayIds.Contains(unit.Id),
                establishedFrom.TryGetValue(unit.Id, out var ef) ? ef : DateOnly.MinValue);
            orgById[unit.Id] = reference;
            orgByCode[WorkforceCanonicalSnapshot.NormalizeOrg(unit.Code)] = reference;
            orgByPath[WorkforceCanonicalSnapshot.NormalizeOrg(unit.Path)] = reference;
            orgByName.Add(reference);
        }

        // Set-based employee facts.
        var employees = await context.Employees.AsNoTracking().ToListAsync(cancellationToken);
        var primaryByEmployee = await context.WorkAssignments.AsNoTracking()
            .Where(a => a.IsPrimary && a.EffectiveTo == null)
            .ToDictionaryAsync(a => a.EmployeeId, cancellationToken);
        var activeEmploymentEmployees = (await context.Employments.AsNoTracking()
            .Where(e => e.EffectiveTo == null)
            .Select(e => new { e.EmployeeId, e.Status })
            .ToListAsync(cancellationToken))
            .Where(e => e.Status == Domain.Enums.EmploymentStatus.Active)
            .Select(e => e.EmployeeId).ToHashSet();
        var occupancies = await context.WorkEmailOccupancies.AsNoTracking()
            .ToDictionaryAsync(o => o.NormalizedEmail, o => o.EmployeeId, cancellationToken);

        var byNumber = new Dictionary<string, CanonicalEmployeeRef>(StringComparer.Ordinal);
        var byEmail = new Dictionary<string, CanonicalEmployeeRef>(StringComparer.Ordinal);
        var byId = new Dictionary<Guid, CanonicalEmployeeRef>();
        foreach (var employee in employees)
        {
            primaryByEmployee.TryGetValue(employee.Id, out var assignment);
            var reference = new CanonicalEmployeeRef(
                employee.Id,
                employee.EmployeeNumber,
                employee.Email,
                employee.FirstName,
                employee.LastName,
                IsFormer: !activeEmploymentEmployees.Contains(employee.Id),
                OrgUnitCode: assignment is not null && orgById.TryGetValue(assignment.OrgUnitId, out var unit) ? unit.Code : null,
                DisplayTitle: assignment?.JobTitle,
                Location: assignment?.WorkLocation,
                ManagerEmployeeId: null);
            byId[employee.Id] = reference;
            if (!string.IsNullOrWhiteSpace(employee.EmployeeNumber))
                byNumber[WorkforceCanonicalSnapshot.NormalizeNumber(employee.EmployeeNumber)] = reference;
        }
        foreach (var (email, employeeId) in occupancies)
            if (byId.TryGetValue(employeeId, out var reference))
                byEmail[WorkforceCanonicalSnapshot.NormalizeEmail(email)] = reference;

        return new WorkforceCanonicalSnapshot
        {
            ByEmployeeNumber = byNumber,
            ByWorkEmail = byEmail,
            ByFusionId = byId,
            ReservedFormerNumbers = new Dictionary<string, Guid>(), // no employee-number reservation model in MVP
            OrgById = orgById,
            OrgByCode = orgByCode,
            OrgByPath = orgByPath,
            OrgByName = orgByName.ToLookup(o => o.Name.Trim().ToLowerInvariant()),
        };
    }

    private static IEnumerable<OrganizationHierarchyNodeDto> Flatten(IEnumerable<OrganizationHierarchyNodeDto> nodes)
    {
        foreach (var node in nodes)
        {
            yield return node;
            foreach (var child in Flatten(node.Children)) yield return child;
        }
    }
}
