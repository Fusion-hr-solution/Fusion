using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class QuestionOption : BaseEntity
{
    public Guid QuestionId { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool Correct { get; set; }

    public Question Question { get; set; } = null!;
}
