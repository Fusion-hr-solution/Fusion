namespace EY.HRPlatform.Training.Models.Responses;

public class CurriculumMappingDto
{
    public Guid Id { get; set; }
    public Guid GradeId { get; set; }
    public Guid ServiceLineId { get; set; }
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string? TrainingDescription { get; set; }
    public int TrainingCredits { get; set; }
    public string TrainingType { get; set; } = string.Empty;
    public string? TrainingDuration { get; set; }
    public bool IsRequired { get; set; }
    public int OrderIndex { get; set; }
}
