using System.Security.Claims;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Constants;
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
                
                // Assign demo tenant for local development
                await userManager.AddClaimAsync(admin, new Claim(CustomClaimTypes.TenantId, DemoConstants.TenantId.ToString()));
            }
        }
        else
        {
            // Ensure existing admin has the tenant claim (handles DB created before this fix)
            var existingClaims = await userManager.GetClaimsAsync(admin);
            if (!existingClaims.Any(c => c.Type == CustomClaimTypes.TenantId))
            {
                await userManager.AddClaimAsync(admin, new Claim(CustomClaimTypes.TenantId, DemoConstants.TenantId.ToString()));
            }
        }
    }
}