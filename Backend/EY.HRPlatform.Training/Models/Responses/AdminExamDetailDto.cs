namespace EY.HRPlatform.Training.Models.Responses;

public class AdminExamDetailDto
{
    public Guid Id { get; set; }
    public Guid TrainingId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int PassingScore { get; set; }
    public int? DurationMinutes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<AdminExamQuestionDto> Questions { get; set; } = [];
}

public class AdminExamQuestionDto
{
    public Guid Id { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public int Points { get; set; }
    public List<AdminExamOptionDto> Options { get; set; } = [];
}

public class AdminExamOptionDto
{
    public Guid Id { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int OrderIndex { get; set; }
}
