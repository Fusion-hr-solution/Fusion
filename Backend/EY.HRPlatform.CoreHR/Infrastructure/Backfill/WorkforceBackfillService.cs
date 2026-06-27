using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Infrastructure.Backfill;

/// <summary>
/// One-time, tenant-scoped, migration-only backfill of the canonical workforce model from legacy
/// <c>Employee</c> fields and provisional rows. Creates canonical facts in order — employment,
/// then primary work assignment, then manager relationship — all with <c>Source = Migration</c>
/// provenance and half-open <c>[from, to)</c> dating. Validation is fail-fast: every blocking
/// condition is collected and the whole tenant aborts via <see cref="WorkforceBackfillException"/>
/// with no writes. This type is deleted in the Phase 3 cleanup of the hardening change.
/// </summary>
public interface IWorkforceBackfillService
{
    Task<WorkforceBackfillResult> BackfillTenantAsync(Guid tenantId, CancellationToken cancellationToken);
}

public sealed class WorkforceBackfillService(CoreHRDbContext dbContext) : IWorkforceBackfillService
{
    private readonly OrganizationContextBackfillResolver _orgResolver = new();

    public async Task<WorkforceBackfillResult> BackfillTenantAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));

        var asOf = DateTime.UtcNow;
        var diagnostics = new List<WorkforceBackfillDiagnostic>();

        // Read legacy/source state, bypassing the tenant query filter and scoping explicitly.
        var employees = await dbContext.Employees.IgnoreQueryFilters()
            .Where(e => e.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var orgUnits = await dbContext.OrgUnits.IgnoreQueryFilters()
            .Where(o => o.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var memberships = await dbContext.EmployeeOrgMemberships.IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && (m.IsPrimary || m.Type == OrgMembershipType.Home))
            .ToListAsync(cancellationToken);

        var alreadyBackfilledEmployeeIds = await dbContext.Employments.IgnoreQueryFilters()
            .Where(e => e.TenantId == tenantId)
            .Select(e => e.EmployeeId)
            .ToListAsync(cancellationToken);

        var employeeIds = employees.Select(e => e.Id).ToHashSet();
        var orgUnitsById = orgUnits.ToDictionary(o => o.Id);
        var membershipsByEmployee = memberships
            .GroupBy(m => m.EmployeeId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<EmployeeOrgMembership>)g.ToList());
        var alreadyBackfilled = alreadyBackfilledEmployeeIds.ToHashSet();

        // Employees needing backfill (idempotent: skip any that already have an employment).
        var pending = employees.Where(e => !alreadyBackfilled.Contains(e.Id)).ToList();

        // --- Validation + resolution pass (no writes) -------------------------------------
        ValidateManagerGraph(pending, employeeIds, diagnostics, cancellationToken);
        ValidateResponsibleManagers(orgUnits, employees, diagnostics);

        var orgContextByEmployee = new Dictionary<Guid, Guid?>();
        foreach (var employee in pending)
        {
            cancellationToken.ThrowIfCancellationRequested();

            ValidateHireAndStatus(employee, diagnostics);

            var employeeMemberships = membershipsByEmployee.TryGetValue(employee.Id, out var ms)
                ? ms
                : Array.Empty<EmployeeOrgMembership>();

            var resolution = _orgResolver.Resolve(employee, employeeMemberships, null, asOf, diagnostics);
            orgContextByEmployee[employee.Id] = resolution.OrgUnitId;

            if (resolution.OrgUnitId is { } orgUnitId)
                ValidateOrgUnit(employee, orgUnitId, tenantId, orgUnitsById, diagnostics);
        }

        // Manager relationships require both subject and manager to have a primary assignment.
        ValidateManagerAssignments(pending, orgContextByEmployee, diagnostics);

        if (diagnostics.Count > 0)
            throw new WorkforceBackfillException(tenantId, diagnostics);

        // --- Write pass (single transaction via one SaveChanges) --------------------------
        var employmentByEmployee = new Dictionary<Guid, Employment>();
        var primaryAssignmentByEmployee = new Dictionary<Guid, WorkAssignment>();
        var employeesWithoutOrgContext = 0;

        foreach (var employee in pending)
        {
            var employment = CreateEmployment(employee, tenantId);
            dbContext.Employments.Add(employment);
            employmentByEmployee[employee.Id] = employment;

            if (orgContextByEmployee[employee.Id] is { } orgUnitId)
            {
                var assignment = WorkAssignment.Create(
                    tenantId,
                    employment.Id,
                    employee.Id,
                    orgUnitId,
                    string.IsNullOrWhiteSpace(employee.JobTitle) ? "Unspecified" : employee.JobTitle!,
                    employee.WorkLocation,
                    isPrimary: true,
                    employment.EffectiveFrom,
                    employment.EffectiveTo,
                    WorkforceSourceType.Migration);
                dbContext.WorkAssignments.Add(assignment);
                primaryAssignmentByEmployee[employee.Id] = assignment;
            }
            else
            {
                employeesWithoutOrgContext++;
            }
        }

        var managerRelationshipsCreated = 0;
        foreach (var employee in pending)
        {
            var managerId = Normalize(employee.ManagerId);
            if (managerId is null)
                continue;

            // Both assignments are guaranteed present by ValidateManagerAssignments above.
            if (!primaryAssignmentByEmployee.TryGetValue(employee.Id, out var subjectAssignment)
                || !primaryAssignmentByEmployee.TryGetValue(managerId.Value, out var managerAssignment))
                continue;

            var subjectEmployment = employmentByEmployee[employee.Id];
            var relationship = ManagerRelationship.Create(
                tenantId,
                employee.Id,
                managerId.Value,
                subjectAssignment.Id,
                managerAssignment.Id,
                ReportingRelationshipType.PrimaryManager,
                subjectEmployment.EffectiveFrom,
                WorkforceSourceType.Migration,
                subjectEmployment.EffectiveTo);
            dbContext.ManagerRelationships.Add(relationship);
            managerRelationshipsCreated++;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return new WorkforceBackfillResult(
            tenantId,
            employmentByEmployee.Count,
            primaryAssignmentByEmployee.Count,
            managerRelationshipsCreated,
            employeesWithoutOrgContext);
    }

    private static void ValidateHireAndStatus(Employee employee, List<WorkforceBackfillDiagnostic> diagnostics)
    {
        if (employee.HireDate == default)
        {
            diagnostics.Add(new WorkforceBackfillDiagnostic(
                WorkforceBackfillDiagnosticCodes.InvalidHireDate,
                employee.Id,
                "Employee has no valid hire date to backfill Employment.EffectiveFrom."));
            return;
        }

        if (employee.Status == EmployeeStatus.Inactive)
        {
            var endDate = ResolveInactiveEndDate(employee);
            if (endDate is null)
            {
                diagnostics.Add(new WorkforceBackfillDiagnostic(
                    WorkforceBackfillDiagnosticCodes.MissingEndDateForInactive,
                    employee.Id,
                    "Inactive employee has no UpdatedAt after HireDate to use as the employment end date; "
                    + "set an explicit deactivation date before backfill."));
            }
        }
    }

    private static void ValidateOrgUnit(
        Employee employee,
        Guid orgUnitId,
        Guid tenantId,
        IReadOnlyDictionary<Guid, OrgUnit> orgUnitsById,
        List<WorkforceBackfillDiagnostic> diagnostics)
    {
        if (!orgUnitsById.TryGetValue(orgUnitId, out var orgUnit))
        {
            diagnostics.Add(new WorkforceBackfillDiagnostic(
                WorkforceBackfillDiagnosticCodes.OrgUnitNotFound,
                employee.Id,
                $"Resolved org unit {orgUnitId} does not exist in tenant {tenantId}."));
            return;
        }

        if (orgUnit.TenantId != tenantId)
        {
            diagnostics.Add(new WorkforceBackfillDiagnostic(
                WorkforceBackfillDiagnosticCodes.OrgUnitCrossTenant,
                employee.Id,
                $"Resolved org unit {orgUnitId} belongs to a different tenant."));
            return;
        }

        if (!orgUnit.IsActive)
        {
            diagnostics.Add(new WorkforceBackfillDiagnostic(
                WorkforceBackfillDiagnosticCodes.OrgUnitInactive,
                employee.Id,
                $"Resolved org unit {orgUnitId} is inactive; reactivate or reassign before backfill."));
        }
    }

    private static void ValidateManagerGraph(
        IReadOnlyList<Employee> pending,
        IReadOnlySet<Guid> tenantEmployeeIds,
        List<WorkforceBackfillDiagnostic> diagnostics,
        CancellationToken cancellationToken)
    {
        var managerById = pending.ToDictionary(e => e.Id, e => Normalize(e.ManagerId));

        foreach (var employee in pending)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var managerId = Normalize(employee.ManagerId);
            if (managerId is null)
                continue;

            if (managerId.Value == employee.Id)
            {
                diagnostics.Add(new WorkforceBackfillDiagnostic(
                    WorkforceBackfillDiagnosticCodes.SelfManagement,
                    employee.Id,
                    "Employee is recorded as their own manager."));
                continue;
            }

            if (!tenantEmployeeIds.Contains(managerId.Value))
            {
                diagnostics.Add(new WorkforceBackfillDiagnostic(
                    WorkforceBackfillDiagnosticCodes.ManagerNotFound,
                    employee.Id,
                    $"Manager {managerId.Value} does not exist in this tenant."));
                continue;
            }

            // Cycle detection by walking the manager chain.
            var visited = new HashSet<Guid> { employee.Id };
            var current = managerId;
            while (current is { } cursor)
            {
                if (!visited.Add(cursor))
                {
                    diagnostics.Add(new WorkforceBackfillDiagnostic(
                        WorkforceBackfillDiagnosticCodes.ManagerCycle,
                        employee.Id,
                        "Manager references form a cycle in the management chain."));
                    break;
                }

                if (!managerById.TryGetValue(cursor, out var next))
                    break;
                current = next;
            }
        }
    }

    private static void ValidateManagerAssignments(
        IReadOnlyList<Employee> pending,
        IReadOnlyDictionary<Guid, Guid?> orgContextByEmployee,
        List<WorkforceBackfillDiagnostic> diagnostics)
    {
        var willHaveAssignment = orgContextByEmployee
            .Where(kvp => kvp.Value is not null)
            .Select(kvp => kvp.Key)
            .ToHashSet();

        foreach (var employee in pending)
        {
            var managerId = Normalize(employee.ManagerId);
            if (managerId is null)
                continue;

            // A manager relationship references work assignments on both sides.
            if (!willHaveAssignment.Contains(employee.Id) || !willHaveAssignment.Contains(managerId.Value))
            {
                diagnostics.Add(new WorkforceBackfillDiagnostic(
                    WorkforceBackfillDiagnosticCodes.ManagerAssignmentMissing,
                    employee.Id,
                    $"Manager relationship to {managerId.Value} cannot be backfilled because the subject or "
                    + "manager lacks a resolvable primary work assignment (org context). Resolve org context first."));
            }
        }
    }

    private static void ValidateResponsibleManagers(
        IReadOnlyList<OrgUnit> orgUnits,
        IReadOnlyList<Employee> employees,
        List<WorkforceBackfillDiagnostic> diagnostics)
    {
        var activeEmployeeIds = employees
            .Where(e => e.Status == EmployeeStatus.Active)
            .Select(e => e.Id)
            .ToHashSet();
        var allEmployeeIds = employees.Select(e => e.Id).ToHashSet();

        foreach (var orgUnit in orgUnits)
        {
            if (orgUnit.ResponsibleManagerEmployeeId is not { } responsibleId || responsibleId == Guid.Empty)
                continue;

            if (!allEmployeeIds.Contains(responsibleId))
            {
                diagnostics.Add(new WorkforceBackfillDiagnostic(
                    WorkforceBackfillDiagnosticCodes.ResponsibleManagerInvalid,
                    null,
                    $"Org unit {orgUnit.Id} responsible manager {responsibleId} does not exist in this tenant."));
            }
            else if (!activeEmployeeIds.Contains(responsibleId))
            {
                diagnostics.Add(new WorkforceBackfillDiagnostic(
                    WorkforceBackfillDiagnosticCodes.ResponsibleManagerInvalid,
                    null,
                    $"Org unit {orgUnit.Id} responsible manager {responsibleId} is not an active employee."));
            }
        }
    }

    private static Employment CreateEmployment(Employee employee, Guid tenantId)
    {
        var employment = Employment.Start(
            tenantId,
            employee.Id,
            employee.HireDate,
            employee.EmploymentType,
            WorkforceSourceType.Migration);

        if (employee.Status == EmployeeStatus.Inactive)
        {
            var endDate = ResolveInactiveEndDate(employee)!.Value;
            employment.End(endDate);
        }

        return employment;
    }

    private static DateTime? ResolveInactiveEndDate(Employee employee)
    {
        if (employee.UpdatedAt is { } updatedAt && updatedAt > employee.HireDate)
            return updatedAt;

        return null;
    }

    private static Guid? Normalize(Guid? id) => id is { } value && value != Guid.Empty ? value : null;
}
