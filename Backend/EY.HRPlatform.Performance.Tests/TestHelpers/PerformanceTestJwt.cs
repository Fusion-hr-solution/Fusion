using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.IdentityModel.Tokens;

namespace EY.HRPlatform.Performance.Tests.TestHelpers;

public static class PerformanceTestJwt
{
    internal const string Secret = "performance-http-tests-only-signing-key-0123456789";
    internal const string Issuer = "fusion-performance-tests";
    internal const string Audience = "fusion-performance-api-tests";

    public static string Issue(
        Guid? tenantId,
        Guid? employeeId = null,
        IEnumerable<EffectivePermissionGrant>? permissions = null,
        IEnumerable<string>? modules = null,
        Guid? userId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, (userId ?? Guid.NewGuid()).ToString()),
            new(ClaimTypes.Email, "caller@performance.test"),
        };
        if (tenantId is not null) claims.Add(new(CustomClaimTypes.TenantId, tenantId.Value.ToString()));
        if (employeeId is not null) claims.Add(new(CustomClaimTypes.EmployeeId, employeeId.Value.ToString()));
        claims.AddRange((permissions ?? []).Select(grant => new Claim(
            CustomClaimTypes.CorePermission, CorePermissionClaimValue.Encode(grant.PermissionKey, grant.Scope))));
        claims.AddRange((modules ?? []).Select(module => new Claim(CustomClaimTypes.ModuleEntitlement, module)));

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(10),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Secret)), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
