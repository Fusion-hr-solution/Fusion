using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.Membership;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Tests.Features.Membership;

/// <summary>
/// Customer authority comes from exactly one Active membership. These tests pin
/// the cardinality rules that make a corrupted membership set fail closed rather
/// than silently select a tenant.
/// </summary>
public sealed class CustomerContextResolverTests
{
    private static readonly Guid TenantA = new("aaaaaaaa-0000-0000-0000-00000000000a");
    private static readonly Guid TenantB = new("bbbbbbbb-0000-0000-0000-00000000000b");

    private static ApplicationUser CreateAccount(string email) => new()
    {
        Id = Guid.NewGuid(),
        UserName = email,
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        NormalizedUserName = email.ToUpperInvariant(),
        FirstName = "Test",
        LastName = "User",
        SecurityStamp = Guid.NewGuid().ToString()
    };

    private static async Task<(AppIdentityDbContext Db, ICustomerContextResolver Resolver, ApplicationUser User)>
        ArrangeAsync(
            Action<AppIdentityDbContext, ApplicationUser> seed,
            bool isPlatformAdmin = false)
    {
        var dbName = Guid.NewGuid().ToString();
        var db = TestDbContextFactory.CreateWithoutTenant(dbName);
        var user = CreateAccount("member@example.com");

        db.Users.Add(user);
        db.Tenants.Add(Tenant.Create(TenantA, "Tenant A"));
        db.Tenants.Add(Tenant.Create(TenantB, "Tenant B"));
        await db.SaveChangesAsync();

        seed(db, user);
        await db.SaveChangesAsync();

        var userManager = new FakeRoleUserManager(isPlatformAdmin);
        return (db, new CustomerContextResolver(db, userManager), user);
    }

    [Fact]
    public async Task Exactly_one_active_membership_is_authoritative()
    {
        var (db, resolver, user) = await ArrangeAsync((context, account) =>
        {
            context.TenantMemberships.Add(TenantMembership.Create(account.Id, TenantA));
            context.TenantModuleEntitlements.Add(
                TenantModuleEntitlement.Create(TenantA, TenantModule.CoreHR));
        });

        await using var _ = db;
        var result = await resolver.ResolveAsync(user);

        Assert.True(result.IsAuthoritative);
        Assert.Equal(TenantA, result.Context!.TenantId);
        Assert.True(result.Context.HasModule(TenantModule.CoreHR));
        Assert.False(result.Context.HasModule(TenantModule.Performance));
    }

    [Fact]
    public async Task No_membership_produces_no_customer_context()
    {
        var (db, resolver, user) = await ArrangeAsync((_, _) => { });

        await using var _ = db;
        var result = await resolver.ResolveAsync(user);

        Assert.False(result.IsAuthoritative);
        Assert.Equal(CustomerContextDenial.NoActiveMembership, result.Denial);
    }

    [Fact]
    public async Task Inactive_membership_produces_no_customer_context()
    {
        var (db, resolver, user) = await ArrangeAsync((context, account) =>
        {
            var membership = TenantMembership.Create(account.Id, TenantA);
            membership.Deactivate();
            context.TenantMemberships.Add(membership);
        });

        await using var _ = db;
        var result = await resolver.ResolveAsync(user);

        // Ending the relationship revokes tenant authority without deleting history.
        Assert.False(result.IsAuthoritative);
        Assert.Equal(CustomerContextDenial.NoActiveMembership, result.Denial);
    }

    [Fact]
    public async Task Multiple_active_memberships_fail_closed()
    {
        var (db, resolver, user) = await ArrangeAsync((context, account) =>
        {
            context.TenantMemberships.Add(TenantMembership.Create(account.Id, TenantA));
            context.TenantMemberships.Add(TenantMembership.Create(account.Id, TenantB));
        });

        await using var _ = db;
        var result = await resolver.ResolveAsync(user);

        // No tenant is selected and no selector is offered.
        Assert.False(result.IsAuthoritative);
        Assert.Equal(CustomerContextDenial.MultipleActiveMemberships, result.Denial);
    }

    [Fact]
    public async Task Platform_administrator_never_receives_customer_context()
    {
        var (db, resolver, user) = await ArrangeAsync(
            (context, account) =>
            {
                // Even with a membership present, the control-plane role denies.
                context.TenantMemberships.Add(TenantMembership.Create(account.Id, TenantA));
            },
            isPlatformAdmin: true);

        await using var _ = db;
        var result = await resolver.ResolveAsync(user);

        Assert.False(result.IsAuthoritative);
        Assert.Equal(CustomerContextDenial.PlatformAdministrator, result.Denial);
    }

    [Fact]
    public async Task Entitlements_reflect_only_the_members_own_tenant()
    {
        var (db, resolver, user) = await ArrangeAsync((context, account) =>
        {
            context.TenantMemberships.Add(TenantMembership.Create(account.Id, TenantA));
            context.TenantModuleEntitlements.Add(
                TenantModuleEntitlement.Create(TenantA, TenantModule.CoreHR));
            // Another tenant's entitlement must not leak into this context.
            context.TenantModuleEntitlements.Add(
                TenantModuleEntitlement.Create(TenantB, TenantModule.Performance));
        });

        await using var _ = db;
        var result = await resolver.ResolveAsync(user);

        Assert.True(result.IsAuthoritative);
        Assert.Equal([TenantModule.CoreHR], result.Context!.EnabledModules);
    }

    /// <summary>
    /// Minimal UserManager stand-in: the resolver only asks whether the account
    /// holds the Platform Administrator role.
    /// </summary>
    private sealed class FakeRoleUserManager(bool isPlatformAdmin)
        : UserManager<ApplicationUser>(
            new FakeUserStore(), null!, null!, null!, null!, null!, null!, null!, null!)
    {
        public override Task<bool> IsInRoleAsync(ApplicationUser user, string role)
            => Task.FromResult(isPlatformAdmin && role == PlatformRole.PlatformAdmin);
    }

    private sealed class FakeUserStore : IUserStore<ApplicationUser>
    {
        public void Dispose() { }
        public Task<string> GetUserIdAsync(ApplicationUser user, CancellationToken _) => Task.FromResult(user.Id.ToString());
        public Task<string?> GetUserNameAsync(ApplicationUser user, CancellationToken _) => Task.FromResult(user.UserName);
        public Task SetUserNameAsync(ApplicationUser user, string? userName, CancellationToken _) => Task.CompletedTask;
        public Task<string?> GetNormalizedUserNameAsync(ApplicationUser user, CancellationToken _) => Task.FromResult(user.NormalizedUserName);
        public Task SetNormalizedUserNameAsync(ApplicationUser user, string? normalizedName, CancellationToken _) => Task.CompletedTask;
        public Task<IdentityResult> CreateAsync(ApplicationUser user, CancellationToken _) => Task.FromResult(IdentityResult.Success);
        public Task<IdentityResult> UpdateAsync(ApplicationUser user, CancellationToken _) => Task.FromResult(IdentityResult.Success);
        public Task<IdentityResult> DeleteAsync(ApplicationUser user, CancellationToken _) => Task.FromResult(IdentityResult.Success);
        public Task<ApplicationUser?> FindByIdAsync(string userId, CancellationToken _) => Task.FromResult<ApplicationUser?>(null);
        public Task<ApplicationUser?> FindByNameAsync(string normalizedUserName, CancellationToken _) => Task.FromResult<ApplicationUser?>(null);
    }
}
