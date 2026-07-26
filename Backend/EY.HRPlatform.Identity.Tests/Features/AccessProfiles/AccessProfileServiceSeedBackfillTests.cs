using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Extensions;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Identity.Tests.Features.AccessProfiles;

public class AccessProfileServiceSeedBackfillTests
{
    [Fact]
    public async Task EnsureSeedDataAsync_BackfillsSeededProfilesForExistingRoleBasedUsers()
    {
        await using var provider = CreateServiceProvider();
        await using var scope = provider.CreateAsyncScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var accessProfileService = scope.ServiceProvider.GetRequiredService<IAccessProfileService>();

        await IdentitySeeder.SeedAsync(dbContext, roleManager, userManager, seedDemoData: false);

        var tenant = Tenant.Create(Guid.NewGuid(), "Backfill Tenant");
        dbContext.Tenants.Add(tenant);
        await dbContext.SaveChangesAsync();

        var user = new ApplicationUser
        {
            UserName = "employee.backfill@example.com",
            Email = "employee.backfill@example.com",
            FirstName = "Backfill",
            LastName = "Employee",
            TenantId = tenant.Id,
            EmailConfirmed = true,
        };

        var createResult = await userManager.CreateAsync(user, "Backfill1!");
        Assert.True(createResult.Succeeded, string.Join(", ", createResult.Errors.Select(error => error.Description)));
        Assert.True((await userManager.AddToRoleAsync(user, PlatformRole.Employee)).Succeeded);

        await accessProfileService.EnsureSeedDataAsync();

        var assignments = dbContext.UserAccessProfiles
            .Where(assignment => assignment.TenantId == tenant.Id && assignment.UserId == user.Id)
            .ToList();

        var employeeProfile = dbContext.AccessProfiles
            .Single(profile => profile.TenantId == tenant.Id && profile.Name == PlatformRole.Employee);

        Assert.Single(assignments);
        Assert.Equal(employeeProfile.Id, assignments[0].AccessProfileId);
    }

    [Fact]
    public async Task GetEffectivePermissionsAsync_BackfillsAssignmentsBeforeCompatibilityFallback()
    {
        await using var provider = CreateServiceProvider();
        await using var scope = provider.CreateAsyncScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var accessProfileService = scope.ServiceProvider.GetRequiredService<IAccessProfileService>();

        await IdentitySeeder.SeedAsync(dbContext, roleManager, userManager, seedDemoData: false);

        var tenant = Tenant.Create(Guid.NewGuid(), "Lazy Backfill Tenant");
        dbContext.Tenants.Add(tenant);
        await dbContext.SaveChangesAsync();

        var user = new ApplicationUser
        {
            UserName = "manager.lazy@example.com",
            Email = "manager.lazy@example.com",
            FirstName = "Lazy",
            LastName = "Manager",
            TenantId = tenant.Id,
            EmailConfirmed = true,
            EmployeeId = Guid.NewGuid(),
        };

        var createResult = await userManager.CreateAsync(user, "LazyBackfill1!");
        Assert.True(createResult.Succeeded, string.Join(", ", createResult.Errors.Select(error => error.Description)));
        Assert.True((await userManager.AddToRoleAsync(user, PlatformRole.Manager)).Succeeded);

        var permissions = await accessProfileService.GetEffectivePermissionsAsync(user);

        Assert.Contains(permissions, grant =>
            grant.PermissionKey == CorePermissions.TeamView
            && grant.Scope == PermissionScopes.DirectReports);
        Assert.Contains(permissions, grant =>
            grant.PermissionKey == CorePermissions.ProfileSelfView
            && grant.Scope == PermissionScopes.Self);
        Assert.Contains(permissions, grant =>
            grant.PermissionKey == PerformancePermissions.ObjectiveTeamApprove
            && grant.Scope == PermissionScopes.DirectReports);

        var assignments = dbContext.UserAccessProfiles
            .Where(assignment => assignment.TenantId == tenant.Id && assignment.UserId == user.Id)
            .ToList();

        var managerProfile = dbContext.AccessProfiles
            .Single(profile => profile.TenantId == tenant.Id && profile.Name == PlatformRole.Manager);

        Assert.Single(assignments);
        Assert.Equal(managerProfile.Id, assignments[0].AccessProfileId);
    }

    [Fact]
    public async Task EnsureSeedDataAsync_CreatesDirectionProfileWithStrategyViewOnly()
    {
        await using var provider = CreateServiceProvider();
        await using var scope = provider.CreateAsyncScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var accessProfileService = scope.ServiceProvider.GetRequiredService<IAccessProfileService>();

        await IdentitySeeder.SeedAsync(dbContext, roleManager, userManager, seedDemoData: false);

        var tenant = Tenant.Create(Guid.NewGuid(), "Direction Tenant");
        dbContext.Tenants.Add(tenant);
        await dbContext.SaveChangesAsync();

        await accessProfileService.EnsureSeedDataAsync();

        var directionProfile = dbContext.AccessProfiles
            .Single(profile => profile.TenantId == tenant.Id && profile.InternalKey == "direction");

        var grants = dbContext.AccessProfileGrants
            .Where(grant => grant.TenantId == tenant.Id && grant.AccessProfileId == directionProfile.Id)
            .ToList();

        Assert.Equal("Direction", directionProfile.Name);
        Assert.Single(grants);
        Assert.Equal(PerformancePermissions.StrategicView, grants[0].PermissionKey);
        Assert.Equal(PermissionScopes.Tenant, grants[0].Scope);
    }

    private static ServiceProvider CreateServiceProvider()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddMultitenancy();
        services.AddIdentityServices(CreateConfiguration(Guid.NewGuid().ToString("N")));
        return services.BuildServiceProvider();
    }

    private static IConfiguration CreateConfiguration(string databaseName)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "integration-test-secret-please-change",
                ["Jwt:Issuer"] = "test-issuer",
                ["Jwt:Audience"] = "test-audience",
                ["Database:Provider"] = "inmemory",
                ["Database:InMemoryName"] = databaseName,
            })
            .Build();
}
