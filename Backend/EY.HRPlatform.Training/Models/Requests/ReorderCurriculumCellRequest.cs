using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class ReorderCurriculumCellRequest
{
    [Required]
    public Guid GradeId { get; set; }

    [Required]
    public Guid ServiceLineId { get; set; }

    [Required]
    public List<Guid> MappingIds { get; set; } = [];
}
