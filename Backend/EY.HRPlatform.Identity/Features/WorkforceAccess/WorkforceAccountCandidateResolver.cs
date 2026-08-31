using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.WorkforceAccess;

/// <summary>
/// The bounded, non-disclosing account-state outcome for a workforce Employee,
/// decided from exact normalized work email only (security §7). No fuzzy match and
/// no other-tenant identity ever leaves this decision.
/// </summary>
public enum WorkforceAccountCandidateOutcome
{
    /// <summary>No global account has the exact normalized work email.</summary>
    NewAccount = 0,

    /// <summary>Exact account has an Active membership here with no Employee binding.</summary>
    ExistingAccountReadyToLink = 1,

    /// <summary>Exact account's Active membership here is already bound to this Employee.</summary>
    Active = 2,

    /// <summary>Exact account's membership here is bound to a different Employee.</summary>
    BindingConflict = 3,

    /// <summary>Exact account has a Suspended membership here and no Active membership elsewhere.</summary>
    SuspendedAccountReadyToReactivate = 4,

    /// <summary>Exact account has no membership here and no Active membership elsewhere.</summary>
    ExistingAccountReadyToJoinTenant = 5,

    /// <summary>Exact account has an Active membership in another tenant.</summary>
    AccountUnavailable = 6,
}

/// <summary>
/// The candidate decision plus only the non-disclosing facts a confirmation surface
/// may show. <see cref="UserId"/> is present only for same-tenant outcomes; another
/// tenant's account identity is never returned.
/// </summary>
public sealed record WorkforceAccountCandidate(
    Guid EmployeeId,
    WorkforceAccountCandidateOutcome Outcome,
    Guid? UserId,
    Guid? MembershipId,
    string? AccountEmail,
    bool IsAdministrator = false,
    IReadOnlyList<string>? AdditionalAccess = null,
    // Access revision of the same-tenant membership, when one exists. This is the
    // optimistic-concurrency token a lifecycle/correction command echoes back: it bumps
    // on every binding-affecting mutation, so a stale command is refused rather than
    // applied. Null for outcomes with no usable same-tenant membership.
    int? AccessRevision = null);

public sealed record WorkforceAccountCandidateSubject(
    Guid EmployeeId,
    string? NormalizedWorkEmail);

public interface IWorkforceAccountCandidateResolver
{
    /// <summary>
    /// Resolves the account-state outcome for one Employee/work-email pair in the
    /// authoritative tenant. Pure and side-effect-free: it performs no mutation and
    /// discloses no other-tenant identity.
    /// </summary>
    Task<WorkforceAccountCandidate> ResolveAsync(
        Guid tenantId,
        Guid employeeId,
        string? normalizedWorkEmail,
        CancellationToken cancellationToken);

    /// <summary>
    /// Resolves a workforce review scope with bounded, set-based database work. The
    /// returned candidates preserve the caller's subject order and use the same exact
    /// normalized-email and tenant-membership semantics as <see cref="ResolveAsync"/>.
    /// </summary>
    Task<IReadOnlyList<WorkforceAccountCandidate>> ResolveManyAsync(
        Guid tenantId,
        IReadOnlyCollection<WorkforceAccountCandidateSubject> subjects,
        CancellationToken cancellationToken);
}

public sealed class WorkforceAccountCandidateResolver(AppIdentityDbContext dbContext)
    : IWorkforceAccountCandidateResolver
{
    public async Task<WorkforceAccountCandidate> ResolveAsync(
        Guid tenantId,
        Guid employeeId,
        string? normalizedWorkEmail,
        CancellationToken cancellationToken)
    {
        var resolved = await ResolveManyAsync(
            tenantId,
            [new WorkforceAccountCandidateSubject(employeeId, normalizedWorkEmail)],
            cancellationToken);
        return resolved[0];
    }

    public async Task<IReadOnlyList<WorkforceAccountCandidate>> ResolveManyAsync(
        Guid tenantId,
        IReadOnlyCollection<WorkforceAccountCandidateSubject> subjects,
        CancellationToken cancellationToken)
    {
        if (subjects.Count == 0)
            return [];

        var normalizedSubjects = subjects
            .Select(subject => new
            {
                subject.EmployeeId,
                NormalizedEmail = subject.NormalizedWorkEmail?.Trim().ToUpperInvariant(),
            })
            .ToList();
        var normalizedEmails = normalizedSubjects
            .Select(subject => subject.NormalizedEmail)
            .Where(email => !string.IsNullOrWhiteSpace(email))
            .Cast<string>()
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        // No work email means no automatic candidate. Those subjects are blocked by
        // CoreHR and resolve to NewAccount here without any database work or guess.
        if (normalizedEmails.Length == 0)
            return normalizedSubjects.Select(subject => New(subject.EmployeeId)).ToList();

        var accounts = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(user => user.NormalizedEmail != null && normalizedEmails.Contains(user.NormalizedEmail))
            .Select(user => new { user.Id, user.Email, user.NormalizedEmail })
            .ToListAsync(cancellationToken);

        if (accounts.Count == 0)
            return normalizedSubjects.Select(subject => New(subject.EmployeeId)).ToList();

        var accountsByEmail = accounts
            .Where(account => !string.IsNullOrWhiteSpace(account.NormalizedEmail))
            .GroupBy(account => account.NormalizedEmail!, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);
        var accountIds = accounts.Select(account => account.Id).ToArray();

        var memberships = await dbContext.TenantMemberships
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(membership => accountIds.Contains(membership.UserId))
            .Select(membership => new
            {
                membership.Id,
                membership.UserId,
                membership.TenantId,
                membership.Status,
                membership.EmployeeId,
                membership.AccessRevision,
            })
            .ToListAsync(cancellationToken);
        var membershipsByUserId = memberships
            .GroupBy(membership => membership.UserId)
            .ToDictionary(group => group.Key, group => group.ToList());
        var sameTenantMemberships = memberships
            .Where(membership => membership.TenantId == tenantId)
            .ToList();
        var sameTenantMembershipIds = sameTenantMemberships
            .Select(membership => membership.Id)
            .ToArray();

        var profileRows = sameTenantMembershipIds.Length == 0
            ? []
            : await dbContext.UserAccessProfiles
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(assignment => sameTenantMembershipIds.Contains(assignment.TenantMembershipId))
                .Join(
                    dbContext.AccessProfiles.IgnoreQueryFilters(),
                    assignment => assignment.AccessProfileId,
                    profile => profile.Id,
                    (assignment, profile) => new MembershipProfileRow(
                        assignment.TenantMembershipId, profile.Name, profile.InternalKey))
                .ToListAsync(cancellationToken);
        var profilesByMembershipId = profileRows
            .GroupBy(profile => profile.MembershipId)
            .ToDictionary(group => group.Key, group => group.ToList());

        // Tenant Administrator authority is its canonical assignment, not an access
        // profile. Read it once for the same-tenant accounts so Workforce Access routes
        // their lifecycle to Administrators without turning a legacy profile into authority.
        var sameTenantUserIds = sameTenantMemberships.Select(membership => membership.UserId).Distinct().ToArray();
        var administratorUserIds = sameTenantUserIds.Length == 0
            ? []
            : (await dbContext.TenantAdministratorAssignments
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(assignment => assignment.TenantId == tenantId
                    && sameTenantUserIds.Contains(assignment.UserId)
                    && assignment.RevokedAt == null)
                .Select(assignment => assignment.UserId)
                .ToListAsync(cancellationToken))
                .ToHashSet();

        return normalizedSubjects.Select(subject =>
        {
            if (string.IsNullOrWhiteSpace(subject.NormalizedEmail)
                || !accountsByEmail.TryGetValue(subject.NormalizedEmail, out var account))
            {
                return New(subject.EmployeeId);
            }

            var accountMemberships = membershipsByUserId.GetValueOrDefault(account.Id, []);
            var here = accountMemberships
                .Where(membership => membership.TenantId == tenantId)
                .OrderByDescending(membership => membership.Status == TenantMembershipStatus.Active)
                .FirstOrDefault();
            var hasActiveElsewhere = accountMemberships.Any(membership =>
                membership.TenantId != tenantId && membership.Status == TenantMembershipStatus.Active);

            if (here is { Status: TenantMembershipStatus.Active })
            {
                var (isAdministrator, additionalAccess) = DescribeMembershipAccess(
                    here.Id,
                    administratorUserIds.Contains(account.Id),
                    profilesByMembershipId);
                var outcome = here.EmployeeId == subject.EmployeeId
                    ? WorkforceAccountCandidateOutcome.Active
                    : here.EmployeeId is not null
                        ? WorkforceAccountCandidateOutcome.BindingConflict
                        : WorkforceAccountCandidateOutcome.ExistingAccountReadyToLink;
                return new WorkforceAccountCandidate(
                    subject.EmployeeId,
                    outcome,
                    account.Id,
                    here.Id,
                    account.Email,
                    isAdministrator,
                    additionalAccess,
                    here.AccessRevision);
            }

            if (here is { Status: TenantMembershipStatus.Suspended } && !hasActiveElsewhere)
            {
                var (isAdministrator, additionalAccess) = DescribeMembershipAccess(
                    here.Id,
                    administratorUserIds.Contains(account.Id),
                    profilesByMembershipId);
                return new WorkforceAccountCandidate(
                    subject.EmployeeId,
                    WorkforceAccountCandidateOutcome.SuspendedAccountReadyToReactivate,
                    account.Id,
                    here.Id,
                    account.Email,
                    isAdministrator,
                    additionalAccess,
                    here.AccessRevision);
            }

            if (hasActiveElsewhere)
            {
                return new WorkforceAccountCandidate(
                    subject.EmployeeId,
                    WorkforceAccountCandidateOutcome.AccountUnavailable,
                    null,
                    null,
                    null);
            }

            return new WorkforceAccountCandidate(
                subject.EmployeeId,
                WorkforceAccountCandidateOutcome.ExistingAccountReadyToJoinTenant,
                account.Id,
                null,
                account.Email);
        }).ToList();
    }

    private static (bool IsAdministrator, IReadOnlyList<string> AdditionalAccess) DescribeMembershipAccess(
        Guid membershipId,
        bool isAdministrator,
        IReadOnlyDictionary<Guid, List<MembershipProfileRow>> profilesByMembershipId)
    {
        var profiles = profilesByMembershipId.GetValueOrDefault(membershipId, []);

        var adminKey = TenantAdministratorAuthority.InternalKey;
        var employeeKey = AccessProfileTemplates.Employee.InternalKey;
        var managerKey = AccessProfileTemplates.Manager.InternalKey;

        var additional = profiles
            .Where(profile => profile.InternalKey != adminKey
                && profile.InternalKey != employeeKey
                && profile.InternalKey != managerKey)
            .Select(profile => profile.Name)
            .OrderBy(name => name)
            .ToList();

        return (isAdministrator, additional);
    }

    private sealed record MembershipProfileRow(Guid MembershipId, string Name, string? InternalKey);

    private static WorkforceAccountCandidate New(Guid employeeId)
        => new(employeeId, WorkforceAccountCandidateOutcome.NewAccount, null, null, null);
}
