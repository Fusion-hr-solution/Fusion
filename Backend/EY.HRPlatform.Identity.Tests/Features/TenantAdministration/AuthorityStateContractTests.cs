using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.Accounts;
using EY.HRPlatform.Identity.Features.Membership;
using EY.HRPlatform.Identity.Features.TenantAdministration;
using EY.HRPlatform.Identity.Features.TenantProvisioning;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
using EY.HRPlatform.Identity.Middleware;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

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
    public async Task A_fresh_tenant_administrator_receives_and_serializes_canonical_Organization_grants()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var users = RelationalTestDatabase.CreateUserManager(world.Db);
        var administrator = await world.Db.Users.IgnoreQueryFilters()
            .SingleAsync(user => user.Id == world.FirstAccountId);
        var accessProfiles = new AccessProfileService(world.Db, users);

        var permissions = await accessProfiles.GetEffectivePermissionsAsync(administrator);
        Assert.Contains(permissions, grant => grant.PermissionKey == CorePermissions.OrganizationView
            && grant.Scope == PermissionScopes.Tenant);
        Assert.Contains(permissions, grant => grant.PermissionKey == CorePermissions.OrganizationManage
            && grant.Scope == PermissionScopes.Tenant);

        var configuration = TokenConfiguration();
        var context = new CustomerContextResolver(world.Db, users);
        var tokenService = new TokenService(configuration, users, accessProfiles, context);
        var token = await tokenService.GenerateAccessTokenAsync(administrator);
        var claims = new JwtSecurityTokenHandler().ReadJwtToken(token).Claims
            .Where(claim => claim.Type == CustomClaimTypes.CorePermission)
            .Select(claim => CorePermissionClaimValue.TryDecode(claim.Value, out var grant) ? grant : null)
            .OfType<EffectivePermissionGrant>()
            .ToList();

        Assert.Contains(claims, grant => grant.PermissionKey == CorePermissions.OrganizationView
            && grant.Scope == PermissionScopes.Tenant);
        Assert.Contains(claims, grant => grant.PermissionKey == CorePermissions.OrganizationManage
            && grant.Scope == PermissionScopes.Tenant);

        var session = await new AuthSessionFactory(
            users, tokenService, accessProfiles, world.Db, configuration, context).CreateAsync(administrator);
        Assert.Contains(session.EffectivePermissions, grant => grant.PermissionKey == CorePermissions.OrganizationView
            && grant.Scope == PermissionScopes.Tenant);
        Assert.Contains(session.EffectivePermissions, grant => grant.PermissionKey == CorePermissions.OrganizationManage
            && grant.Scope == PermissionScopes.Tenant);
    }

    [SkippableFact]
    public async Task Reseeding_repairs_canonical_administrator_grants_without_widening_Manager_Employee_or_Platform_access()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var world = await ArrangeAsync();
        var users = RelationalTestDatabase.CreateUserManager(world.Db);
        var accessProfiles = new AccessProfileService(world.Db, users);

        var definition = await world.Db.AccessProfiles.IgnoreQueryFilters()
            .Include(profile => profile.Grants)
            .SingleAsync(profile => profile.TenantId == world.TenantId
                && profile.InternalKey == TenantAdministratorAuthority.InternalKey);
        var obsoleteOrganizationGrants = definition.Grants
            .Where(grant => grant.PermissionKey is CorePermissions.OrganizationView or CorePermissions.OrganizationManage)
            .ToList();
        world.Db.AccessProfileGrants.RemoveRange(obsoleteOrganizationGrants);
        await world.Db.SaveChangesAsync();

        await accessProfiles.EnsureSeedDataAsync();
        world.Db.ChangeTracker.Clear();

        var refreshedDefinition = await world.Db.AccessProfiles.IgnoreQueryFilters()
            .Include(profile => profile.Grants)
            .SingleAsync(profile => profile.TenantId == world.TenantId
                && profile.InternalKey == TenantAdministratorAuthority.InternalKey);
        Assert.Contains(refreshedDefinition.Grants, grant => grant.PermissionKey == CorePermissions.OrganizationView
            && grant.Scope == PermissionScopes.Tenant);
        Assert.Contains(refreshedDefinition.Grants, grant => grant.PermissionKey == CorePermissions.OrganizationManage
            && grant.Scope == PermissionScopes.Tenant);

        var manager = await AddProfiledMemberAsync(world, users, "manager@atlas.example", "manager");
        var employee = await AddProfiledMemberAsync(world, users, "employee@atlas.example", "employee");
        var platformAdministrator = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = "platform@fusion.example", Email = "platform@fusion.example",
            FirstName = "Platform", LastName = "Administrator", IsActive = true, EmailConfirmed = true,
        };
        Assert.True((await users.CreateAsync(platformAdministrator, "Platform@123456")).Succeeded);
        world.Db.Roles.Add(new IdentityRole<Guid>
        {
            Name = PlatformRole.PlatformAdmin,
            NormalizedName = PlatformRole.PlatformAdmin.ToUpperInvariant(),
        });
        await world.Db.SaveChangesAsync();
        Assert.True((await users.AddToRoleAsync(platformAdministrator, PlatformRole.PlatformAdmin)).Succeeded);

        Assert.DoesNotContain(await accessProfiles.GetEffectivePermissionsAsync(manager),
            grant => grant.PermissionKey is CorePermissions.OrganizationView or CorePermissions.OrganizationManage);
        Assert.DoesNotContain(await accessProfiles.GetEffectivePermissionsAsync(employee),
            grant => grant.PermissionKey is CorePermissions.OrganizationView or CorePermissions.OrganizationManage);
        Assert.Empty(await accessProfiles.GetEffectivePermissionsAsync(platformAdministrator));
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

    private static IConfiguration TokenConfiguration()
        => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Secret"] = "a-test-secret-that-is-long-enough-for-hmac-sha256-signing",
            ["Jwt:Issuer"] = "fusion-tests",
            ["Jwt:Audience"] = "fusion-tests",
            ["Jwt:ExpirationInMinutes"] = "30",
            ["Jwt:RefreshTokenExpirationInDays"] = "7",
        }).Build();

    private static async Task<ApplicationUser> AddProfiledMemberAsync(
        World world, UserManager<ApplicationUser> users, string email, string profileKey)
    {
        var account = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email,
            FirstName = profileKey, LastName = "User", IsActive = true, EmailConfirmed = true,
        };
        Assert.True((await users.CreateAsync(account, "Member@123456")).Succeeded);
        var membership = TenantMembership.Create(account.Id, world.TenantId);
        world.Db.TenantMemberships.Add(membership);
        await world.Db.SaveChangesAsync();
        var profileId = await world.Db.AccessProfiles.IgnoreQueryFilters()
            .Where(profile => profile.TenantId == world.TenantId && profile.InternalKey == profileKey)
            .Select(profile => profile.Id).SingleAsync();
        world.Db.UserAccessProfiles.Add(UserAccessProfile.Create(world.TenantId, account.Id, profileId, membership.Id));
        await world.Db.SaveChangesAsync();
        return account;
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
