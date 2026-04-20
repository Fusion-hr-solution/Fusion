namespace EY.HRPlatform.Training.Models.Responses;

public class ExamAttemptDto
{
    public Guid Id { get; set; }
    public Guid ExamId { get; set; }
    public int Score { get; set; }
    public int TotalQuestions { get; set; }
    public int CorrectAnswers { get; set; }
    public bool Passed { get; set; }
    public DateTime AttemptedAt { get; set; }
}
