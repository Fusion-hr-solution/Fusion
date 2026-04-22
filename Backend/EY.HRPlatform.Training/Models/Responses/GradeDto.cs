namespace EY.HRPlatform.Training.Models.Responses;

public class GradeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Level { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
}
