namespace EY.HRPlatform.Training.Models.Responses;

public class MySessionEnrollmentsDto
{
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public int TotalParts { get; set; }
    public int CompletedParts { get; set; }
    public bool IsTrainingCompleted { get; set; }
    public List<MyPartEnrollmentDto> Parts { get; set; } = [];
}

public class MyPartEnrollmentDto
{
    public Guid PartId { get; set; }
    public string PartTitle { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public Guid? SessionId { get; set; }
    public DateTime? SessionStartUtc { get; set; }
    public DateTime? SessionEndUtc { get; set; }
    public string? Room { get; set; }
    public string? TrainerName { get; set; }
    public string EnrollmentStatus { get; set; } = string.Empty;
    public bool IsAttended { get; set; }
}
