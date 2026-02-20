using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using Microsoft.AspNetCore.Identity;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence;

public static class IdentitySeeder
{
    public static async Task SeedAsync(
        RoleManager<IdentityRole<Guid>> roleManager,
        UserManager<ApplicationUser> userManager)
    {
        // Create all roles if they don't exist
        foreach (var role in PlatformRole.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole<Guid>
                {
                    Name = role,
                    NormalizedName = role.ToUpperInvariant()
                });
            }
        }

        // Create default admin user if it doesn't exist
        const string adminEmail = "admin@ey-hr.com";
        if (await userManager.FindByEmailAsync(adminEmail) is null)
        {
            var admin = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                FirstName = "System",
                LastName = "Admin",
                Department = "IT",
                JobTitle = "Platform Administrator",
                HireDate = DateTime.UtcNow,
                EmailConfirmed = true
            };

            var result = await userManager.CreateAsync(admin, "Admin@123456");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(admin, PlatformRole.Admin);
                await userManager.AddToRoleAsync(admin, PlatformRole.HR);
            }
        }
    }
}