using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

public class TrainingCourse : AggregateRoot
{
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public int Credits { get; private set; }
    public bool IsMandatory { get; private set; }

    /// <summary>Whether completing this formation issues a nominative certificate. Defaults to true.</summary>
    public bool IssuesCertificate { get; private set; } = true;

    public BadgeLevel BadgeLevel { get; private set; }
    public string? Duration { get; private set; }
    public TrainingType TrainingType { get; private set; } = TrainingType.ELearning;
    public DateTime? ScheduledDate { get; private set; }

    public bool IsDeleted { get; private set; } = false;
    public DateTime? DeletedAt { get; private set; }

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

    private readonly List<OnSiteCourse> _onSiteCourses = [];
    public IReadOnlyCollection<OnSiteCourse> OnSiteCourses => _onSiteCourses.AsReadOnly();

    private readonly List<TrainingPart> _parts = [];
    public IReadOnlyCollection<TrainingPart> Parts => _parts.AsReadOnly();

    private TrainingCourse() { }

    public TrainingCourse(
        string title,
        string? description,
        int credits,
        bool isMandatory,
        BadgeLevel badgeLevel,
        Guid categoryId,
        string? duration = null,
        TrainingType trainingType = TrainingType.ELearning,
        DateTime? scheduledDate = null)
    {
        Title = title;
        Description = description;
        Credits = credits;
        IsMandatory = isMandatory;
        BadgeLevel = badgeLevel;
        CategoryId = categoryId;
        Duration = duration;
        TrainingType = trainingType;
        ScheduledDate = scheduledDate;
    }

    public void Update(string title, string? description, int credits, bool isMandatory, BadgeLevel badgeLevel, string? duration,
        TrainingType? trainingType = null, DateTime? scheduledDate = null)
    {
        Title = title;
        Description = description;
        Credits = credits;
        IsMandatory = isMandatory;
        BadgeLevel = badgeLevel;
        Duration = duration;
        if (trainingType.HasValue) TrainingType = trainingType.Value;
        ScheduledDate = scheduledDate;
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

    public void RemoveChapter(TrainingChapter chapter)
    {
        _chapters.Remove(chapter);
    }

    public void AddOnSiteCourse(OnSiteCourse course)
    {
        _onSiteCourses.Add(course);
    }

    public void RemoveOnSiteCourse(OnSiteCourse course)
    {
        _onSiteCourses.Remove(course);
    }

    public void UpdateCategory(Guid categoryId)
    {
        CategoryId = categoryId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetIssuesCertificate(bool issuesCertificate)
    {
        IssuesCertificate = issuesCertificate;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() => (IsDeleted, DeletedAt) = (true, DateTime.UtcNow);

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        UpdatedAt = DateTime.UtcNow;
    }
}
