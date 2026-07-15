using System.Security.Claims;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests.TestSupport;

/// <summary>Builds a ClaimsPrincipal with encoded core_permission claims for authorization tests.</summary>
public sealed class ClaimsPrincipalBuilder
{
    private readonly List<Claim> _claims = [];

    public ClaimsPrincipalBuilder WithUserId(Guid userId)
    {
        _claims.Add(new Claim(ClaimTypes.NameIdentifier, userId.ToString()));
        return this;
    }

    public ClaimsPrincipalBuilder WithEmployeeId(Guid employeeId)
    {
        _claims.Add(new Claim(CustomClaimTypes.EmployeeId, employeeId.ToString()));
        return this;
    }

    public ClaimsPrincipalBuilder WithRole(string role)
    {
        _claims.Add(new Claim(ClaimTypes.Role, role));
        return this;
    }

    public ClaimsPrincipalBuilder WithPermission(string permissionKey, string scope)
    {
        _claims.Add(new Claim(CustomClaimTypes.CorePermission, CorePermissionClaimValue.Encode(permissionKey, scope)));
        return this;
    }

    public ClaimsPrincipal Build() => new(new ClaimsIdentity(_claims, authenticationType: "Test"));

    public static ClaimsPrincipal Anonymous() => new(new ClaimsIdentity());
}
