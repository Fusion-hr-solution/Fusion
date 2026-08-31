using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.WorkforceAccess;

/// <summary>
/// The single workforce baseline an activated identity carries. Employee and
/// Manager are mutually exclusive; neither is administrator authority.
/// </summary>
public enum WorkforceBaseline
{
    Employee = 0,
    Manager = 1,
}

public static class WorkforceBaselineRecommendation
{
    /// <summary>
    /// Point-in-time decision support from canonical direct reports: none recommends
    /// Employee, one or more recommends Manager. It is reviewed by an administrator,
    /// never applied as continuous synchronization.
    /// </summary>
    public static WorkforceBaseline FromDirectReports(int activeDirectReportCount)
        => activeDirectReportCount > 0 ? WorkforceBaseline.Manager : WorkforceBaseline.Employee;
}

public interface IWorkforceBaselineService
{
    /// <summary>
    /// Applies exactly one reviewed Employee/Manager baseline to the membership,
    /// additively: it swaps only the opposite workforce-baseline slot and leaves HR
    /// Admin, Org Admin, custom profiles, and Tenant Administrator authority intact.
    /// The caller owns the transaction (no SaveChanges here).
    /// </summary>
    Task ApplyAsync(TenantMembership membership, WorkforceBaseline baseline, CancellationToken cancellationToken);
}

public sealed class WorkforceBaselineService(AppIdentityDbContext dbContext) : IWorkforceBaselineService
{
    private static readonly string EmployeeKey = AccessProfileTemplates.Employee.InternalKey;
    private static readonly string ManagerKey = AccessProfileTemplates.Manager.InternalKey;

    public async Task ApplyAsync(TenantMembership membership, WorkforceBaseline baseline, CancellationToken cancellationToken)
    {
        var workforceProfiles = await dbContext.AccessProfiles
            .IgnoreQueryFilters()
            .Where(profile => profile.TenantId == membership.TenantId
                && (profile.InternalKey == EmployeeKey || profile.InternalKey == ManagerKey))
            .Select(profile => new { profile.Id, profile.InternalKey })
            .ToListAsync(cancellationToken);

        var targetKey = baseline == WorkforceBaseline.Manager ? ManagerKey : EmployeeKey;
        var otherKey = baseline == WorkforceBaseline.Manager ? EmployeeKey : ManagerKey;

        var targetProfileId = workforceProfiles.FirstOrDefault(profile => profile.InternalKey == targetKey)?.Id
            ?? throw new InvalidOperationException(
                $"Tenant {membership.TenantId} is missing the seeded '{targetKey}' workforce access profile.");
        var otherProfileId = workforceProfiles.FirstOrDefault(profile => profile.InternalKey == otherKey)?.Id;

        var existing = await dbContext.UserAccessProfiles
            .IgnoreQueryFilters()
            .Where(assignment => assignment.TenantMembershipId == membership.Id)
            .ToListAsync(cancellationToken);

        // Remove only the opposite workforce baseline. Everything else the account
        // holds (HR Admin, Org Admin, custom, Tenant Administrator) is untouched.
        if (otherProfileId is { } otherId)
        {
            var toRemove = existing.Where(assignment => assignment.AccessProfileId == otherId).ToList();
            if (toRemove.Count > 0)
            {
                dbContext.UserAccessProfiles.RemoveRange(toRemove);
            }
        }

        // Add the reviewed baseline if it is not already assigned.
        if (existing.All(assignment => assignment.AccessProfileId != targetProfileId))
        {
            dbContext.UserAccessProfiles.Add(UserAccessProfile.ForMembership(membership, targetProfileId));
        }
    }
}
