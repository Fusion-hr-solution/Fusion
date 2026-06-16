using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class UpdateSessionRequest
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

    // External-trainer costs (only meaningful when the session has an external trainer).
    [Range(0, double.MaxValue)]
    public decimal? ExternalTrainerCost { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? VenueCost { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? MaterialsCost { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? OtherCost { get; set; }
}
