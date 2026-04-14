namespace EY.HRPlatform.Training.Models.Responses;

public class OnSiteCourseDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ContentUri { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public DateTime CreatedAt { get; set; }
}
