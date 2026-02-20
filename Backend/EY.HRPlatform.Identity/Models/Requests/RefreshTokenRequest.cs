using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Models.Requests;

public class RefreshTokenRequest
{
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}