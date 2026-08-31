using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Infrastructure.Core;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.WorkforceBinding;

/// <summary>
/// Why a legacy <c>ApplicationUser.EmployeeId</c> could not be deterministically
/// bound to a membership. Every non-bound row is reported for controlled
/// remediation rather than guessed.
/// </summary>
public enum WorkforceBindingConflictReason
{
    /// <summary>CoreHR did not confirm any of the account's membership tenants owns the Employee.</summary>
    OwnerNotVerified = 0,

    /// <summary>The verified owner tenant has no membership for this account.</summary>
    NoMatchingMembership = 1,

    /// <summary>More than one membership matches a verified owner tenant.</summary>
    MultipleMatchingMemberships = 2,

    /// <summary>The target membership already binds a different Employee.</summary>
    MembershipAlreadyBound = 3,

    /// <summary>Another membership in the tenant already binds this Employee (uniqueness).</summary>
    EmployeeAlreadyBoundInTenant = 4,
}

public sealed record WorkforceBindingConflict(
    Guid UserId,
    Guid EmployeeId,
    WorkforceBindingConflictReason Reason);

public sealed record WorkforceBindingBackfillReport(
    int CandidatesConsidered,
    int BoundCount,
    int AlreadyBoundCount,
    IReadOnlyList<WorkforceBindingConflict> Conflicts)
{
    public bool HasConflicts => Conflicts.Count > 0;
}

public interface IWorkforceBindingBackfillService
{
    /// <summary>
    /// Migrates legacy global <c>ApplicationUser.EmployeeId</c> values onto the
    /// membership-scoped binding. Ownership is proven through the trusted CoreHR
    /// contract; a missing Employee, unverifiable owner, zero matching memberships,
    /// or multiple matches is reported and never guessed. When <paramref name="apply"/>
    /// is false the method computes the report without persisting (dry run).
    /// </summary>
    Task<WorkforceBindingBackfillReport> BackfillAsync(bool apply, CancellationToken cancellationToken);
}

public sealed class WorkforceBindingBackfillService(
    AppIdentityDbContext dbContext,
    ICoreWorkforceDirectory coreWorkforceDirectory) : IWorkforceBindingBackfillService
{
    public async Task<WorkforceBindingBackfillReport> BackfillAsync(bool apply, CancellationToken cancellationToken)
    {
        var asOf = DateTime.UtcNow;

        // Every account carrying a legacy Employee scalar, with all of its
        // memberships (any status) so a suspended historical owner still matches.
        var candidates = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(user => user.EmployeeId != null)
            .Select(user => new
            {
                user.Id,
                EmployeeId = user.EmployeeId!.Value,
            })
            .ToListAsync(cancellationToken);

        var memberships = await dbContext.TenantMemberships
            .IgnoreQueryFilters()
            .Where(membership => candidates.Select(c => c.Id).Contains(membership.UserId))
            .ToListAsync(cancellationToken);

        var membershipsByUser = memberships
            .GroupBy(membership => membership.UserId)
            .ToDictionary(group => group.Key, group => group.ToList());

        // Resolve ownership once per (tenant, employee) pair across all candidates,
        // batched per tenant so CoreHR is asked exactly once per tenant.
        var employeeIdsByTenant = new Dictionary<Guid, HashSet<Guid>>();
        foreach (var candidate in candidates)
        {
            if (!membershipsByUser.TryGetValue(candidate.Id, out var userMemberships))
            {
                continue;
            }

            foreach (var membership in userMemberships)
            {
                if (!employeeIdsByTenant.TryGetValue(membership.TenantId, out var set))
                {
                    set = [];
                    employeeIdsByTenant[membership.TenantId] = set;
                }

                set.Add(candidate.EmployeeId);
            }
        }

        var ownedByTenant = new Dictionary<Guid, IReadOnlyDictionary<Guid, CoreEmployeeFacts>>();
        foreach (var (tenantId, employeeIds) in employeeIdsByTenant)
        {
            ownedByTenant[tenantId] = await coreWorkforceDirectory.ResolveOwnedEmployeesAsync(
                tenantId, employeeIds, asOf, cancellationToken);
        }

        var conflicts = new List<WorkforceBindingConflict>();
        var boundCount = 0;
        var alreadyBoundCount = 0;

        foreach (var candidate in candidates)
        {
            if (!membershipsByUser.TryGetValue(candidate.Id, out var userMemberships))
            {
                conflicts.Add(new WorkforceBindingConflict(
                    candidate.Id, candidate.EmployeeId, WorkforceBindingConflictReason.NoMatchingMembership));
                continue;
            }

            // Already migrated: a membership of this account already binds the Employee.
            if (userMemberships.Any(m => m.EmployeeId == candidate.EmployeeId))
            {
                alreadyBoundCount++;
                continue;
            }

            // Memberships whose tenant CoreHR confirmed owns this Employee.
            var verifiedMemberships = userMemberships
                .Where(m => ownedByTenant.TryGetValue(m.TenantId, out var owned)
                    && owned.ContainsKey(candidate.EmployeeId))
                .ToList();

            if (verifiedMemberships.Count == 0)
            {
                conflicts.Add(new WorkforceBindingConflict(
                    candidate.Id, candidate.EmployeeId, WorkforceBindingConflictReason.OwnerNotVerified));
                continue;
            }

            if (verifiedMemberships.Count > 1)
            {
                conflicts.Add(new WorkforceBindingConflict(
                    candidate.Id, candidate.EmployeeId, WorkforceBindingConflictReason.MultipleMatchingMemberships));
                continue;
            }

            var target = verifiedMemberships[0];

            if (target.EmployeeId is not null)
            {
                conflicts.Add(new WorkforceBindingConflict(
                    candidate.Id, candidate.EmployeeId, WorkforceBindingConflictReason.MembershipAlreadyBound));
                continue;
            }

            // Tenant-scoped uniqueness: refuse if another membership already binds it.
            var employeeTakenInTenant = await dbContext.TenantMemberships
                .IgnoreQueryFilters()
                .AnyAsync(
                    m => m.TenantId == target.TenantId
                        && m.EmployeeId == candidate.EmployeeId
                        && m.Id != target.Id,
                    cancellationToken);

            if (employeeTakenInTenant)
            {
                conflicts.Add(new WorkforceBindingConflict(
                    candidate.Id, candidate.EmployeeId, WorkforceBindingConflictReason.EmployeeAlreadyBoundInTenant));
                continue;
            }

            target.BindEmployee(candidate.EmployeeId);
            boundCount++;
        }

        if (apply && boundCount > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return new WorkforceBindingBackfillReport(
            candidates.Count, boundCount, alreadyBoundCount, conflicts);
    }
}
