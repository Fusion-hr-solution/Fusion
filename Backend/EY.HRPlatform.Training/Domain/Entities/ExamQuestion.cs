using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class ExamQuestion : BaseEntity
{
    public string QuestionText { get; private set; } = string.Empty;
    public string Type { get; private set; } = string.Empty;

    public Guid ExamId { get; private set; }
    public Exam Exam { get; private set; } = null!;

    private readonly List<ExamOption> _options = [];
    public IReadOnlyCollection<ExamOption> Options => _options.AsReadOnly();

    private ExamQuestion() { }

    public ExamQuestion(string questionText, string type, Guid examId)
    {
        QuestionText = questionText;
        Type = type;
        ExamId = examId;
    }

    public void AddOption(ExamOption option)
    {
        _options.Add(option);
    }
}
