namespace EY.HRPlatform.Training.Models.Responses;

public class EnrollInSessionsResultDto
{
    public Guid TrainingId { get; set; }
    public List<EnrollmentResultItemDto> Enrollments { get; set; } = [];
}

public class EnrollmentResultItemDto
{
    public Guid PartId { get; set; }
    public Guid SessionId { get; set; }
    public Guid EnrollmentId { get; set; }
    public string Status { get; set; } = string.Empty;
    public int WaitlistPosition { get; set; }
}
