namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>Exam shape sent to the learner. Correct answers are intentionally omitted.</summary>
public class ExamForLearnerDto
{
    public Guid Id { get; set; }
    public Guid TrainingId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int PassingScore { get; set; }
    public int? DurationMinutes { get; set; }
    public int QuestionCount { get; set; }
    public List<ExamQuestionForLearnerDto> Questions { get; set; } = [];
}

public class ExamQuestionForLearnerDto
{
    public Guid Id { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public int Points { get; set; }
    public List<ExamOptionForLearnerDto> Options { get; set; } = [];
}

public class ExamOptionForLearnerDto
{
    public Guid Id { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
}
