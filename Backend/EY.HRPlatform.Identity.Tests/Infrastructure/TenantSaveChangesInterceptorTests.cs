using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Tests.Infrastructure;

public class TenantSaveChangesInterceptorTests
{
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();

    private static ApplicationUser CreateUser(Guid tenantId, string email) => new()
    {
        Id = Guid.NewGuid(),
        UserName = email,
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        NormalizedUserName = email.ToUpperInvariant(),
        FirstName = "Test",
        LastName = "User",
        TenantId = tenantId,
        SecurityStamp = Guid.NewGuid().ToString()
    };

    // ── Add ──────────────────────────────────────────────

    [Fact]
    public async Task Add_WithMatchingTenant_Succeeds()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantCtx = TestTenantContext.WithTenant(TenantA);
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);

        ctx.Users.Add(CreateUser(TenantA, "a@test.com"));

        var saved = await ctx.SaveChangesAsync();
        Assert.Equal(1, saved);
    }

    [Fact]
    public async Task Add_WithMismatchedTenant_Throws()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantCtx = TestTenantContext.WithTenant(TenantA);
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);

        ctx.Users.Add(CreateUser(TenantB, "b@test.com"));

        await Assert.ThrowsAsync<TenantAccessDeniedException>(() => ctx.SaveChangesAsync());
    }

    [Fact]
    public async Task Add_WithEmptyTenantId_Throws()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantCtx = TestTenantContext.WithTenant(TenantA);
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);

        ctx.Users.Add(CreateUser(Guid.Empty, "empty@test.com"));

        await Assert.ThrowsAsync<TenantAccessDeniedException>(() => ctx.SaveChangesAsync());
    }

    [Fact]
    public async Task Add_WithUnresolvedTenant_Throws()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantCtx = TestTenantContext.Unresolved();
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);

        ctx.Users.Add(CreateUser(TenantA, "a@test.com"));

        await Assert.ThrowsAsync<TenantAccessDeniedException>(() => ctx.SaveChangesAsync());
    }

    // ── Modify ───────────────────────────────────────────

    [Fact]
    public async Task Modify_WithMatchingTenant_Succeeds()
    {
        var dbName = Guid.NewGuid().ToString();

        // Seed
        await using (var seedCtx = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedCtx.Users.Add(CreateUser(TenantA, "a@test.com"));
            await seedCtx.SaveChangesAsync();
        }

        // Act
        var tenantCtx = TestTenantContext.WithTenant(TenantA);
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);
        var user = ctx.Users.First();
        user.FirstName = "Updated";

        var saved = await ctx.SaveChangesAsync();
        Assert.Equal(1, saved);
    }

    [Fact]
    public async Task Modify_ChangeTenantId_Throws()
    {
        var dbName = Guid.NewGuid().ToString();

        // Seed
        await using (var seedCtx = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedCtx.Users.Add(CreateUser(TenantA, "a@test.com"));
            await seedCtx.SaveChangesAsync();
        }

        // Act — change TenantId
        var tenantCtx = TestTenantContext.WithTenant(TenantA);
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);
        var user = ctx.Users.First();
        user.TenantId = TenantB;

        await Assert.ThrowsAsync<TenantAccessDeniedException>(() => ctx.SaveChangesAsync());
    }

    // ── Delete ───────────────────────────────────────────

    [Fact]
    public async Task Delete_WithMatchingTenant_Succeeds()
    {
        var dbName = Guid.NewGuid().ToString();

        // Seed
        await using (var seedCtx = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedCtx.Users.Add(CreateUser(TenantA, "a@test.com"));
            await seedCtx.SaveChangesAsync();
        }

        // Act
        var tenantCtx = TestTenantContext.WithTenant(TenantA);
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);
        var user = ctx.Users.First();
        ctx.Users.Remove(user);

        var saved = await ctx.SaveChangesAsync();
        Assert.Equal(1, saved);
    }

    [Fact]
    public async Task Delete_WithMismatchedTenant_Throws()
    {
        var dbName = Guid.NewGuid().ToString();

        // Seed user belonging to TenantA
        await using (var seedCtx = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedCtx.Users.Add(CreateUser(TenantA, "a@test.com"));
            await seedCtx.SaveChangesAsync();
        }

        // Act — try to delete with TenantB context
        var tenantCtx = TestTenantContext.WithTenant(TenantB);
        // Use IgnoreQueryFilters so we can load the TenantA entity despite TenantB context
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);
        var user = await ctx.Users.IgnoreQueryFilters().FirstAsync();
        ctx.Users.Remove(user);

        await Assert.ThrowsAsync<TenantAccessDeniedException>(() => ctx.SaveChangesAsync());
    }

    // ── InviteToken ──────────────────────────────────────

    [Fact]
    public async Task AddInviteToken_WithMatchingTenant_Succeeds()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantCtx = TestTenantContext.WithTenant(TenantA);
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);

        ctx.Tenants.Add(Tenant.Create(TenantA, "Tenant A"));
        await ctx.SaveChangesAsync();

        ctx.ChangeTracker.Clear();

        // InviteToken is not ITenantEntity in the context of the interceptor check for Tenant entity,
        // but InviteToken IS ITenantEntity, so its TenantId must match
        var invite = InviteToken.Create("invite@test.com", TenantA, PlatformRole.Employee, Guid.NewGuid());
        ctx.InviteTokens.Add(invite);

        var saved = await ctx.SaveChangesAsync();
        Assert.Equal(1, saved);
    }

    [Fact]
    public async Task AddInviteToken_WithMismatchedTenant_Throws()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantCtx = TestTenantContext.WithTenant(TenantA);
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);

        // Seed the foreign key tenant
        ctx.Tenants.Add(Tenant.Create(TenantB, "Tenant B"));
        await ctx.SaveChangesAsync();

        ctx.ChangeTracker.Clear();

        // Create invite for TenantB but context is TenantA
        var invite = InviteToken.Create("invite@test.com", TenantB, PlatformRole.Employee, Guid.NewGuid());
        ctx.InviteTokens.Add(invite);

        await Assert.ThrowsAsync<TenantAccessDeniedException>(() => ctx.SaveChangesAsync());
    }

    // ── Non-tenant entities pass through ─────────────────

    [Fact]
    public async Task AddRefreshToken_NoTenantCheck()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantCtx = TestTenantContext.WithTenant(TenantA);
        await using var ctx = TestDbContextFactory.CreateWithInterceptor(tenantCtx, dbName);

        ctx.RefreshTokens.Add(new RefreshToken
        {
            UserId = Guid.NewGuid(),
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        });

        var saved = await ctx.SaveChangesAsync();
        Assert.Equal(1, saved);
    }
}
