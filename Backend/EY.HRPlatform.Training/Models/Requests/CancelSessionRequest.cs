using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CancelSessionRequest
{
    [Required, MaxLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
