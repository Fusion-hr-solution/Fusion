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

    /// <summary>
    /// LEGACY, non-authoritative. Workforce identity now lives on
    /// <see cref="TenantMembership.EmployeeId"/> (the tenant-contextual authority
    /// that claims, sessions, and Self/DirectReports authorization read). This
    /// global scalar is retained only as the backfill source and rollback data; no
    /// claim, session, status, or authorization path reads it. It is slated for
    /// column removal once the remaining display/legacy provisioning callers are
    /// migrated off it.
    /// </summary>
    public Guid? EmployeeId { get; set; }
    public string? Department { get; set; }
    public string? JobTitle { get; set; }

    /// <summary>
    /// LEGACY, non-authoritative workforce data. Identity answers "who can sign
    /// in?"; Core answers "who works here, and since when?". An identity account
    /// created for administration or before any Core employment link therefore
    /// carries no hire date — this is <c>null</c> — and where the person is also a
    /// Core employee the authoritative dates live on their CoreHR employment /
    /// work-assignment records, never here.
    /// </summary>
    public DateTime? HireDate { get; set; }
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
