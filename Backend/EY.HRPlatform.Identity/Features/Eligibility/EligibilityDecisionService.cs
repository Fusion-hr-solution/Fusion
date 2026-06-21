using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.Eligibility;

public sealed record EligibilityEvaluationRequest(
    Guid TenantId,
    Guid ActorUserId,
    string PermissionKey,
    string Action,
    Guid? ActorEmployeeId,
    Guid? SubjectEmployeeId,
    Guid? SubjectOrgUnitId,
    bool IsDirectPrimaryReport);

public enum EligibilityDenialReason
{
    None,
    TenantInactive,
    AccountInactive,
    PermissionMissing,
    OrgUnitOutOfScope,
    RelationshipOutOfScope,
}

public sealed record EligibilityDecision(
    bool IsEligible,
    EligibilityDenialReason DenialReason)
{
    public static EligibilityDecision Allow() => new(true, EligibilityDenialReason.None);
    public static EligibilityDecision Deny(EligibilityDenialReason reason) => new(false, reason);
}

public interface IEligibilityDecisionService
{
    Task<EligibilityDecision> EvaluateAsync(
        EligibilityEvaluationRequest request,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Evaluates authorization from current Identity state. Callers supply only current
/// Core relationship facts; this service never treats a token's embedded grants as
/// authoritative.
/// </summary>
public sealed class EligibilityDecisionService(AppIdentityDbContext dbContext) : IEligibilityDecisionService
{
    public async Task<EligibilityDecision> EvaluateAsync(
        EligibilityEvaluationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.TenantId == Guid.Empty || request.ActorUserId == Guid.Empty ||
            string.IsNullOrWhiteSpace(request.PermissionKey) || string.IsNullOrWhiteSpace(request.Action))
        {
            return EligibilityDecision.Deny(EligibilityDenialReason.PermissionMissing);
        }

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == request.TenantId, cancellationToken);
        if (tenant is null || !tenant.IsActive || tenant.IsArchived)
            return EligibilityDecision.Deny(EligibilityDenialReason.TenantInactive);

        var user = await dbContext.Users
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == request.ActorUserId && item.TenantId == request.TenantId, cancellationToken);
        if (user is null || !user.IsActive || (user.LockoutEnd.HasValue && user.LockoutEnd > DateTimeOffset.UtcNow))
            return EligibilityDecision.Deny(EligibilityDenialReason.AccountInactive);

        var assignments = await (
            from assignment in dbContext.UserAccessProfiles.IgnoreQueryFilters()
            join grant in dbContext.AccessProfileGrants.IgnoreQueryFilters()
                on assignment.AccessProfileId equals grant.AccessProfileId
            where assignment.TenantId == request.TenantId
                && assignment.UserId == request.ActorUserId
                && grant.TenantId == request.TenantId
                && grant.PermissionKey == request.PermissionKey
            select new { assignment.AccessProfileId, grant.Scope })
            .ToListAsync(cancellationToken);

        if (assignments.Count == 0)
            return EligibilityDecision.Deny(EligibilityDenialReason.PermissionMissing);

        var scopes = await dbContext.UserAccessProfileOrgUnitScopes
            .IgnoreQueryFilters()
            .Where(scope => scope.TenantId == request.TenantId && scope.UserId == request.ActorUserId)
            .ToListAsync(cancellationToken);

        foreach (var assignment in assignments)
        {
            if (!IsPermissionScopeEligible(assignment.Scope, request))
                continue;

            if (assignment.Scope is PermissionScopes.Tenant or PermissionScopes.Module or PermissionScopes.Platform
                || assignment.Scope == PermissionScopes.Self
                || assignment.Scope == PermissionScopes.DirectReports)
            {
                return EligibilityDecision.Allow();
            }

            var assignedOrgUnits = scopes
                .Where(scope => scope.AccessProfileId == assignment.AccessProfileId)
                .Select(scope => scope.OrgUnitId)
                .ToHashSet();

            if (request.SubjectOrgUnitId.HasValue && assignedOrgUnits.Contains(request.SubjectOrgUnitId.Value))
            {
                return EligibilityDecision.Allow();
            }
        }

        var hasOrgUnitGrant = assignments.Any(assignment => assignment.Scope == PermissionScopes.OrgUnit);
        return hasOrgUnitGrant
            ? EligibilityDecision.Deny(EligibilityDenialReason.OrgUnitOutOfScope)
            : EligibilityDecision.Deny(EligibilityDenialReason.RelationshipOutOfScope);
    }

    private static bool IsPermissionScopeEligible(string permissionScope, EligibilityEvaluationRequest request)
        => permissionScope switch
        {
            PermissionScopes.Tenant or PermissionScopes.Module or PermissionScopes.Platform => true,
            PermissionScopes.Self => request.ActorEmployeeId.HasValue &&
                request.ActorEmployeeId == request.SubjectEmployeeId,
            PermissionScopes.DirectReports => request.IsDirectPrimaryReport,
            PermissionScopes.OrgUnit => request.SubjectOrgUnitId.HasValue,
            _ => false,
        };
}
