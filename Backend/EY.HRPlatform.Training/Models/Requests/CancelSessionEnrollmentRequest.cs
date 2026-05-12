using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CancelSessionEnrollmentRequest
{
    [Required]
    public Guid SessionId { get; set; }
}
