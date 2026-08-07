using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.TenantAdministration;
using EY.HRPlatform.Identity.Features.TenantProvisioning;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Middleware;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Identity.Tests.Features.TenantAdministration;

/// <summary>
/// The authority decision the Gateway asks for on every authenticated customer
/// request.
/// <para>
/// Each denial reason is asserted separately because the frontend acts on them
/// differently: a suspension is something an administrator can explain to the
/// person, a stale revision means "sign in again", and an unreachable authority
/// is an outage. Collapsing them into one boolean would make all three look the
/// same to the person who has just been logged out.
/// </para>
/// </summary>
public sealed class AuthorityStateContractTests : IAsyncLifetime
{
    private readonly RelationalTestDatabase _databases = new();
    private bool Available => _databases.Available;

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => _databases.DisposeAsync().AsTask();

    [SkippableFact]
    public async Task A_current_token_is_authorized()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();

        var state = await AskAsync(world, world.Revision);

        Assert.True(state.Valid);
        Assert.Null(state.Reason);
    }

    [SkippableFact]
    public async Task A_token_issued_before_a_suspension_is_rejected_on_the_very_next_request()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(secondAdministrator: true);
        var revisionAtSignIn = await RevisionAsync(world.Db, world.SecondMembershipId!.Value);

        await new TenantAdministratorLifecycleService(world.Db, new TenantContinuityCommandExecutor(world.Db))
            .SuspendAsync(new AdministratorCommand(
                world.TenantId, world.SecondMembershipId.Value, world.FirstAccountId));

        var state = await AskAsync(world, revisionAtSignIn, world.SecondMembershipId.Value, world.SecondAccountId);

        // Suspension is reported ahead of the stale revision because it is the
        // more specific and more useful truth.
        Assert.False(state.Valid);
        Assert.Equal(TenantAuthorityDenialReasons.MembershipSuspended, state.Reason);
    }

    [SkippableFact]
    public async Task A_stale_revision_alone_is_rejected()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(secondAdministrator: true);
        var membershipId = world.SecondMembershipId!.Value;
        var revisionAtSignIn = await RevisionAsync(world.Db, membershipId);

        // Authority removed while the membership stays Active: the person can
        // still enter the tenant, but not with this token.
        await new TenantAdministratorLifecycleService(world.Db, new TenantContinuityCommandExecutor(world.Db))
            .RevokeAuthorityAsync(new AdministratorCommand(
                world.TenantId, membershipId, world.FirstAccountId));

        var state = await AskAsync(world, revisionAtSignIn, membershipId, world.SecondAccountId);

        Assert.False(state.Valid);
        Assert.Equal(TenantAuthorityDenialReasons.RevisionStale, state.Reason);
    }

    [SkippableFact]
    public async Task A_direct_identity_request_cannot_bypass_revision_enforcement()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(secondAdministrator: true);
        var membershipId = world.SecondMembershipId!.Value;
        var accountId = world.SecondAccountId!.Value;
        var revisionAtSignIn = await RevisionAsync(world.Db, membershipId);

        await new TenantAdministratorLifecycleService(world.Db, new TenantContinuityCommandExecutor(world.Db))
            .RevokeAuthorityAsync(new AdministratorCommand(
                world.TenantId, membershipId, world.FirstAccountId));

        world.Db.ChangeTracker.Clear();
        var downstreamReached = false;
        var middleware = new TenantAuthorityRevisionMiddleware(_ =>
        {
            downstreamReached = true;
            return Task.CompletedTask;
        });
        var http = new DefaultHttpContext();
        http.Request.Path = "/api/identity/tenant-access/invitations";
        http.Response.Body = new MemoryStream();
        http.User = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, accountId.ToString()),
            new Claim(CustomClaimTypes.TenantId, world.TenantId.ToString()),
            new Claim(CustomClaimTypes.TenantMembershipId, membershipId.ToString()),
            new Claim(CustomClaimTypes.MembershipAccessRevision, revisionAtSignIn.ToString()),
        ], "test"));

        await middleware.InvokeAsync(http, world.Db);

        Assert.False(downstreamReached);
        Assert.Equal(StatusCodes.Status401Unauthorized, http.Response.StatusCode);
    }

    [SkippableFact]
    public async Task A_stale_compatibility_role_cannot_recreate_removed_authority()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync(secondAdministrator: true);
        var membershipId = world.SecondMembershipId!.Value;
        var accountId = world.SecondAccountId!.Value;
        var account = await world.Db.Users.IgnoreQueryFilters().SingleAsync(user => user.Id == accountId);
        var users = RelationalTestDatabase.CreateUserManager(world.Db);
        var legacyProfileIds = await world.Db.AccessProfiles
            .IgnoreQueryFilters()
            .Where(profile => profile.TenantId == world.TenantId
                && profile.Type == AccessProfileTypes.SystemSeeded
                && profile.InternalKey != TenantAdministratorAuthority.InternalKey)
            .Select(profile => profile.Id)
            .ToListAsync();
        world.Db.UserAccessProfiles.AddRange(legacyProfileIds.Select(profileId =>
            UserAccessProfile.Create(world.TenantId, accountId, profileId, membershipId)));
        await world.Db.SaveChangesAsync();

        Assert.Contains(PlatformRole.OrgAdmin, await users.GetRolesAsync(account));

        await new TenantAdministratorLifecycleService(world.Db, new TenantContinuityCommandExecutor(world.Db))
            .RevokeAuthorityAsync(new AdministratorCommand(
                world.TenantId, membershipId, world.FirstAccountId));

        world.Db.ChangeTracker.Clear();
        var service = new AccessProfileService(world.Db, users);
        var permissions = await service.GetEffectivePermissionsAsync(account);
        var profiles = await service.GetAssignedProfilesAsync(account);

        Assert.Empty(permissions);
        Assert.Empty(profiles);
        Assert.Equal(legacyProfileIds.Count, await world.Db.UserAccessProfiles.IgnoreQueryFilters()
            .CountAsync(assignment => assignment.UserId == accountId
                && legacyProfileIds.Contains(assignment.AccessProfileId)));
    }

    [SkippableFact]
    public async Task A_disabled_account_is_rejected()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();

        await world.Db.Database.ExecuteSqlRawAsync(
            "UPDATE identity.\"AspNetUsers\" SET \"IsActive\" = false WHERE \"Id\" = {0}",
            world.FirstAccountId);
        world.Db.ChangeTracker.Clear();

        var state = await AskAsync(world, world.Revision);

        Assert.Equal(TenantAuthorityDenialReasons.AccountDisabled, state.Reason);
    }

    [SkippableFact]
    public async Task An_archived_tenant_is_rejected()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();

        await world.Db.Database.ExecuteSqlRawAsync(
            "UPDATE identity.\"Tenants\" SET \"IsActive\" = false WHERE \"Id\" = {0}", world.TenantId);
        world.Db.ChangeTracker.Clear();

        var state = await AskAsync(world, world.Revision);

        Assert.Equal(TenantAuthorityDenialReasons.TenantInactive, state.Reason);
    }

    [SkippableFact]
    public async Task A_token_naming_another_tenants_membership_is_rejected()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();

        // A forged tenant claim finds no membership matching all three
        // identifiers, so it cannot borrow another tenant's authority.
        var state = await AskAsync(world, world.Revision, tenantOverride: Guid.NewGuid());

        Assert.Equal(TenantAuthorityDenialReasons.MembershipMismatch, state.Reason);
    }

    [SkippableFact]
    public async Task An_unsigned_request_is_refused()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();

        var controller = Controller(world.Db, authorized: false);
        var result = await controller.AuthorityState(
            new TenantAuthorityStateRequest(world.FirstAccountId, world.TenantId, world.FirstMembershipId, 1),
            CancellationToken.None);

        // The endpoint reveals whether a membership is currently authorized, so it
        // is only for signed internal callers.
        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    // ── plumbing ─────────────────────────────────────────

    private static async Task<TenantAuthorityStateResponse> AskAsync(
        World world,
        int revision,
        Guid? membershipOverride = null,
        Guid? accountOverride = null,
        Guid? tenantOverride = null)
    {
        world.Db.ChangeTracker.Clear();

        var result = await Controller(world.Db, authorized: true).AuthorityState(
            new TenantAuthorityStateRequest(
                accountOverride ?? world.FirstAccountId,
                tenantOverride ?? world.TenantId,
                membershipOverride ?? world.FirstMembershipId,
                revision),
            CancellationToken.None);

        return Assert.IsType<TenantAuthorityStateResponse>(
            Assert.IsType<OkObjectResult>(result.Result).Value);
    }

    private static InternalTenantAccessController Controller(AppIdentityDbContext db, bool authorized)
        => new(new StubAuthorizer(authorized), db)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

    private static Task<int> RevisionAsync(AppIdentityDbContext db, Guid membershipId)
    {
        db.ChangeTracker.Clear();
        return db.TenantMemberships.IgnoreQueryFilters()
            .Where(item => item.Id == membershipId).Select(item => item.AccessRevision).SingleAsync();
    }

    private sealed class StubAuthorizer(bool authorized) : IInternalServiceRequestAuthorizer
    {
        public Task<bool> AuthorizeAsync(HttpRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(authorized);
    }

    private sealed record World(
        AppIdentityDbContext Db,
        Guid TenantId,
        Guid FirstAccountId,
        Guid FirstMembershipId,
        int Revision,
        Guid? SecondAccountId,
        Guid? SecondMembershipId);

    private async Task<World> ArrangeAsync(bool secondAdministrator = false)
    {
        var db = await _databases.CreateAsync("fusion_authority");
        var bootstrap = new CapturingBootstrapDelivery();

        var provisioned = await new TenantProvisioningService(db, bootstrap).ProvisionAsync(
            new ProvisionTenantRequest
            {
                Name = "Atlas Group",
                TimeZone = "Europe/Paris",
                AdministratorEmail = "first.admin@atlas.example",
                IdempotencyKey = $"authority-{Guid.NewGuid():N}",
            },
            Guid.NewGuid());

        db.ChangeTracker.Clear();

        var users = RelationalTestDatabase.CreateUserManager(db);
        var activation = await new BootstrapActivationService(db, users, new AccessProfileService(db, users))
            .ActivateAsync(new BootstrapActivationRequest
            {
                Credential = bootstrap.Credential!.RawValue,
                Email = "first.admin@atlas.example",
                Password = "Bootstrap@123456",
                FirstName = "Ada",
                LastName = "Admin",
            });

        db.ChangeTracker.Clear();

        var tenantId = provisioned.Value.TenantId;
        var firstAccountId = activation.AccountId!.Value;
        var first = await db.TenantMemberships.IgnoreQueryFilters()
            .SingleAsync(item => item.UserId == firstAccountId);

        Guid? secondAccountId = null;
        Guid? secondMembershipId = null;

        if (secondAdministrator)
        {
            var delivery = new SilentDelivery();
            await new AdministratorInvitationService(db, users, delivery)
                .IssueAsync(tenantId, "second.admin@atlas.example", firstAccountId);
            db.ChangeTracker.Clear();

            var accepted = await new AdministrativeInvitationAcceptanceService(
                    db, users, new AccessProfileService(db, users))
                .AcceptAsync(new AdministrativeAcceptanceRequest
                {
                    Credential = delivery.Credential!.RawValue,
                    Email = "second.admin@atlas.example",
                    Password = "Administrator@123456",
                    FirstName = "Bea",
                    LastName = "Admin",
                });

            db.ChangeTracker.Clear();
            secondAccountId = accepted.AccountId;
            secondMembershipId = await db.TenantMemberships.IgnoreQueryFilters()
                .Where(item => item.UserId == accepted.AccountId).Select(item => item.Id).SingleAsync();
        }

        return new World(
            db, tenantId, firstAccountId, first.Id, first.AccessRevision, secondAccountId, secondMembershipId);
    }

    private sealed class CapturingBootstrapDelivery : IBootstrapInvitationDelivery
    {
        public BootstrapCredential? Credential { get; private set; }

        public Task DeliverAsync(Guid invitationId, string email, BootstrapCredential credential,
            Guid initiatedByAccountId, CancellationToken cancellationToken = default)
        {
            Credential = credential;
            return Task.CompletedTask;
        }
    }

    private sealed class SilentDelivery : IAdministrativeInvitationDelivery
    {
        public BootstrapCredential? Credential { get; private set; }

        public Task DeliverAsync(Guid invitationId, string email, BootstrapCredential credential,
            InvitationPurpose purpose, Guid initiatedByAccountId, CancellationToken cancellationToken = default)
        {
            Credential = credential;
            return Task.CompletedTask;
        }
    }
}
