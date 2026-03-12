using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class Exam : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public int PassingScore { get; private set; }

    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;

    private readonly List<ExamQuestion> _questions = [];
    public IReadOnlyCollection<ExamQuestion> Questions => _questions.AsReadOnly();

    private readonly List<ExamAttempt> _attempts = [];
    public IReadOnlyCollection<ExamAttempt> Attempts => _attempts.AsReadOnly();

    private Exam() { }

    public Exam(string title, int passingScore, Guid trainingId)
    {
        Title = title;
        PassingScore = passingScore;
        TrainingId = trainingId;
    }

    public void AddQuestion(ExamQuestion question)
    {
        _questions.Add(question);
    }
}
