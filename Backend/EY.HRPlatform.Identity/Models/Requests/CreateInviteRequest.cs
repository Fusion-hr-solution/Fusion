using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Models.Requests;

/// <summary>
/// Request model for creating an invitation to join a tenant.
/// </summary>
public class CreateInviteRequest
{
    /// <summary>
    /// Email address to send the invitation to.
    /// </summary>
    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Role to assign when the invite is accepted.
    /// HRAdmin can only invite as Employee or Manager.
    /// PlatformAdmin can invite as any role.
    /// </summary>
    [Required]
    public string Role { get; set; } = string.Empty;

    /// <summary>
    /// Optional: pre-fill the first name for the invited user.
    /// </summary>
    [MaxLength(100)]
    public string? FirstName { get; set; }

    /// <summary>
    /// Optional: pre-fill the last name for the invited user.
    /// </summary>
    [MaxLength(100)]
    public string? LastName { get; set; }
}
