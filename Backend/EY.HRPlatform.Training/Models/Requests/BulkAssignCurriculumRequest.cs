using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class BulkAssignCurriculumRequest
{
    [Required]
    public Guid TrainingId { get; set; }

    public bool IsRequired { get; set; } = true;

    public List<Guid>? GradeIds { get; set; }

    public List<Guid>? ServiceLineIds { get; set; }
}
