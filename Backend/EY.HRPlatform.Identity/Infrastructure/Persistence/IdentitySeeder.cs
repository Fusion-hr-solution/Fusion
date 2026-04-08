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
        // Doubled dataset for pagination demonstration
        var draftTenantId1 = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var draftTenantId2 = Guid.Parse("00000000-0000-0000-0000-000000000012");
        var invitedTenantId1 = Guid.Parse("00000000-0000-0000-0000-000000000003");
        var invitedTenantId2 = Guid.Parse("00000000-0000-0000-0000-000000000013");
        var activeTenantId1 = Guid.Parse("00000000-0000-0000-0000-000000000004");
        var activeTenantId2 = Guid.Parse("00000000-0000-0000-0000-000000000014");
        var activeTenantId3 = Guid.Parse("00000000-0000-0000-0000-000000000024");
        var attentionTenantId1 = Guid.Parse("00000000-0000-0000-0000-000000000005");
        var attentionTenantId2 = Guid.Parse("00000000-0000-0000-0000-000000000015");
        var suspendedTenantId1 = Guid.Parse("00000000-0000-0000-0000-000000000006");
        var suspendedTenantId2 = Guid.Parse("00000000-0000-0000-0000-000000000016");
        var archivedTenantId = Guid.Parse("00000000-0000-0000-0000-000000000007");

        var draftTenant1 = await GetOrCreateTenantAsync(dbContext, draftTenantId1, "Acme Corp");
        var draftTenant2 = await GetOrCreateTenantAsync(dbContext, draftTenantId2, "Beta Industries");
        var invitedTenant1 = await GetOrCreateTenantAsync(dbContext, invitedTenantId1, "Contoso Ltd");
        var invitedTenant2 = await GetOrCreateTenantAsync(dbContext, invitedTenantId2, "Delta Systems");
        var activeTenant1 = await GetOrCreateTenantAsync(dbContext, activeTenantId1, "Echo Enterprises");
        var activeTenant2 = await GetOrCreateTenantAsync(dbContext, activeTenantId2, "Fabrikam Group");
        var activeTenant3 = await GetOrCreateTenantAsync(dbContext, activeTenantId3, "Globex Corporation");
        var attentionTenant1 = await GetOrCreateTenantAsync(dbContext, attentionTenantId1, "Horizon Partners");
        var attentionTenant2 = await GetOrCreateTenantAsync(dbContext, attentionTenantId2, "Initech Solutions");
        var suspendedTenant1 = await GetOrCreateTenantAsync(dbContext, suspendedTenantId1, "Juno Ventures");
        var suspendedTenant2 = await GetOrCreateTenantAsync(dbContext, suspendedTenantId2, "Kappa Holdings");
        var archivedTenant = await GetOrCreateTenantAsync(dbContext, archivedTenantId, "Legacy Systems Inc");

        // Suspended/Archived flags
        if (suspendedTenant1.IsActive)
        {
            suspendedTenant1.Deactivate();
            dbContext.Tenants.Update(suspendedTenant1);
        }
        if (suspendedTenant2.IsActive)
        {
            suspendedTenant2.Deactivate();
            dbContext.Tenants.Update(suspendedTenant2);
        }

        if (!archivedTenant.IsArchived)
        {
            archivedTenant.Archive();
            dbContext.Tenants.Update(archivedTenant);
        }

        // Create pending first-admin invites (Invited)
        await SeedInviteForTenant(dbContext, invitedTenant1, "invited.admin1@example.com", createdByUserId, "Alice", "Chen");
        await SeedInviteForTenant(dbContext, invitedTenant2, "invited.admin2@example.com", createdByUserId, "Bob", "Martinez");

        // Create expired first-admin invites (Attention)
        await SeedExpiredInviteForTenant(dbContext, attentionTenant1, "attention.admin1@example.com", createdByUserId);
        await SeedExpiredInviteForTenant(dbContext, attentionTenant2, "attention.admin2@example.com", createdByUserId);

        // Active tenants: create HRAdmin users + accepted first-admin invites
        await SeedActiveTenantWithAdmin(dbContext, userManager, activeTenant1, "active.admin1@example.com", "Carlos", "Johnson", createdByUserId);
        await SeedActiveTenantWithAdmin(dbContext, userManager, activeTenant2, "active.admin2@example.com", "Diana", "Lee", createdByUserId);
        await SeedActiveTenantWithAdmin(dbContext, userManager, activeTenant3, "active.admin3@example.com", "Ethan", "Brown", createdByUserId);

        // Ensure tenant state objects are persisted
        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedInviteForTenant(
        AppIdentityDbContext dbContext,
        Tenant tenant,
        string email,
        Guid createdByUserId,
        string firstName,
        string lastName)
    {
        var exists = await dbContext.InviteTokens.AnyAsync(
            i => i.TenantId == tenant.Id && i.Role == PlatformRole.HRAdmin && i.Email == email,
            CancellationToken.None);
        if (!exists)
        {
            var invite = InviteToken.Create(
                email,
                tenant.Id,
                PlatformRole.HRAdmin,
                createdByUserId,
                firstName: firstName,
                lastName: lastName);
            dbContext.InviteTokens.Add(invite);
        }
    }

    private static async Task SeedExpiredInviteForTenant(
        AppIdentityDbContext dbContext,
        Tenant tenant,
        string email,
        Guid createdByUserId)
    {
        var exists = await dbContext.InviteTokens.AnyAsync(
            i => i.TenantId == tenant.Id && i.Role == PlatformRole.HRAdmin && i.Email == email,
            CancellationToken.None);
        if (!exists)
        {
            var invite = InviteToken.Create(
                email,
                tenant.Id,
                PlatformRole.HRAdmin,
                createdByUserId,
                expiryDays: 1);

            SetPrivateProperty(invite, "ExpiresAt", DateTime.UtcNow.AddMinutes(-10));
            dbContext.InviteTokens.Add(invite);
        }
    }

    private static async Task SeedActiveTenantWithAdmin(
        AppIdentityDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        Tenant tenant,
        string email,
        string firstName,
        string lastName,
        Guid createdByUserId)
    {
        var admin = await userManager.FindByEmailAsync(email);
        if (admin is null)
        {
            admin = new ApplicationUser
            {
                UserName = email,
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                FirstName = firstName,
                LastName = lastName,
                Department = "Platform",
                JobTitle = "HR Admin",
                HireDate = DateTime.UtcNow,
                EmailConfirmed = true,
                TenantId = tenant.Id,
                IsActive = true,
                LastLoginAt = DateTime.UtcNow.AddMinutes(-30),
            };

            var createRes = await userManager.CreateAsync(admin, "Admin@1234");
            if (createRes.Succeeded)
                await userManager.AddToRoleAsync(admin, PlatformRole.HRAdmin);
        }

        var inviteEmail = $"{firstName.ToLowerInvariant()}-firstadmin@example.com";
        var inviteExists = await dbContext.InviteTokens.AnyAsync(
            i => i.TenantId == tenant.Id && i.Role == PlatformRole.HRAdmin && i.Email == inviteEmail,
            CancellationToken.None);
        if (!inviteExists)
        {
            var invite = InviteToken.Create(
                inviteEmail,
                tenant.Id,
                PlatformRole.HRAdmin,
                createdByUserId,
                firstName: firstName,
                lastName: lastName,
                expiryDays: 14);

            invite.MarkAccepted(admin!.Id);
            dbContext.InviteTokens.Add(invite);
        }
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