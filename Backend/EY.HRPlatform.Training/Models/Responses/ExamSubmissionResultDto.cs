namespace EY.HRPlatform.Training.Models.Responses;

public class ExamSubmissionResultDto
{
    public Guid AttemptId { get; set; }
    public int Score { get; set; }
    public int PassingScore { get; set; }
    public int TotalQuestions { get; set; }
    public int CorrectAnswers { get; set; }
    public bool Passed { get; set; }
    public DateTime AttemptedAt { get; set; }
    public bool TrainingCompleted { get; set; }
}
