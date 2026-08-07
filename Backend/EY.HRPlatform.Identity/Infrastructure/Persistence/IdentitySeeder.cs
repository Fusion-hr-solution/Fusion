using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence;

/// <summary>
/// Seeds platform roles and access-profile definitions required by the running Identity service.
/// Customer tenants and workforce data are created through their supported product workflows.
/// </summary>
public static class IdentitySeeder
{
    public static async Task SeedAsync(
        AppIdentityDbContext dbContext,
        RoleManager<IdentityRole<Guid>> roleManager,
        UserManager<ApplicationUser> userManager)
    {
        foreach (var role in PlatformRole.All)
        {
            if (await roleManager.RoleExistsAsync(role))
                continue;

            var result = await roleManager.CreateAsync(new IdentityRole<Guid>
            {
                Name = role,
                NormalizedName = role.ToUpperInvariant()
            });
            if (!result.Succeeded)
                throw new InvalidOperationException(
                    $"Failed to create role {role}: {string.Join(", ", result.Errors.Select(error => error.Description))}");
        }

        await new AccessProfileService(dbContext, userManager).EnsureSeedDataAsync();
    }
}
