using System.ComponentModel.DataAnnotations;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Models.Requests;

public sealed class ProvisionWorkforceAccountInviteRequest
{
    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = PlatformRole.Employee;
}