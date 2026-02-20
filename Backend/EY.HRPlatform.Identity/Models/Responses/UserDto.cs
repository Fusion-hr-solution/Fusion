namespace EY.HRPlatform.Identity.Models.Responses;

public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string? JobTitle { get; set; }
    public DateTime HireDate { get; set; }
    public List<string> Roles { get; set; } = new();
}