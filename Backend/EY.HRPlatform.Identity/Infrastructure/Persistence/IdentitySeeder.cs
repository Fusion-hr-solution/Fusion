using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using Microsoft.AspNetCore.Identity;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence;

public static class IdentitySeeder
{
    // Well-known tenant ID for demo/dev - matches CoreHRSeeder.DemoTenantId
    public static readonly Guid DemoTenantId = new("019d0000-0000-7000-0000-000000000001");

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
        var admin = await userManager.FindByEmailAsync(adminEmail);
        
        if (admin is null)
        {
            admin = new ApplicationUser
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
                // Add tenant_id claim for CoreHR access
                await userManager.AddClaimAsync(admin, 
                    new System.Security.Claims.Claim("tenant_id", DemoTenantId.ToString()));
            }
        }
        else
        {
            // Ensure existing admin has tenant_id claim
            var claims = await userManager.GetClaimsAsync(admin);
            if (!claims.Any(c => c.Type == "tenant_id"))
            {
                await userManager.AddClaimAsync(admin,
                    new System.Security.Claims.Claim("tenant_id", DemoTenantId.ToString()));
            }
        }
    }
}