namespace EY.HRPlatform.Training.Models.Responses;

public class FeedbackQuestionDto
{
    public Guid Id { get; set; }
    public Guid? CategoryId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Order { get; set; }
    /// <summary>JSON choice list for MultipleChoice; null otherwise.</summary>
    public string? Options { get; set; }
}
