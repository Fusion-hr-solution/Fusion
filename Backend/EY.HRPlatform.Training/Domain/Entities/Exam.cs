using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

public class Exam : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public int PassingScore { get; private set; }
    public int? DurationMinutes { get; private set; }

    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;

    private readonly List<ExamQuestion> _questions = [];
    public IReadOnlyCollection<ExamQuestion> Questions => _questions.AsReadOnly();

    private readonly List<ExamAttempt> _attempts = [];
    public IReadOnlyCollection<ExamAttempt> Attempts => _attempts.AsReadOnly();

    private Exam() { }

    public Exam(string title, int passingScore, Guid trainingId, string? description = null, int? durationMinutes = null)
    {
        Title = title;
        PassingScore = passingScore;
        TrainingId = trainingId;
        Description = description;
        DurationMinutes = durationMinutes;
    }

    public void Update(string title, int passingScore, string? description, int? durationMinutes)
    {
        Title = title;
        PassingScore = passingScore;
        Description = description;
        DurationMinutes = durationMinutes;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddQuestion(ExamQuestion question) => _questions.Add(question);
    public void RemoveQuestion(ExamQuestion question) => _questions.Remove(question);
}
