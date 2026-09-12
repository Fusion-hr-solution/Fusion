using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Models.Requests;

/// <summary>
/// Request model for admin-provisioned user creation.
/// Used by HRAdmin/PlatformAdmin to create users within a tenant.
/// </summary>
public class CreateUserRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Department { get; set; }

    [MaxLength(100)]
    public string? JobTitle { get; set; }

    /// <summary>
    /// Optional, non-authoritative. An identity account is not workforce truth;
    /// employment dates belong to CoreHR. Left unset for administrator and other
    /// identity-only accounts.
    /// </summary>
    public DateTime? HireDate { get; set; }

    /// <summary>
    /// Required role to assign to the new user. Employee and Manager access must be
    /// activated from trusted CoreHR employee records through invitations.
    /// PlatformAdmin can use this endpoint for non-workforce admin accounts.
    /// </summary>
    [Required]
    public string? Role { get; set; }
}
