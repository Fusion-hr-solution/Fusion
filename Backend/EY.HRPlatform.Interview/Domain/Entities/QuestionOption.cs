namespace EY.HRPlatform.Interview.Domain.Entities;

public class QuestionOption
{
    public Guid Id { get; set; }
    public Guid QuestionId { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool Correct { get; set; }

    public Question Question { get; set; } = null!;
}
