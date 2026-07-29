using EY.HRPlatform.DemoSeed;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence;

/// <summary>
/// Seeds roles and the single canonical Development tenant. Account and permission truth stays
/// in Identity; employee truth stays in CoreHR.
/// </summary>
public static class IdentitySeeder
{
    public static async Task ResetCanonicalTenantAsync(
        AppIdentityDbContext dbContext,
        CancellationToken cancellationToken = default)
    {
        var tenantId = CanonicalDemoSeed.TenantId;
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var users = await dbContext.Users.IgnoreQueryFilters()
            .Where(user => user.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        dbContext.Users.RemoveRange(users);

        dbContext.UserAccessProfileOrgUnitScopes.RemoveRange(
            await dbContext.UserAccessProfileOrgUnitScopes.IgnoreQueryFilters()
                .Where(scope => scope.TenantId == tenantId).ToListAsync(cancellationToken));
        dbContext.UserAccessProfiles.RemoveRange(
            await dbContext.UserAccessProfiles.IgnoreQueryFilters()
                .Where(assignment => assignment.TenantId == tenantId).ToListAsync(cancellationToken));
        dbContext.InviteAccessProfiles.RemoveRange(
            await dbContext.InviteAccessProfiles.IgnoreQueryFilters()
                .Where(assignment => assignment.TenantId == tenantId).ToListAsync(cancellationToken));
        dbContext.AccessProfileGrants.RemoveRange(
            await dbContext.AccessProfileGrants.IgnoreQueryFilters()
                .Where(grant => grant.TenantId == tenantId).ToListAsync(cancellationToken));
        dbContext.AccessProfiles.RemoveRange(
            await dbContext.AccessProfiles.IgnoreQueryFilters()
                .Where(profile => profile.TenantId == tenantId).ToListAsync(cancellationToken));
        dbContext.InviteTokens.RemoveRange(
            await dbContext.InviteTokens.IgnoreQueryFilters()
                .Where(invite => invite.TenantId == tenantId).ToListAsync(cancellationToken));
        dbContext.AccessAuditEvents.RemoveRange(
            await dbContext.AccessAuditEvents.IgnoreQueryFilters()
                .Where(audit => audit.TenantId == tenantId).ToListAsync(cancellationToken));

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
    public static async Task SeedAsync(
        AppIdentityDbContext dbContext,
        RoleManager<IdentityRole<Guid>> roleManager,
        UserManager<ApplicationUser> userManager,
        bool seedDemoData = false,
        IConfiguration? configuration = null)
    {
        foreach (var role in PlatformRole.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                var result = await roleManager.CreateAsync(new IdentityRole<Guid>
                {
                    Name = role,
                    NormalizedName = role.ToUpperInvariant()
                });
                if (!result.Succeeded)
                    throw new InvalidOperationException($"Failed to create role {role}: {string.Join(", ", result.Errors.Select(error => error.Description))}");
            }
        }

        var accessProfiles = new AccessProfileService(dbContext, userManager);
        if (seedDemoData)
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync()
                : null;
            await SeedCanonicalTenantAsync(dbContext, userManager);
            await WriteReceiptAsync(dbContext);
            await accessProfiles.EnsureSeedDataAsync();
            if (transaction is not null)
                await transaction.CommitAsync();
            return;
        }

        await accessProfiles.EnsureSeedDataAsync();
    }

    private static async Task WriteReceiptAsync(AppIdentityDbContext dbContext)
    {
        var receipt = await dbContext.CanonicalSeedReceipts.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.TenantId == CanonicalDemoSeed.TenantId);
        if (receipt is null)
            dbContext.CanonicalSeedReceipts.Add(CanonicalSeedReceipt.Create(CanonicalDemoSeed.TenantId, CanonicalDemoSeed.AsOfUtc));
        else
        {
            if (receipt.ManifestHash != CanonicalDemoSeed.ManifestHash)
                throw new InvalidOperationException("Canonical Identity seed receipt drifted from the manifest. Run the canonical fresh reset.");
            receipt.Refresh(CanonicalDemoSeed.AsOfUtc);
        }
        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedCanonicalTenantAsync(
        AppIdentityDbContext dbContext,
        UserManager<ApplicationUser> userManager)
    {
        var tenant = await dbContext.Tenants.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.Id == CanonicalDemoSeed.TenantId);
        if (tenant is null)
        {
            tenant = Tenant.Create(CanonicalDemoSeed.TenantId, CanonicalDemoSeed.DisplayName);
            dbContext.Tenants.Add(tenant);
            await dbContext.SaveChangesAsync();
        }

        var employees = CanonicalDemoSeed.BuildEmployees().ToDictionary(employee => employee.Id);
        var manager = employees[CanonicalDemoSeed.DirectorId];
        var personas = new[]
        {
            new DemoPersona("admin@ey-hr.com", "System", "Admin", null, PlatformRole.PlatformAdmin, CanonicalDemoSeed.PlatformPassword),
            new DemoPersona("atlas.hr@atlas.example", "Nadia", "People", CanonicalDemoSeed.GetEmployeeByEmail("employee0002@atlas.example").Id, PlatformRole.HRAdmin, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("atlas.orgadmin@atlas.example", "Sami", "Structure", CanonicalDemoSeed.GetEmployeeByEmail("employee0003@atlas.example").Id, PlatformRole.OrgAdmin, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("direction@atlas.example", "Leila", "Direction", CanonicalDemoSeed.GetEmployeeByEmail("employee0004@atlas.example").Id, PlatformRole.Employee, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("flit.manager@atlas.example", manager.FirstName, manager.LastName, manager.Id, PlatformRole.Manager, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("nour.pending@atlas.example", "Nour", "Pending", CanonicalDemoSeed.LifecycleEmployeeIds[0], PlatformRole.Employee, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("yassine.draft@atlas.example", "Yassine", "Draft", CanonicalDemoSeed.LifecycleEmployeeIds[1], PlatformRole.Employee, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("meriem.submitted@atlas.example", "Meriem", "Submitted", CanonicalDemoSeed.LifecycleEmployeeIds[2], PlatformRole.Employee, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("oussama.review@atlas.example", "Oussama", "Manager Review", CanonicalDemoSeed.LifecycleEmployeeIds[3], PlatformRole.Employee, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("amel.finalized@atlas.example", "Amel", "Finalized", CanonicalDemoSeed.LifecycleEmployeeIds[4], PlatformRole.Employee, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("hatem.acknowledged@atlas.example", "Hatem", "Acknowledged", CanonicalDemoSeed.LifecycleEmployeeIds[5], PlatformRole.Employee, CanonicalDemoSeed.TenantPassword),
            new DemoPersona("empty.employee@atlas.example", "Empty", "Workspace", CanonicalDemoSeed.GetEmployeeByEmail("employee0051@atlas.example").Id, PlatformRole.Employee, CanonicalDemoSeed.TenantPassword)
        };

        foreach (var persona in personas)
        {
            var employee = persona.EmployeeId is { } employeeId && employees.TryGetValue(employeeId, out var spec)
                ? spec
                : null;
            var firstName = employee?.FirstName ?? persona.FirstName;
            var lastName = employee?.LastName ?? persona.LastName;
            var user = await userManager.FindByEmailAsync(persona.Email);
            if (user is null && persona.EmployeeId is { } linkedEmployeeId)
            {
                var conflictingUsers = await dbContext.Users.IgnoreQueryFilters()
                    .Where(candidate => candidate.TenantId == CanonicalDemoSeed.TenantId
                        && candidate.EmployeeId == linkedEmployeeId)
                    .ToListAsync();
                foreach (var conflictingUser in conflictingUsers)
                {
                    conflictingUser.EmployeeId = null;
                    conflictingUser.IsActive = false;
                }

                if (conflictingUsers.Count > 0)
                    await dbContext.SaveChangesAsync();
            }

            if (user is null)
            {
                user = new ApplicationUser
                {
                    Id = CanonicalDemoSeed.DeterministicGuid($"user:{persona.Email}"),
                    UserName = persona.Email,
                    Email = persona.Email,
                    EmailConfirmed = true,
                    FirstName = firstName,
                    LastName = lastName,
                    Department = employee?.Department ?? "Platform",
                    JobTitle = employee?.JobTitle ?? "Platform Administrator",
                    HireDate = employee?.HireDate ?? CanonicalDemoSeed.AsOfUtc.AddYears(-10),
                    TenantId = CanonicalDemoSeed.TenantId,
                    EmployeeId = persona.EmployeeId,
                    IsActive = true,
                };
                var result = await userManager.CreateAsync(user, persona.Password);
                if (!result.Succeeded)
                    throw new InvalidOperationException($"Failed to create canonical account {persona.Email}: {string.Join(", ", result.Errors.Select(error => error.Description))}");
            }
            else
            {
                user.TenantId = CanonicalDemoSeed.TenantId;
                user.EmployeeId = persona.EmployeeId;
                user.FirstName = firstName;
                user.LastName = lastName;
                user.Department = employee?.Department ?? "Platform";
                user.JobTitle = employee?.JobTitle ?? "Platform Administrator";
                user.EmailConfirmed = true;
                user.IsActive = true;
                var update = await userManager.UpdateAsync(user);
                if (!update.Succeeded)
                    throw new InvalidOperationException($"Failed to update canonical account {persona.Email}: {string.Join(", ", update.Errors.Select(error => error.Description))}");

                var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
                var reset = await userManager.ResetPasswordAsync(user, resetToken, persona.Password);
                if (!reset.Succeeded)
                    throw new InvalidOperationException($"Failed to reset canonical account {persona.Email}: {string.Join(", ", reset.Errors.Select(error => error.Description))}");
            }

            if (!await userManager.IsInRoleAsync(user, persona.Role))
            {
                var roleResult = await userManager.AddToRoleAsync(user, persona.Role);
                if (!roleResult.Succeeded)
                    throw new InvalidOperationException($"Failed to assign role {persona.Role} to {persona.Email}: {string.Join(", ", roleResult.Errors.Select(error => error.Description))}");
            }

            if (persona.Role != PlatformRole.Employee && persona.EmployeeId is not null
                && !await userManager.IsInRoleAsync(user, PlatformRole.Employee))
            {
                await userManager.AddToRoleAsync(user, PlatformRole.Employee);
            }
        }
    }

    private sealed record DemoPersona(
        string Email,
        string FirstName,
        string LastName,
        Guid? EmployeeId,
        string Role,
        string Password);
}
