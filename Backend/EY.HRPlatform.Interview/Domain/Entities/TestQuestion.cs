using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class TestQuestion : BaseEntity
{
    public Guid TestId { get; set; }
    public Guid QuestionId { get; set; }

    public Test Test { get; set; } = null!;
    public Question Question { get; set; } = null!;
}
