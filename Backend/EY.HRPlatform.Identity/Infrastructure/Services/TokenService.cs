using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.Membership;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

namespace EY.HRPlatform.Identity.Infrastructure.Services;

public interface ITokenService
{
    Task<string> GenerateAccessTokenAsync(ApplicationUser user);
    string GenerateRefreshToken();
}

public class TokenService : ITokenService
{
    private readonly IConfiguration _configuration;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IAccessProfileService _accessProfileService;
    private readonly ICustomerContextResolver _customerContextResolver;

    public TokenService(
        IConfiguration configuration,
        UserManager<ApplicationUser> userManager,
        IAccessProfileService accessProfileService,
        ICustomerContextResolver customerContextResolver)
    {
        _configuration = configuration;
        _userManager = userManager;
        _accessProfileService = accessProfileService;
        _customerContextResolver = customerContextResolver;
    }

    public async Task<string> GenerateAccessTokenAsync(ApplicationUser user)
    {
        // Step 1: Get user's roles from the database
        var roles = await _userManager.GetRolesAsync(user);

        // Step 2: Build the claims (data embedded inside the token)
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email!),
            new(CustomClaimTypes.FullName, user.FullName),
        };

        // Step 3: Add one role claim per role
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        // Step 4: Derive customer tenant context from membership, never from the
        // account row. Exactly one Active membership grants authority; zero or
        // several grant none, so the token simply carries no customer claims and
        // every downstream tenant check fails closed. A Platform Administrator
        // authenticates successfully and reaches the control plane with no
        // customer authority at all.
        var customerContext = await _customerContextResolver.ResolveAsync(user);

        if (customerContext.Context is { } context)
        {
            claims.Add(new Claim(CustomClaimTypes.TenantId, context.TenantId.ToString()));
            claims.Add(new Claim(CustomClaimTypes.TenantMembershipId, context.MembershipId.ToString()));

            foreach (var module in context.EnabledModules)
            {
                claims.Add(new Claim(CustomClaimTypes.ModuleEntitlement, module.ToString()));
            }

            if (user.EmployeeId.HasValue)
            {
                claims.Add(new Claim(CustomClaimTypes.EmployeeId, user.EmployeeId.Value.ToString()));
            }

            // Tenant permissions are meaningful only inside a customer tenant, so
            // they travel with the membership rather than with the account.
            var permissions = await _accessProfileService.GetEffectivePermissionsAsync(user);
            foreach (var permission in permissions)
            {
                claims.Add(new Claim(
                    CustomClaimTypes.CorePermission,
                    CorePermissionClaimValue.Encode(permission.PermissionKey, permission.Scope)));
            }
        }

        // Step 5: Create the signing key from our secret
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:Secret"]!));

        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // Step 6: Build the token
        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(
                int.Parse(_configuration["Jwt:ExpirationInMinutes"]!)),
            signingCredentials: credentials
        );

        // Step 7: Serialize to string
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }
}
