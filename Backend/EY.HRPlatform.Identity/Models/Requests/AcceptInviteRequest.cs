using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Models.Requests;

/// <summary>
/// Request model for accepting an invitation and creating a user account.
/// </summary>
public class AcceptInviteRequest
{
    /// <summary>
    /// Password chosen by the user.
    /// </summary>
    [Required, MinLength(8), MaxLength(100)]
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// First name of the user. Required if not pre-filled in the invite.
    /// </summary>
    [MaxLength(100)]
    public string? FirstName { get; set; }

    /// <summary>
    /// Last name of the user. Required if not pre-filled in the invite.
    /// </summary>
    [MaxLength(100)]
    public string? LastName { get; set; }
}
