using System.Security.Claims;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Services;

/// <summary>
/// Validates and audits the <c>OrgUnit.ResponsibleManagerEmployeeId</c> org-administration
/// attribute. Responsible manager is org accountability, not a reporting relationship, so it is
/// kept as a direct, optional, single-per-unit value (D10) rather than derived from manager chains.
/// A responsible manager MUST be a same-tenant employee with an active canonical <c>Employment</c>;
/// validation reads the canonical chain, never a legacy <c>Employee</c> status field.
/// </summary>
public interface IResponsibleManagerService
{
    /// <summary>
    /// Throws when the responsible manager is not a same-tenant employee with an active employment.
    /// A null/empty value clears the attribute and is always valid.
    /// </summary>
    Task ValidateAsync(Guid? responsibleManagerEmployeeId, CancellationToken cancellationToken);

    /// <summary>
    /// Stages an append-only <c>ResponsibleManagerChanged</c> audit entry when the value changed.
    /// Written in the caller's transaction (the handler's single <c>SaveChanges</c>).
    /// </summary>
    void StageChangeAudit(Guid orgUnitId, Guid? previous, Guid? next);
}

public sealed class ResponsibleManagerService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IWorkforceCanonicalResolver resolver,
    IHttpContextAccessor httpContextAccessor) : IResponsibleManagerService
{
    public async Task ValidateAsync(Guid? responsibleManagerEmployeeId, CancellationToken cancellationToken)
    {
        if (responsibleManagerEmployeeId is not { } employeeId || employeeId == Guid.Empty)
            return;

        // Tenant scoping is enforced by the fail-closed query filter: a cross-tenant employee
        // simply does not resolve here and is reported as not found.
        var exists = await dbContext.Employees
            .AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!exists)
            throw new EntityNotFoundException("Employee", employeeId);

        var employment = await resolver.GetCurrentEmploymentAsync(employeeId, asOf: null, cancellationToken);
        if (employment is null)
            throw new ArgumentException(
                "Responsible manager must be an employee with an active employment.",
                nameof(responsibleManagerEmployeeId));
    }

    public void StageChangeAudit(Guid orgUnitId, Guid? previous, Guid? next)
    {
        var previousValue = Normalize(previous);
        var nextValue = Normalize(next);
        if (previousValue == nextValue)
            return;

        var details = nextValue is null
            ? "Org-unit responsible manager cleared."
            : "Org-unit responsible manager set.";

        dbContext.WorkforceAuditEntries.Add(WorkforceAuditEntry.Record(
            tenantContext.TenantId,
            entityType: "OrgUnit",
            entityId: orgUnitId,
            action: WorkforceAuditAction.ResponsibleManagerChanged,
            source: WorkforceSourceType.Manual,
            actor: ResolveActor(),
            effectiveDate: null,
            sourceReference: null,
            importBatchId: null,
            changeDetails: details));
    }

    private string? ResolveActor()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user is null)
            return null;

        return user.FindFirst(CustomClaimTypes.FullName)?.Value
            ?? user.FindFirst(ClaimTypes.Email)?.Value;
    }

    private static Guid? Normalize(Guid? id) => id is { } value && value != Guid.Empty ? value : null;
}
