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

    public DateTime? HireDate { get; set; }

    /// <summary>
    /// Role to assign to the new user. Defaults to Employee if not specified.
    /// HRAdmin can only assign Employee or Manager roles.
    /// PlatformAdmin can assign any role.
    /// </summary>
    public string? Role { get; set; }
}
