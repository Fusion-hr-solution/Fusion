using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ExamOption : BaseEntity
{
    public string OptionText { get; private set; } = string.Empty;
    public bool IsCorrect { get; private set; }
    public int OrderIndex { get; private set; }

    public Guid QuestionId { get; private set; }
    public ExamQuestion Question { get; private set; } = null!;

    private ExamOption() { }

    public ExamOption(string optionText, bool isCorrect, Guid questionId, int orderIndex)
    {
        OptionText = optionText;
        IsCorrect = isCorrect;
        QuestionId = questionId;
        OrderIndex = orderIndex;
    }
}
