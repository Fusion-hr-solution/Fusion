using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CreateSessionRequest
{
    [Required]
    public DateTime StartUtc { get; set; }

    [Required]
    public DateTime EndUtc { get; set; }

    [Required, MaxLength(200)]
    public string Room { get; set; } = string.Empty;

    [Range(1, 10000)]
    public int MaxCapacity { get; set; }

    [MaxLength(2000)]
    public string? Notes { get; set; }

    public Guid? TrainerEmployeeId { get; set; }

    [MaxLength(200)]
    public string? TrainerName { get; set; }

    [MaxLength(320), EmailAddress]
    public string? TrainerEmail { get; set; }
}
