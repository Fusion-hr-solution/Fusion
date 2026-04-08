using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Constants;
using System.Reflection;
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
                EmailConfirmed = true,
                TenantId = demoTenantId
            };

            var result = await userManager.CreateAsync(admin, "Admin@123456");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(admin, PlatformRole.PlatformAdmin);
                await userManager.AddToRoleAsync(admin, PlatformRole.HRAdmin);
            }
        }
        else
        {
            // Ensure existing admin has a TenantId (handles DB created before this migration)
            if (admin.TenantId == Guid.Empty)
            {
                admin.TenantId = demoTenantId;
                await userManager.UpdateAsync(admin);
            }
        }

        // Seed Platform Admin demo organizations (mature lifecycle states for local UI review).
        await SeedPlatformAdminDemoOrgsAsync(dbContext, userManager, admin.Id);
    }

    private static async Task SeedPlatformAdminDemoOrgsAsync(
        AppIdentityDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        Guid createdByUserId)
    {
        // Stable IDs so the seeded dataset is idempotent across restarts.
        var draftTenantId = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var invitedTenantId = Guid.Parse("00000000-0000-0000-0000-000000000003");
        var activeTenantId = Guid.Parse("00000000-0000-0000-0000-000000000004");
        var attentionTenantId = Guid.Parse("00000000-0000-0000-0000-000000000005");
        var suspendedTenantId = Guid.Parse("00000000-0000-0000-0000-000000000006");
        var archivedTenantId = Guid.Parse("00000000-0000-0000-0000-000000000007");

        var draftTenant = await GetOrCreateTenantAsync(dbContext, draftTenantId, "Demo Draft Org");
        var invitedTenant = await GetOrCreateTenantAsync(dbContext, invitedTenantId, "Demo Invited Org");
        var activeTenant = await GetOrCreateTenantAsync(dbContext, activeTenantId, "Demo Active Org");
        var attentionTenant = await GetOrCreateTenantAsync(dbContext, attentionTenantId, "Demo Attention Org");
        var suspendedTenant = await GetOrCreateTenantAsync(dbContext, suspendedTenantId, "Demo Suspended Org");
        var archivedTenant = await GetOrCreateTenantAsync(dbContext, archivedTenantId, "Demo Archived Org");

        // Suspended/Archived flags
        if (suspendedTenant.IsActive)
        {
            suspendedTenant.Deactivate();
            dbContext.Tenants.Update(suspendedTenant);
        }

        if (!archivedTenant.IsArchived)
        {
            archivedTenant.Archive();
            dbContext.Tenants.Update(archivedTenant);
        }

        // Create pending first-admin invite (Invited)
        const string invitedAdminEmail = "invited.admin@example.com";
        var invitedInviteExists = await dbContext.InviteTokens.AnyAsync(
            i => i.TenantId == invitedTenant.Id && i.Role == PlatformRole.HRAdmin && i.Email == invitedAdminEmail,
            CancellationToken.None);
        if (!invitedInviteExists)
        {
            var invite = InviteToken.Create(
                invitedAdminEmail,
                invitedTenant.Id,
                PlatformRole.HRAdmin,
                createdByUserId,
                firstName: "Invited",
                lastName: "Admin");
            dbContext.InviteTokens.Add(invite);
        }

        // Create an expired first-admin invite (Attention)
        const string attentionAdminEmail = "attention.admin@example.com";
        var attentionInviteExists = await dbContext.InviteTokens.AnyAsync(
            i => i.TenantId == attentionTenant.Id && i.Role == PlatformRole.HRAdmin && i.Email == attentionAdminEmail,
            CancellationToken.None);
        if (!attentionInviteExists)
        {
            var invite = InviteToken.Create(
                attentionAdminEmail,
                attentionTenant.Id,
                PlatformRole.HRAdmin,
                createdByUserId,
                expiryDays: 1);

            SetPrivateProperty(invite, "ExpiresAt", DateTime.UtcNow.AddMinutes(-10));
            dbContext.InviteTokens.Add(invite);
        }

        // Active tenant: create HRAdmin user + an accepted first-admin invite
        const string activeAdminEmail = "active.admin@example.com";
        var activeHrAdmin = await userManager.FindByEmailAsync(activeAdminEmail);
        if (activeHrAdmin is null)
        {
            activeHrAdmin = new ApplicationUser
            {
                UserName = activeAdminEmail,
                Email = activeAdminEmail,
                NormalizedEmail = activeAdminEmail.ToUpperInvariant(),
                FirstName = "Active",
                LastName = "Admin",
                Department = "Platform",
                JobTitle = "HR Admin",
                HireDate = DateTime.UtcNow,
                EmailConfirmed = true,
                TenantId = activeTenant.Id,
                IsActive = true,
                LastLoginAt = DateTime.UtcNow.AddMinutes(-30),
            };

            var createRes = await userManager.CreateAsync(activeHrAdmin, "Admin@1234");
            if (createRes.Succeeded)
                await userManager.AddToRoleAsync(activeHrAdmin, PlatformRole.HRAdmin);
        }

        const string activeInviteEmail = "active.firstadmin@example.com";
        var activeAcceptedInviteExists = await dbContext.InviteTokens.AnyAsync(
            i => i.TenantId == activeTenant.Id && i.Role == PlatformRole.HRAdmin && i.Email == activeInviteEmail,
            CancellationToken.None);
        if (!activeAcceptedInviteExists)
        {
            var invite = InviteToken.Create(
                activeInviteEmail,
                activeTenant.Id,
                PlatformRole.HRAdmin,
                createdByUserId,
                firstName: "Active",
                lastName: "Admin",
                expiryDays: 14);

            invite.MarkAccepted(activeHrAdmin!.Id);
            dbContext.InviteTokens.Add(invite);
        }

        // Ensure tenant state objects are persisted
        await dbContext.SaveChangesAsync();
    }

    private static async Task<Tenant> GetOrCreateTenantAsync(
        AppIdentityDbContext dbContext,
        Guid tenantId,
        string name)
    {
        var existing = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);
        if (existing is not null)
            return existing;

        var tenant = Tenant.Create(tenantId, name);
        dbContext.Tenants.Add(tenant);
        await dbContext.SaveChangesAsync();
        return tenant;
    }

    private static void SetPrivateProperty<T>(
        T instance,
        string propertyName,
        object value)
    {
        var prop = instance!.GetType().GetProperty(
            propertyName,
            BindingFlags.Instance | BindingFlags.Public);
        if (prop is null)
            throw new InvalidOperationException($"Property '{propertyName}' not found.");

        var setter = prop.GetSetMethod(true);
        if (setter is null)
            throw new InvalidOperationException($"No setter for '{propertyName}'.");

        setter.Invoke(instance, new[] { value });
    }
}