using System.Security.Claims;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Constants;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence;

public static class IdentitySeeder
{
    /// <summary>
    /// Seeds roles (always) and optionally demo data (controlled by seedDemoData parameter).
    /// </summary>
    public static async Task SeedAsync(
        AppIdentityDbContext dbContext,
        RoleManager<IdentityRole<Guid>> roleManager,
        UserManager<ApplicationUser> userManager,
        bool seedDemoData = false)
    {
        // 1. Create all roles if they don't exist (always runs)
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

        // 2. Demo data seeding (only when explicitly enabled via configuration)
        if (!seedDemoData)
            return;

        await SeedDemoDataAsync(dbContext, userManager);
    }

    private static async Task SeedDemoDataAsync(
        AppIdentityDbContext dbContext,
        UserManager<ApplicationUser> userManager)
    {
        var demoTenantId = DemoConstants.TenantId;

        // Seed demo tenant with idempotent upsert pattern (safe for multi-instance deployments)
        var existingTenant = await dbContext.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == demoTenantId);

        if (existingTenant is null)
        {
            try
            {
                var demoTenant = Tenant.Create(demoTenantId, "Demo Tenant");
                dbContext.Tenants.Add(demoTenant);
                await dbContext.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Another instance already inserted this tenant - safe to ignore
                dbContext.ChangeTracker.Clear();
            }
        }

        // Seed default admin user if it doesn't exist
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
                await userManager.AddClaimAsync(admin, new Claim(CustomClaimTypes.TenantId, demoTenantId.ToString()));
            }
        }
        else
        {
            // Ensure existing admin has the tenant claim (handles DB created before this fix)
            var existingClaims = await userManager.GetClaimsAsync(admin);
            if (!existingClaims.Any(c => c.Type == CustomClaimTypes.TenantId))
            {
                await userManager.AddClaimAsync(admin, new Claim(CustomClaimTypes.TenantId, demoTenantId.ToString()));
            }
        }
    }
}