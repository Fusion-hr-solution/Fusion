using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Models.Requests;

public class RegisterRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(8)]
    public string Password { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Department { get; set; }

    [MaxLength(100)]
    public string? JobTitle { get; set; }

    public DateTime HireDate { get; set; }
}