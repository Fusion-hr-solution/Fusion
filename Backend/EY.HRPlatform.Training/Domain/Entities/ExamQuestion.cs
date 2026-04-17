using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ExamQuestion : BaseEntity
{
    public string QuestionText { get; private set; } = string.Empty;
    public QuestionType Type { get; private set; }
    public int OrderIndex { get; private set; }
    public int Points { get; private set; } = 1;

    public Guid ExamId { get; private set; }
    public Exam Exam { get; private set; } = null!;

    private readonly List<ExamOption> _options = [];
    public IReadOnlyCollection<ExamOption> Options => _options.AsReadOnly();

    private ExamQuestion() { }

    public ExamQuestion(string questionText, QuestionType type, Guid examId, int orderIndex, int points = 1)
    {
        QuestionText = questionText;
        Type = type;
        ExamId = examId;
        OrderIndex = orderIndex;
        Points = points;
    }

    public void Update(string questionText, QuestionType type, int points)
    {
        QuestionText = questionText;
        Type = type;
        Points = points;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetOrderIndex(int orderIndex)
    {
        OrderIndex = orderIndex;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddOption(ExamOption option) => _options.Add(option);
    public void ClearOptions() => _options.Clear();
}
