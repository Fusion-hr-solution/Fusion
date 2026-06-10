using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Models.Requests;

public class WorkforceAccountEmployeeSnapshotRequest
{
    [Required]
    public Guid EmployeeId { get; set; }

    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? FirstName { get; set; }

    [MaxLength(100)]
    public string? LastName { get; set; }
}