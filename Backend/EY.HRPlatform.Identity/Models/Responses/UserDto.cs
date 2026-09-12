using System.Text.Json.Serialization;

namespace EY.HRPlatform.Identity.Models.Responses;

public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string? JobTitle { get; set; }
    public DateTime? HireDate { get; set; }
    public Guid TenantId { get; set; }
    public Guid? EmployeeId { get; set; }
    public List<string> Roles { get; set; } = [];
    public List<AccessProfileAssignmentSummaryDto> AccessProfiles { get; set; } = [];

    /// <summary>
    /// Only populated when a user is created. Contains the temporary password
    /// that should be communicated to the user (e.g., via email or manual sharing).
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? TemporaryPassword { get; set; }
}
