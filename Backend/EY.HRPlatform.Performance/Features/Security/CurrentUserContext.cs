using EY.HRPlatform.SharedKernel.Auth;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.Security;

/// <summary>
/// Convenience access to the current authenticated actor for audit and notification stamping.
/// </summary>
public interface ICurrentUserContext
{
    Guid? UserId { get; }
    Guid? EmployeeId { get; }
    string? FullName { get; }
}

public sealed class CurrentUserContext(IHttpContextAccessor httpContextAccessor) : ICurrentUserContext
{
    private ClaimsPrincipal? Principal
    {
        get
        {
            var user = httpContextAccessor.HttpContext?.User;
            return user?.Identity?.IsAuthenticated == true ? user : null;
        }
    }

    public Guid? UserId
    {
        get
        {
            var value = Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }

    public Guid? EmployeeId => Principal?.GetEmployeeId();

    public string? FullName => Principal?.GetFullName();
}
