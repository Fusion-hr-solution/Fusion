namespace EY.HRPlatform.Identity.Models.Responses;

public class AuthResponse
{
    public Guid UserId { get; set; }
    public Guid TenantId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public Guid? EmployeeId { get; set; }
    public List<AccessProfileAssignmentSummaryDto> AccessProfiles { get; set; } = [];
    public List<EffectivePermissionGrantDto> EffectivePermissions { get; set; } = [];
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime AccessTokenExpiration { get; set; }
}
