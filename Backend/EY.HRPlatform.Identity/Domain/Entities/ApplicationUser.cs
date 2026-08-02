using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Identity;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// A global Identity Account. It is deliberately not an <c>ITenantEntity</c>:
/// an account belongs to no tenant, and its participation in customer tenants is
/// expressed only through <see cref="TenantMembership"/>.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public Guid? EmployeeId { get; set; }
    public string? Department { get; set; }
    public string? JobTitle { get; set; }
    public DateTime HireDate { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    /// <summary>
    /// Customer tenants this account participates in. Membership is the only
    /// tenancy authority: the account row itself carries no tenant, so a Platform
    /// Administrator simply has none and no code path can infer one.
    /// </summary>
    public List<TenantMembership> TenantMemberships { get; set; } = [];

    public List<UserAccessProfile> AccessProfileAssignments { get; set; } = [];

    public string FullName => $"{FirstName} {LastName}";
}
