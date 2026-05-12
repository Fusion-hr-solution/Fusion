using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class EnrollInSessionsRequest
{
    [Required]
    public Guid TrainingId { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "At least one session selection is required.")]
    public List<SessionSelection> Selections { get; set; } = [];
}

public class SessionSelection
{
    [Required]
    public Guid PartId { get; set; }

    [Required]
    public Guid SessionId { get; set; }
}
