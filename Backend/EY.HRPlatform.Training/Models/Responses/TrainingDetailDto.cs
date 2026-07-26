namespace EY.HRPlatform.Training.Models.Responses;

public class TrainingDetailDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Credits { get; set; }
    public bool IsMandatory { get; set; }
    public string BadgeLevel { get; set; } = string.Empty;
    public string? Duration { get; set; }
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string TrainingType { get; set; } = "ELearning";
    public string CostType { get; set; } = "Internal";
    public Guid? SponsoringServiceLineId { get; set; }
    public DateTime? ScheduledDate { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Average learner OverallRating (1..5, 2 decimals) from post-training feedback; null when unrated.</summary>
    public double? AverageRating { get; set; }
    public int RatingCount { get; set; }

    public List<ChapterDto> Chapters { get; set; } = [];
    public List<ExamDto> Exams { get; set; } = [];
    public List<OnSiteCourseDto> OnSiteCourses { get; set; } = [];
}

public class ChapterDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Layout { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public int BlockCount { get; set; }
}

public class ExamDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int PassingScore { get; set; }
    public int QuestionCount { get; set; }
}
