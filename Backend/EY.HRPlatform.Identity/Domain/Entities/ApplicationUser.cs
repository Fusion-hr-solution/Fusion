using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Identity;

namespace EY.HRPlatform.Identity.Domain.Entities;

public class ApplicationUser : IdentityUser<Guid>, ITenantEntity
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
    /// The tenant this user belongs to. Required for all users.
    /// PlatformAdmin users can override their active context via X-Tenant-Id header.
    /// </summary>
    public Guid TenantId { get; set; }
    
    /// <summary>
    /// Navigation property to the user's tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    public List<UserAccessProfile> AccessProfileAssignments { get; set; } = [];

    public string FullName => $"{FirstName} {LastName}";
}
