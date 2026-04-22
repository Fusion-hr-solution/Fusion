using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class AddCurriculumMappingRequest
{
    [Required]
    public Guid GradeId { get; set; }

    [Required]
    public Guid ServiceLineId { get; set; }

    [Required]
    public Guid TrainingId { get; set; }

    public bool IsRequired { get; set; } = true;

    public int? OrderIndex { get; set; }
}
