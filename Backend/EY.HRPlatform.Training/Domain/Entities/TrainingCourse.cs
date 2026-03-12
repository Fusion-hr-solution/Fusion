using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class TrainingCourse : AggregateRoot
{
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public int Credits { get; private set; }
    public bool IsMandatory { get; private set; }
    public BadgeLevel BadgeLevel { get; private set; }
    public string? Duration { get; private set; }

    public Guid CategoryId { get; private set; }
    public TrainingCategory Category { get; private set; } = null!;

    private readonly List<TrainingChapter> _chapters = [];
    public IReadOnlyCollection<TrainingChapter> Chapters => _chapters.AsReadOnly();

    private readonly List<Exam> _exams = [];
    public IReadOnlyCollection<Exam> Exams => _exams.AsReadOnly();

    private readonly List<TrainingAssignment> _assignments = [];
    public IReadOnlyCollection<TrainingAssignment> Assignments => _assignments.AsReadOnly();

    private readonly List<TrainingProgress> _progressRecords = [];
    public IReadOnlyCollection<TrainingProgress> ProgressRecords => _progressRecords.AsReadOnly();

    private TrainingCourse() { }

    public TrainingCourse(
        string title,
        string? description,
        int credits,
        bool isMandatory,
        BadgeLevel badgeLevel,
        Guid categoryId,
        string? duration = null)
    {
        Title = title;
        Description = description;
        Credits = credits;
        IsMandatory = isMandatory;
        BadgeLevel = badgeLevel;
        CategoryId = categoryId;
        Duration = duration;
    }

    public void Update(string title, string? description, int credits, bool isMandatory, BadgeLevel badgeLevel, string? duration)
    {
        Title = title;
        Description = description;
        Credits = credits;
        IsMandatory = isMandatory;
        BadgeLevel = badgeLevel;
        Duration = duration;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddChapter(TrainingChapter chapter)
    {
        _chapters.Add(chapter);
    }

    public void AddExam(Exam exam)
    {
        _exams.Add(exam);
    }
}
