using EY.HRPlatform.DemoSeed;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Extensions;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Identity.Tests.Infrastructure;

public sealed class CanonicalIdentitySeederTests
{
    [Fact]
    public async Task Canonical_seed_is_idempotent_reconciles_passwords_and_assigns_access_profiles()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddMultitenancy();
        services.AddIdentityServices(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Secret"] = "integration-test-secret-please-change",
            ["Jwt:Issuer"] = "test-issuer",
            ["Jwt:Audience"] = "test-audience",
            ["Database:Provider"] = "inmemory",
            ["Database:InMemoryName"] = $"canonical-identity-{Guid.NewGuid():N}"
        }).Build());
        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        await IdentitySeeder.SeedAsync(db, roles, users, seedDemoData: true);
        await IdentitySeeder.SeedAsync(db, roles, users, seedDemoData: true);

        Assert.Equal(12, await users.Users.CountAsync());
        var manager = await users.FindByEmailAsync("flit.manager@atlas.example");
        Assert.NotNull(manager);
        Assert.True(await users.CheckPasswordAsync(manager!, CanonicalDemoSeed.TenantPassword));
        Assert.Contains(PlatformRole.Manager, await users.GetRolesAsync(manager!));
        Assert.NotEmpty(db.UserAccessProfiles.Where(item => item.UserId == manager!.Id));
        Assert.Equal(CanonicalDemoSeed.TenantId, manager!.TenantId);
    }
}
