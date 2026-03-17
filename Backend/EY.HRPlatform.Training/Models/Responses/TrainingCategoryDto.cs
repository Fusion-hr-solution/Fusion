namespace EY.HRPlatform.Training.Models.Responses;

public class TrainingCategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int TrainingCount { get; set; }
}
