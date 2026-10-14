using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Identity.Tests.Infrastructure;

public sealed class DevelopmentPlatformAdminBootstrapTests
{
    [Fact]
    public async Task Development_host_creates_configured_platform_admin_without_tenant_membership()
    {
        using var factory = new BootstrapFactory("Development", configureCredentials: true);
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        var admin = await userManager.FindByEmailAsync(BootstrapFactory.Email);

        Assert.NotNull(admin);
        Assert.True(admin.EmailConfirmed);
        Assert.Empty(admin.TenantMemberships);
        Assert.True(await userManager.IsInRoleAsync(admin, PlatformRole.PlatformAdmin));
        Assert.True((await userManager.CheckPasswordAsync(admin, BootstrapFactory.Password)));

        await DevelopmentPlatformAdminBootstrap.SeedIfConfiguredAsync(dbContext, userManager, configuration);
        Assert.Equal(1, await dbContext.Users.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Non_development_host_ignores_configured_bootstrap_credentials()
    {
        using var factory = new BootstrapFactory("Production", configureCredentials: true);
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        Assert.Null(await userManager.FindByEmailAsync(BootstrapFactory.Email));
    }

    private sealed class BootstrapFactory(string environment, bool configureCredentials)
        : WebApplicationFactory<Program>
    {
        public const string Email = "local.bootstrap@example.test";
        public const string Password = "Bootstrap-Test-Only-123!";
        private readonly string _databaseName = $"identity_bootstrap_{Guid.NewGuid():N}";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(environment);
            builder.UseSetting("Database:Provider", "inmemory");
            builder.UseSetting("Database:InMemoryName", _databaseName);
            builder.UseSetting("Jwt:Secret", "development-bootstrap-test-signing-key-0123456789");
            if (!configureCredentials)
                return;
            builder.UseSetting("DevelopmentBootstrap:PlatformAdmin:Email", Email);
            builder.UseSetting("DevelopmentBootstrap:PlatformAdmin:Password", Password);
        }
    }
}
