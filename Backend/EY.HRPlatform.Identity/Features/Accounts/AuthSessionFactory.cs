using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.Membership;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;

namespace EY.HRPlatform.Identity.Features.Accounts;

public interface IAuthSessionFactory
{
    Task<AuthResponse> CreateAsync(ApplicationUser user, CancellationToken cancellationToken = default);
}

/// <summary>
/// Builds an authenticated session from the account's canonical membership and
/// access.
///
/// Sign-in and administrator activation both end with the same problem — turn an
/// account into a session that reports exactly what its token authorizes — so they
/// share one implementation. A second one would be free to drift, and a session
/// that claims a tenant the token does not carry is a workspace the backend will
/// refuse after the client has already rendered it.
/// </summary>
public sealed class AuthSessionFactory(
    UserManager<ApplicationUser> userManager,
    ITokenService tokenService,
    IAccessProfileService accessProfiles,
    AppIdentityDbContext dbContext,
    IConfiguration configuration,
    ICustomerContextResolver customerContextResolver) : IAuthSessionFactory
{
    public async Task<AuthResponse> CreateAsync(
        ApplicationUser user, CancellationToken cancellationToken = default)
    {
        var accessToken = await tokenService.GenerateAccessTokenAsync(user);
        var refreshTokenString = tokenService.GenerateRefreshToken();

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = refreshTokenString,
            ExpiresAt = DateTime.UtcNow.AddDays(
                int.Parse(configuration["Jwt:RefreshTokenExpirationInDays"]!)),
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var roles = await userManager.GetRolesAsync(user);

        // Without a customer context there is no tenant, no entitlement and no
        // tenant permission to report, so the client cannot render a workspace the
        // backend would refuse.
        var customerContext = await customerContextResolver.ResolveAsync(user);
        var context = customerContext.Context;

        var assignedProfiles = context is null
            ? []
            : (await accessProfiles.GetAssignedProfilesAsync(user)).ToList();

        var effectivePermissions = context is null
            ? []
            : (await accessProfiles.GetEffectivePermissionsAsync(user))
                .Select(grant => new EffectivePermissionGrantDto
                {
                    PermissionKey = grant.PermissionKey,
                    Scope = grant.Scope,
                    Label = CorePermissionCatalog.Get(grant.PermissionKey).Label,
                    Group = CorePermissionCatalog.Get(grant.PermissionKey).Group,
                    HelperText = CorePermissionCatalog.Get(grant.PermissionKey).HelperText,
                    AllowedScopes = CorePermissionCatalog.Get(grant.PermissionKey).AllowedScopes.ToList(),
                })
                .ToList();

        return new AuthResponse
        {
            UserId = user.Id,
            TenantId = context?.TenantId,
            TenantMembershipId = context?.MembershipId,
            ModuleEntitlements = context?.EnabledModules.Select(module => module.ToString()).ToList() ?? [],
            Email = user.Email!,
            FullName = user.FullName,
            Roles = roles.ToList(),
            EmployeeId = context is null ? null : user.EmployeeId,
            AccessProfiles = assignedProfiles,
            EffectivePermissions = effectivePermissions,
            AccessToken = accessToken,
            RefreshToken = refreshTokenString,
            AccessTokenExpiration = DateTime.UtcNow.AddMinutes(
                int.Parse(configuration["Jwt:ExpirationInMinutes"]!)),
        };
    }
}
