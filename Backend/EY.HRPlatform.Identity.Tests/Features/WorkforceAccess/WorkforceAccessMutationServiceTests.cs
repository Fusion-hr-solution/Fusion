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
/// The mutation service re-resolves the candidate at commit and dispatches to the correct
/// atomic binding action — link an Active same-tenant account, reactivate-and-link a
/// suspended one, or connect an available global account by creating exactly one
/// membership. A requested action that no longer matches the current state fails closed as
/// Stale. Proven against real PostgreSQL, since membership creation, reactivation, and the
/// filtered unique index are what an in-memory provider cannot show.
/// </summary>
public sealed class WorkforceAccessMutationServiceTests : IAsyncLifetime
{
    private readonly RelationalTestDatabase _databases = new();
    private bool Available => _databases.Available;

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => _databases.DisposeAsync().AsTask();

    [SkippableFact]
    public async Task Link_binds_an_active_same_tenant_account_with_no_binding()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(MembershipShape.ActiveUnbound);

        var result = await Service(world.Db).MutateAsync(
            Request(world, WorkforceAccessMutationAction.Link), CancellationToken.None);

        Assert.Equal(WorkforceAccessMutationOutcome.Ok, result.Outcome);

        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.Id == world.MembershipId);
        Assert.Equal(world.EmployeeId, membership.EmployeeId);
        Assert.Equal(TenantMembershipStatus.Active, membership.Status);
    }

    [SkippableFact]
    public async Task ReactivateAndLink_reactivates_and_binds_a_suspended_membership()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(MembershipShape.Suspended);

        var result = await Service(world.Db).MutateAsync(
            Request(world, WorkforceAccessMutationAction.ReactivateAndLink), CancellationToken.None);

        Assert.Equal(WorkforceAccessMutationOutcome.Ok, result.Outcome);

        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.Id == world.MembershipId);
        Assert.Equal(TenantMembershipStatus.Active, membership.Status);
        Assert.Equal(world.EmployeeId, membership.EmployeeId);
    }

    [SkippableFact]
    public async Task Connect_creates_exactly_one_membership_and_binds_it()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(MembershipShape.NoMembershipHere);

        var result = await Service(world.Db).MutateAsync(
            Request(world, WorkforceAccessMutationAction.Connect), CancellationToken.None);

        Assert.Equal(WorkforceAccessMutationOutcome.Ok, result.Outcome);

        world.Db.ChangeTracker.Clear();
        var here = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .Where(m => m.TenantId == world.TenantId && m.UserId == world.UserId)
            .ToListAsync();
        var membership = Assert.Single(here);
        Assert.Equal(world.EmployeeId, membership.EmployeeId);
        Assert.Equal(TenantMembershipStatus.Active, membership.Status);
    }

    [SkippableFact]
    public async Task A_link_requested_against_a_now_active_account_is_stale()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        // The account is already bound to this very Employee, so the state is Active.
        var world = await ArrangeAsync(MembershipShape.ActiveBoundToThisEmployee);

        var result = await Service(world.Db).MutateAsync(
            Request(world, WorkforceAccessMutationAction.Link), CancellationToken.None);

        Assert.Equal(WorkforceAccessMutationOutcome.Stale, result.Outcome);
        Assert.Equal(nameof(WorkforceAccountCandidateOutcome.Active), result.AccountState);
    }

    [SkippableFact]
    public async Task Connect_refuses_when_a_membership_already_exists_here()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        // Requesting Connect when the account actually has an Active membership here: the
        // resolver says ExistingAccountReadyToLink, so Connect is stale, and no second
        // membership is ever created.
        var world = await ArrangeAsync(MembershipShape.ActiveUnbound);

        var result = await Service(world.Db).MutateAsync(
            Request(world, WorkforceAccessMutationAction.Connect), CancellationToken.None);

        Assert.Equal(WorkforceAccessMutationOutcome.Stale, result.Outcome);

        world.Db.ChangeTracker.Clear();
        var here = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .CountAsync(m => m.TenantId == world.TenantId && m.UserId == world.UserId);
        Assert.Equal(1, here);
    }

    // ── plumbing ─────────────────────────────────────────

    private static IWorkforceAccessMutationService Service(AppIdentityDbContext db)
        => new WorkforceAccessMutationService(
            new WorkforceAccountCandidateResolver(db),
            new WorkforceIdentityBindingService(
                new TenantContinuityCommandExecutor(db),
                new WorkforceBaselineService(db)));

    private static WorkforceAccessMutationRequest Request(World world, WorkforceAccessMutationAction action)
        => new(
            world.TenantId, world.EmployeeId, world.WorkEmail, action, WorkforceBaseline.Employee,
            ActingUserId: Guid.NewGuid(), ActorName: "Hr Manager", ActorRole: "HR Admin");

    private enum MembershipShape
    {
        ActiveUnbound,
        Suspended,
        NoMembershipHere,
        ActiveBoundToThisEmployee,
    }

    private sealed record World(
        AppIdentityDbContext Db,
        Guid TenantId,
        Guid UserId,
        Guid? MembershipId,
        Guid EmployeeId,
        string WorkEmail);

    private async Task<World> ArrangeAsync(MembershipShape shape)
    {
        var db = await _databases.CreateAsync("fusion_mutation");
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(Tenant.Create(tenantId, "Atlas Group"));

        db.AccessProfiles.AddRange(
            AccessProfile.Create(tenantId, "Employee", null, AccessProfileTypes.SystemSeeded, true, "employee"),
            AccessProfile.Create(tenantId, "Manager", null, AccessProfileTypes.SystemSeeded, true, "manager"));

        const string email = "casey@atlas.example";
        var employeeId = Guid.NewGuid();
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            FirstName = "Casey",
            LastName = "Rivera",
            SecurityStamp = Guid.NewGuid().ToString(),
        };
        db.Users.Add(user);

        Guid? membershipId = null;
        switch (shape)
        {
            case MembershipShape.ActiveUnbound:
            {
                var membership = TenantMembership.Create(user.Id, tenantId, TenantMembershipStatus.Active);
                db.TenantMemberships.Add(membership);
                membershipId = membership.Id;
                break;
            }

            case MembershipShape.Suspended:
            {
                var membership = TenantMembership.Create(user.Id, tenantId, TenantMembershipStatus.Suspended);
                db.TenantMemberships.Add(membership);
                membershipId = membership.Id;
                break;
            }

            case MembershipShape.ActiveBoundToThisEmployee:
            {
                var membership = TenantMembership.Create(user.Id, tenantId, TenantMembershipStatus.Active);
                membership.BindEmployee(employeeId);
                db.TenantMemberships.Add(membership);
                membershipId = membership.Id;
                break;
            }

            case MembershipShape.NoMembershipHere:
                // No membership in this tenant: the account is available to connect.
                break;
        }

        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        return new World(db, tenantId, user.Id, membershipId, employeeId, email);
    }
}
