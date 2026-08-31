using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.TenantProvisioning;
using EY.HRPlatform.Identity.Features.WorkforceAccess;
using EY.HRPlatform.Identity.Features.WorkforceAccounts;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Tests.Features.WorkforceAccounts;

/// <summary>
/// Accepting a Workforce invitation creates the account, one Active membership, the
/// authoritative membership Employee binding, the reviewed baseline, the accepted
/// invitation, and the audit together — or none of them. The selector/secret credential is
/// verified by digest, a pre-cutover raw token is honoured transitionally, and an address or
/// Employee that is taken becomes administrator review rather than a duplicate. Proven
/// against real PostgreSQL.
/// </summary>
public sealed class WorkforceInvitationAcceptanceServiceTests : IAsyncLifetime
{
    private readonly RelationalTestDatabase _databases = new();
    private bool Available => _databases.Available;

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => _databases.DisposeAsync().AsTask();

    [SkippableFact]
    public async Task Accepting_a_credential_creates_an_active_membership_bound_to_the_employee()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var credential = await IssueInvitationAsync(world, useRawToken: false);

        var result = await Service(world.Db).AcceptAsync(
            new WorkforceAcceptanceRequest(credential, null, "Casey", "Rivera", "Str0ng!Passw0rd"),
            CancellationToken.None);

        Assert.Equal(WorkforceAcceptanceOutcome.Accepted, result.Outcome);

        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.TenantId == world.TenantId && m.UserId == result.AccountId);
        Assert.Equal(world.EmployeeId, membership.EmployeeId);      // authoritative binding
        Assert.Equal(TenantMembershipStatus.Active, membership.Status);

        var invite = await world.Db.InviteTokens.IgnoreQueryFilters().SingleAsync(i => i.EmployeeId == world.EmployeeId);
        Assert.Equal(InvitationState.Accepted, invite.State);

        var audit = await world.Db.AccessAuditEvents.IgnoreQueryFilters()
            .Where(e => e.ResourceId == membership.Id.ToString()).ToListAsync();
        Assert.Contains(audit, e => e.Action == WorkforceAccessAuditActions.AccountActivated);
    }

    [SkippableFact]
    public async Task A_pre_cutover_raw_token_is_still_accepted()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var rawToken = await IssueInvitationAsync(world, useRawToken: true);

        var result = await Service(world.Db).AcceptAsync(
            new WorkforceAcceptanceRequest(rawToken, null, "Casey", "Rivera", "Str0ng!Passw0rd"),
            CancellationToken.None);

        Assert.Equal(WorkforceAcceptanceOutcome.Accepted, result.Outcome);

        world.Db.ChangeTracker.Clear();
        var membership = await world.Db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(m => m.TenantId == world.TenantId && m.UserId == result.AccountId);
        Assert.Equal(world.EmployeeId, membership.EmployeeId);
    }

    [SkippableFact]
    public async Task A_wrong_secret_is_not_acceptable_and_creates_nothing()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var credential = await IssueInvitationAsync(world, useRawToken: false);
        var tampered = credential[..^3] + "xyz"; // same selector, wrong secret

        var result = await Service(world.Db).AcceptAsync(
            new WorkforceAcceptanceRequest(tampered, null, "Casey", "Rivera", "Str0ng!Passw0rd"),
            CancellationToken.None);

        Assert.Equal(WorkforceAcceptanceOutcome.NotAcceptable, result.Outcome);

        world.Db.ChangeTracker.Clear();
        Assert.Equal(0, await world.Db.TenantMemberships.IgnoreQueryFilters().CountAsync(m => m.TenantId == world.TenantId));
    }

    [SkippableFact]
    public async Task Accepting_twice_is_a_stable_already_accepted_replay()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var credential = await IssueInvitationAsync(world, useRawToken: false);

        var first = await Service(world.Db).AcceptAsync(
            new WorkforceAcceptanceRequest(credential, null, "Casey", "Rivera", "Str0ng!Passw0rd"),
            CancellationToken.None);
        Assert.Equal(WorkforceAcceptanceOutcome.Accepted, first.Outcome);

        world.Db.ChangeTracker.Clear();
        var second = await Service(world.Db).AcceptAsync(
            new WorkforceAcceptanceRequest(credential, null, "Casey", "Rivera", "Str0ng!Passw0rd"),
            CancellationToken.None);
        Assert.Equal(WorkforceAcceptanceOutcome.AlreadyAccepted, second.Outcome);

        world.Db.ChangeTracker.Clear();
        Assert.Equal(1, await world.Db.TenantMemberships.IgnoreQueryFilters().CountAsync(m => m.TenantId == world.TenantId));
    }

    [SkippableFact]
    public async Task An_address_taken_since_issue_becomes_administrator_review_not_a_duplicate()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var credential = await IssueInvitationAsync(world, useRawToken: false);

        // Someone now holds the invited address (e.g. it was linked another way).
        var squatter = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = world.Email,
            Email = world.Email,
            NormalizedEmail = world.Email.ToUpperInvariant(),
            NormalizedUserName = world.Email.ToUpperInvariant(),
            FirstName = "Already",
            LastName = "Here",
            SecurityStamp = Guid.NewGuid().ToString(),
        };
        world.Db.Users.Add(squatter);
        await world.Db.SaveChangesAsync();
        world.Db.ChangeTracker.Clear();

        var result = await Service(world.Db).AcceptAsync(
            new WorkforceAcceptanceRequest(credential, null, "Casey", "Rivera", "Str0ng!Passw0rd"),
            CancellationToken.None);

        Assert.Equal(WorkforceAcceptanceOutcome.ExistingAccountConflict, result.Outcome);

        world.Db.ChangeTracker.Clear();
        // No membership created; the refusal is recorded for administrator visibility.
        Assert.Equal(0, await world.Db.TenantMemberships.IgnoreQueryFilters().CountAsync(m => m.TenantId == world.TenantId));
        var invite = await world.Db.InviteTokens.IgnoreQueryFilters().SingleAsync(i => i.EmployeeId == world.EmployeeId);
        Assert.NotEqual(InvitationState.Accepted, invite.State);
    }

    [SkippableFact]
    public async Task An_employee_bound_since_issue_becomes_administrator_review()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var credential = await IssueInvitationAsync(world, useRawToken: false);

        // Another account got bound to this Employee since the invitation was issued.
        var other = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "other@atlas.example",
            Email = "other@atlas.example",
            NormalizedEmail = "OTHER@ATLAS.EXAMPLE",
            NormalizedUserName = "OTHER@ATLAS.EXAMPLE",
            FirstName = "Other",
            LastName = "Account",
            SecurityStamp = Guid.NewGuid().ToString(),
        };
        world.Db.Users.Add(other);
        var boundMembership = TenantMembership.Create(other.Id, world.TenantId);
        boundMembership.BindEmployee(world.EmployeeId);
        world.Db.TenantMemberships.Add(boundMembership);
        await world.Db.SaveChangesAsync();
        world.Db.ChangeTracker.Clear();

        var result = await Service(world.Db).AcceptAsync(
            new WorkforceAcceptanceRequest(credential, null, "Casey", "Rivera", "Str0ng!Passw0rd"),
            CancellationToken.None);

        Assert.Equal(WorkforceAcceptanceOutcome.EmployeeAlreadyLinked, result.Outcome);

        world.Db.ChangeTracker.Clear();
        // Only the pre-existing membership remains; no second one was created for this Employee.
        Assert.Equal(1, await world.Db.TenantMemberships.IgnoreQueryFilters()
            .CountAsync(m => m.TenantId == world.TenantId && m.EmployeeId == world.EmployeeId));
    }

    // ── plumbing ─────────────────────────────────────────

    private static WorkforceInvitationAcceptanceService Service(AppIdentityDbContext db)
        => new(db, RelationalTestDatabase.CreateUserManager(db), new AccessProfileService(db, RelationalTestDatabase.CreateUserManager(db)));

    private sealed record World(
        AppIdentityDbContext Db,
        Guid TenantId,
        Guid EmployeeId,
        Guid EmployeeProfileId,
        Guid CreatedByUserId,
        string Email);

    private async Task<World> ArrangeAsync()
    {
        var db = await _databases.CreateAsync("fusion_accept");
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(Tenant.Create(tenantId, "Atlas Group"));

        var employeeProfile = AccessProfile.Create(
            tenantId, "Employee", null, AccessProfileTypes.SystemSeeded, true, "employee");
        db.AccessProfiles.Add(employeeProfile);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        return new World(db, tenantId, Guid.NewGuid(), employeeProfile.Id, Guid.NewGuid(), "casey@atlas.example");
    }

    /// <summary>
    /// Issues a pending Workforce invitation with the reviewed baseline profile and returns
    /// the value the recipient presents: a selector/secret credential, or a legacy raw token.
    /// </summary>
    private async Task<string> IssueInvitationAsync(World world, bool useRawToken)
    {
        InviteToken invite;
        string presented;

        if (useRawToken)
        {
            invite = InviteToken.Create(
                world.Email, world.TenantId, EY.HRPlatform.SharedKernel.Auth.PlatformRole.Employee,
                world.CreatedByUserId, "Casey", "Rivera", world.EmployeeId);
            presented = invite.Token!;
        }
        else
        {
            invite = InviteToken.CreateWorkforce(
                world.Email, world.TenantId, EY.HRPlatform.SharedKernel.Auth.PlatformRole.Employee,
                world.CreatedByUserId, "Casey", "Rivera", world.EmployeeId);
            var credential = BootstrapCredential.Issue();
            invite.IssueCredential(credential.Selector, BootstrapCredential.Digest(credential.Secret));
            presented = credential.RawValue;
        }

        world.Db.InviteTokens.Add(invite);
        await world.Db.SaveChangesAsync();
        world.Db.ChangeTracker.Clear();

        await new AccessProfileService(world.Db, RelationalTestDatabase.CreateUserManager(world.Db))
            .SetInviteAccessProfilesAsync(world.TenantId, invite.Id, [world.EmployeeProfileId], CancellationToken.None);
        world.Db.ChangeTracker.Clear();

        return presented;
    }
}
