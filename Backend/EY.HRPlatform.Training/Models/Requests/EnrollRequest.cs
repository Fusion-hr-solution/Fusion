using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class EnrollRequest
{
    [Required]
    public Guid TrainingId { get; set; }
}
