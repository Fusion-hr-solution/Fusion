using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence;

/// <summary>
/// Creates the first local platform administrator only when explicitly configured by a
/// Development host. Never use this path for production account provisioning.
/// </summary>
public static class DevelopmentPlatformAdminBootstrap
{
    private const string EmailKey = "DevelopmentBootstrap:PlatformAdmin:Email";
    private const string PasswordKey = "DevelopmentBootstrap:PlatformAdmin:Password";

    public static async Task SeedIfConfiguredAsync(
        AppIdentityDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        var email = configuration[EmailKey]?.Trim();
        var password = configuration[PasswordKey];
        if (string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(password))
            return;
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException(
                "Configure both DevelopmentBootstrap:PlatformAdmin:Email and Password to bootstrap the local administrator.");

        // Platform accounts have no tenant membership, so the normal user filter can hide them.
        // The bootstrap is allowed only for a truly empty Identity database.
        if (await dbContext.Users.IgnoreQueryFilters().AnyAsync(cancellationToken))
            return;

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FirstName = "Platform",
            LastName = "Admin",
            IsActive = true
        };

        var createResult = await userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
            throw new InvalidOperationException(
                "Failed to create the configured Development platform administrator: "
                + string.Join(", ", createResult.Errors.Select(error => error.Description)));

        var roleResult = await userManager.AddToRoleAsync(user, PlatformRole.PlatformAdmin);
        if (roleResult.Succeeded)
            return;

        await userManager.DeleteAsync(user);
        throw new InvalidOperationException(
            "Failed to assign the PlatformAdmin role to the configured Development administrator: "
            + string.Join(", ", roleResult.Errors.Select(error => error.Description)));
    }
}
