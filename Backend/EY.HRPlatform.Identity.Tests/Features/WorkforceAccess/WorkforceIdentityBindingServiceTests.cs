using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.TenantAdministration;
using EY.HRPlatform.Identity.Features.WorkforceAccess;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Tests.Features.WorkforceAccess;

/// <summary>
/// The authoritative workforce binding commits its security-sensitive pieces as one
/// transaction — membership Employee binding, additive baseline, access-revision bump,
/// caller-supplied invitation reconciliation, and append-only audit — or it commits none
/// of them. Proven against real PostgreSQL, because rollback, the filtered unique index,
/// and the revision bump are exactly what an in-memory provider cannot demonstrate.
/// </summary>
public sealed class WorkforceIdentityBindingServiceTests : IAsyncLifetime
{
    private readonly RelationalTestDatabase _databases = new();
    private bool Available => _databases.Available;

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => _databases.DisposeAsync().AsTask();

    [SkippableFact]
    public async Task Binding_commits_binding_baseline_revision_and_audit_together()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var employeeId = Guid.NewGuid();

        var result = await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, employeeId, WorkforceBaseline.Manager),
            reconcileInvitation: null,
            CancellationToken.None);

        Assert.Equal(WorkforceBindingResultStatus.Bound, result.Status);

        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.Id == world.MembershipId);
        Assert.Equal(employeeId, membership.EmployeeId);
        Assert.True(membership.AccessRevision > world.OriginalRevision, "the revision must move so old tokens fail closed");
        Assert.Equal(membership.AccessRevision, result.AccessRevision);

        var managerId = await ProfileIdAsync(world.Db, "manager");
        var assigned = await AssignedProfileIdsAsync(world.Db, world.MembershipId);
        Assert.Contains(managerId, assigned);
        Assert.Contains(world.HrAdminProfileId, assigned); // unrelated authority preserved

        var audit = await world.Db.AccessAuditEvents.IgnoreQueryFilters()
            .Where(e => e.ResourceId == world.MembershipId.ToString()).ToListAsync();
        var bound = Assert.Single(audit);
        Assert.Equal(WorkforceAccessAuditActions.AccountActivated, bound.Action);
        Assert.Equal(WorkforceAccessAuditActions.ResourceTypeWorkforceAccount, bound.ResourceType);
    }

    [SkippableFact]
    public async Task A_second_membership_cannot_bind_an_already_bound_employee()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(secondMembership: true);
        var employeeId = Guid.NewGuid();

        await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, employeeId, WorkforceBaseline.Employee), null, CancellationToken.None);
        world.Db.ChangeTracker.Clear();

        var result = await Service(world.Db).BindAsync(
            Command(world, world.SecondMembershipId!.Value, employeeId, WorkforceBaseline.Employee), null, CancellationToken.None);

        Assert.Equal(WorkforceBindingResultStatus.EmployeeAlreadyBoundInTenant, result.Status);

        // The refused second membership is untouched: no binding, no baseline, no audit.
        world.Db.ChangeTracker.Clear();
        var second = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.Id == world.SecondMembershipId);
        Assert.Null(second.EmployeeId);
        Assert.Empty(await AssignedProfileIdsAsync(world.Db, world.SecondMembershipId!.Value));
        Assert.Empty(await world.Db.AccessAuditEvents.IgnoreQueryFilters()
            .Where(e => e.ResourceId == world.SecondMembershipId.ToString()).ToListAsync());
    }

    [SkippableFact]
    public async Task Rebinding_a_membership_to_a_different_employee_is_refused()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, first, WorkforceBaseline.Employee), null, CancellationToken.None);
        world.Db.ChangeTracker.Clear();

        var result = await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, second, WorkforceBaseline.Employee), null, CancellationToken.None);

        Assert.Equal(WorkforceBindingResultStatus.AlreadyBoundToDifferentEmployee, result.Status);

        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.Id == world.MembershipId);
        Assert.Equal(first, membership.EmployeeId); // correction is a separate path
    }

    [SkippableFact]
    public async Task A_failing_invitation_reconciliation_rolls_back_the_whole_binding()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var employeeId = Guid.NewGuid();

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(world.Db).BindAsync(
            Command(world, world.MembershipId, employeeId, WorkforceBaseline.Manager),
            reconcileInvitation: (_, _) => throw new InvalidOperationException("delivery reconciliation failed"),
            CancellationToken.None));

        // Not "bound, then reported" — nothing survives the failed reconciliation.
        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.Id == world.MembershipId);
        Assert.Null(membership.EmployeeId);
        Assert.Equal(world.OriginalRevision, membership.AccessRevision);
        Assert.Empty(await world.Db.AccessAuditEvents.IgnoreQueryFilters()
            .Where(e => e.ResourceId == world.MembershipId.ToString()).ToListAsync());

        var managerId = await ProfileIdAsync(world.Db, "manager");
        Assert.DoesNotContain(managerId, await AssignedProfileIdsAsync(world.Db, world.MembershipId));
    }

    [SkippableFact]
    public async Task Reactivate_and_link_reactivates_a_suspended_membership_in_the_same_commit()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(suspendPrimary: true);
        var employeeId = Guid.NewGuid();

        var result = await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, employeeId, WorkforceBaseline.Employee) with { ReactivateSuspendedMembership = true },
            null,
            CancellationToken.None);

        Assert.Equal(WorkforceBindingResultStatus.Bound, result.Status);

        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.Id == world.MembershipId);
        Assert.Equal(TenantMembershipStatus.Active, membership.Status);
        Assert.Equal(employeeId, membership.EmployeeId);
    }

    [SkippableFact]
    public async Task A_successful_invitation_reconciliation_persists_in_the_same_transaction()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var employeeId = Guid.NewGuid();
        var reconciled = false;

        var result = await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, employeeId, WorkforceBaseline.Employee),
            reconcileInvitation: (context, membership) =>
            {
                reconciled = true;
                // A representative in-transaction side effect: an audit marker written
                // through the same context, committed with the binding.
                context.Audit(AccessAuditEvent.Create(
                    membership.TenantId, world.ActorUserId, "Hr Manager", "HR Admin",
                    WorkforceAccessAuditActions.InvitationWithdrawn,
                    WorkforceAccessAuditActions.ResourceTypeWorkforceInvitation,
                    membership.Id.ToString(), "Superseded pending invitation on link.", null, null, null));
                return Task.CompletedTask;
            },
            CancellationToken.None);

        Assert.Equal(WorkforceBindingResultStatus.Bound, result.Status);
        Assert.True(reconciled);

        world.Db.ChangeTracker.Clear();
        var actions = await world.Db.AccessAuditEvents.IgnoreQueryFilters()
            .Where(e => e.ResourceId == world.MembershipId.ToString())
            .Select(e => e.Action).ToListAsync();
        Assert.Contains(WorkforceAccessAuditActions.AccountActivated, actions);
        Assert.Contains(WorkforceAccessAuditActions.InvitationWithdrawn, actions);
    }

    [SkippableFact]
    public async Task Concurrent_binds_of_the_same_employee_never_both_succeed()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(secondMembership: true);
        var employeeId = Guid.NewGuid();

        // Two genuinely concurrent commands, on two separate connections, race to bind
        // the same Employee to two different memberships in the one tenant. The tenant-row
        // lock serializes them and the recheck refuses the loser; the filtered unique
        // (TenantId, EmployeeId) index is the final guard behind that. Either way, a
        // duplicate binding must never persist.
        using var second = _databases.Connect(world.Db);

        var first = Service(world.Db).BindAsync(
            Command(world, world.MembershipId, employeeId, WorkforceBaseline.Employee), null, CancellationToken.None);
        var contender = Service(second).BindAsync(
            Command(world, world.SecondMembershipId!.Value, employeeId, WorkforceBaseline.Employee), null, CancellationToken.None);

        WorkforceBindingResult[] results;
        try
        {
            results = await Task.WhenAll(first, contender);
        }
        catch (DbUpdateException)
        {
            // The unique index rejecting the loser at commit is an acceptable outcome of
            // the race — what must not happen is two bindings surviving.
            results = [];
        }

        world.Db.ChangeTracker.Clear();
        var boundToEmployee = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .CountAsync(m => m.TenantId == world.TenantId && m.EmployeeId == employeeId);
        Assert.Equal(1, boundToEmployee);

        if (results.Length == 2)
        {
            Assert.Equal(1, results.Count(r => r.Status == WorkforceBindingResultStatus.Bound));
            Assert.Equal(1, results.Count(r => r.Status == WorkforceBindingResultStatus.EmployeeAlreadyBoundInTenant));
        }
    }

    [SkippableFact]
    public async Task Correction_rebinds_source_to_target_bumps_revision_and_preserves_authority()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var source = Guid.NewGuid();
        var target = Guid.NewGuid();

        await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, source, WorkforceBaseline.Employee), null, CancellationToken.None);
        world.Db.ChangeTracker.Clear();
        var revision = await RevisionAsync(world.Db, world.MembershipId);

        var result = await Service(world.Db).CorrectAsync(
            CorrectCommand(world, source, target, revision, WorkforceBaseline.Manager), CancellationToken.None);

        Assert.Equal(WorkforceCorrectionStatus.Corrected, result.Status);

        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.Id == world.MembershipId);
        Assert.Equal(target, membership.EmployeeId); // rebound, not deleted
        Assert.True(membership.AccessRevision > revision, "correction must move the revision so old sessions fail closed");

        var managerId = await ProfileIdAsync(world.Db, "manager");
        var assigned = await AssignedProfileIdsAsync(world.Db, world.MembershipId);
        Assert.Contains(managerId, assigned); // reviewed baseline applied
        Assert.Contains(world.HrAdminProfileId, assigned); // unrelated authority preserved

        var corrected = await world.Db.AccessAuditEvents.IgnoreQueryFilters()
            .Where(e => e.ResourceId == world.MembershipId.ToString()
                && e.Action == WorkforceAccessAuditActions.BindingCorrected)
            .SingleAsync();
        Assert.Contains("Reason", corrected.AfterJson ?? string.Empty);
    }

    [SkippableFact]
    public async Task Correction_refuses_when_the_target_is_already_bound_in_the_tenant()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(secondMembership: true);
        var source = Guid.NewGuid();
        var target = Guid.NewGuid();

        await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, source, WorkforceBaseline.Employee), null, CancellationToken.None);
        await Service(world.Db).BindAsync(
            Command(world, world.SecondMembershipId!.Value, target, WorkforceBaseline.Employee), null, CancellationToken.None);
        world.Db.ChangeTracker.Clear();
        var revision = await RevisionAsync(world.Db, world.MembershipId);

        var result = await Service(world.Db).CorrectAsync(
            CorrectCommand(world, source, target, revision, WorkforceBaseline.Employee), CancellationToken.None);

        Assert.Equal(WorkforceCorrectionStatus.TargetAlreadyBound, result.Status);

        // Neither binding moved; no correction audit was written.
        world.Db.ChangeTracker.Clear();
        var primary = await world.Db.TenantMemberships.IgnoreQueryFilters().SingleAsync(m => m.Id == world.MembershipId);
        Assert.Equal(source, primary.EmployeeId);
        Assert.Empty(await world.Db.AccessAuditEvents.IgnoreQueryFilters()
            .Where(e => e.ResourceId == world.MembershipId.ToString()
                && e.Action == WorkforceAccessAuditActions.BindingCorrected).ToListAsync());
    }

    [SkippableFact]
    public async Task Correction_refuses_on_a_stale_revision()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var source = Guid.NewGuid();
        var target = Guid.NewGuid();

        await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, source, WorkforceBaseline.Employee), null, CancellationToken.None);
        world.Db.ChangeTracker.Clear();
        var revision = await RevisionAsync(world.Db, world.MembershipId);

        var result = await Service(world.Db).CorrectAsync(
            CorrectCommand(world, source, target, revision - 1, WorkforceBaseline.Employee), CancellationToken.None);

        Assert.Equal(WorkforceCorrectionStatus.ConcurrencyMismatch, result.Status);

        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters().SingleAsync(m => m.Id == world.MembershipId);
        Assert.Equal(source, membership.EmployeeId); // unchanged
    }

    [SkippableFact]
    public async Task Correction_refuses_when_no_membership_is_bound_to_the_source()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();

        var result = await Service(world.Db).CorrectAsync(
            CorrectCommand(world, Guid.NewGuid(), Guid.NewGuid(), 1, WorkforceBaseline.Employee), CancellationToken.None);

        Assert.Equal(WorkforceCorrectionStatus.SourceNotBound, result.Status);
    }

    [SkippableFact]
    public async Task Correction_revokes_an_obsolete_pending_invitation_for_the_source()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var source = Guid.NewGuid();
        var target = Guid.NewGuid();

        await Service(world.Db).BindAsync(
            Command(world, world.MembershipId, source, WorkforceBaseline.Employee), null, CancellationToken.None);

        var invite = InviteToken.CreateWorkforce(
            "stale@atlas.example", world.TenantId, "Employee", world.ActorUserId,
            "Stale", "Invite", source);
        world.Db.InviteTokens.Add(invite);
        await world.Db.SaveChangesAsync();
        world.Db.ChangeTracker.Clear();
        var revision = await RevisionAsync(world.Db, world.MembershipId);

        var result = await Service(world.Db).CorrectAsync(
            CorrectCommand(world, source, target, revision, WorkforceBaseline.Employee), CancellationToken.None);

        Assert.Equal(WorkforceCorrectionStatus.Corrected, result.Status);

        world.Db.ChangeTracker.Clear();
        var stored = await world.Db.InviteTokens.IgnoreQueryFilters().SingleAsync(t => t.Id == invite.Id);
        Assert.True(stored.IsRevoked, "the obsolete pending invitation for the source must be revoked");
    }

    // ── plumbing ─────────────────────────────────────────

    private static Task<int> RevisionAsync(AppIdentityDbContext db, Guid membershipId)
        => db.TenantMemberships.IgnoreQueryFilters()
            .Where(m => m.Id == membershipId).Select(m => m.AccessRevision).SingleAsync();

    private static WorkforceCorrectionCommand CorrectCommand(
        World world, Guid source, Guid target, int expectedRevision, WorkforceBaseline baseline)
        => new(
            world.TenantId, source, target, baseline, "Onboarded the wrong person.",
            expectedRevision, world.ActorUserId, "Hr Manager", "HR Admin");

    private static IWorkforceIdentityBindingService Service(AppIdentityDbContext db)
        => new WorkforceIdentityBindingService(
            new TenantContinuityCommandExecutor(db),
            new WorkforceBaselineService(db));

    private static WorkforceBindingCommand Command(
        World world, Guid membershipId, Guid employeeId, WorkforceBaseline baseline)
        => new(
            world.TenantId, membershipId, employeeId, baseline,
            world.ActorUserId, "Hr Manager", "HR Admin",
            WorkforceAccessAuditActions.AccountActivated,
            "Activated workforce access.");

    private static Task<Guid> ProfileIdAsync(AppIdentityDbContext db, string internalKey)
        => db.AccessProfiles.IgnoreQueryFilters()
            .Where(p => p.InternalKey == internalKey).Select(p => p.Id).SingleAsync();

    private static Task<List<Guid>> AssignedProfileIdsAsync(AppIdentityDbContext db, Guid membershipId)
        => db.UserAccessProfiles.IgnoreQueryFilters()
            .Where(a => a.TenantMembershipId == membershipId)
            .Select(a => a.AccessProfileId).ToListAsync();

    private sealed record World(
        AppIdentityDbContext Db,
        Guid TenantId,
        Guid ActorUserId,
        Guid MembershipId,
        Guid? SecondMembershipId,
        Guid HrAdminProfileId,
        int OriginalRevision);

    private async Task<World> ArrangeAsync(bool secondMembership = false, bool suspendPrimary = false)
    {
        var db = await _databases.CreateAsync("fusion_binding");
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(Tenant.Create(tenantId, "Atlas Group"));

        var employee = AccessProfile.Create(tenantId, "Employee", null, AccessProfileTypes.SystemSeeded, true, "employee");
        var manager = AccessProfile.Create(tenantId, "Manager", null, AccessProfileTypes.SystemSeeded, true, "manager");
        var hrAdmin = AccessProfile.Create(tenantId, "HR Admin", null, AccessProfileTypes.SystemSeeded, true, "hr-admin");
        db.AccessProfiles.AddRange(employee, manager, hrAdmin);

        var membership = await AddMembershipAsync(db, tenantId, "primary", suspendPrimary);
        // The account already holds an unrelated authority the baseline must preserve.
        db.UserAccessProfiles.Add(UserAccessProfile.ForMembership(membership, hrAdmin.Id));

        Guid? secondMembershipId = null;
        if (secondMembership)
        {
            secondMembershipId = (await AddMembershipAsync(db, tenantId, "second", suspended: false)).Id;
        }

        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        return new World(db, tenantId, Guid.NewGuid(), membership.Id, secondMembershipId, hrAdmin.Id, membership.AccessRevision);
    }

    private static async Task<TenantMembership> AddMembershipAsync(
        AppIdentityDbContext db, Guid tenantId, string tag, bool suspended)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = $"{tag}-{Guid.NewGuid():N}@atlas.example",
            Email = $"{tag}@atlas.example",
            NormalizedEmail = $"{tag}@ATLAS.EXAMPLE",
            NormalizedUserName = $"{tag}@ATLAS.EXAMPLE",
            FirstName = "Case",
            LastName = "Worker",
            SecurityStamp = Guid.NewGuid().ToString(),
        };
        db.Users.Add(user);

        var membership = TenantMembership.Create(
            user.Id, tenantId,
            suspended ? TenantMembershipStatus.Suspended : TenantMembershipStatus.Active);
        db.TenantMemberships.Add(membership);
        await Task.CompletedTask;
        return membership;
    }
}
