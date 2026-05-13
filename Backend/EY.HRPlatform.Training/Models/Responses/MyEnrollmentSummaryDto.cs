namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>Summary of an employee's enrollments for one training.</summary>
public class MyEnrollmentSummaryDto
{
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public int TotalEnrolledParts { get; set; }
    public DateTime? NextSessionUtc { get; set; }
    public List<MyEnrollmentSessionDto> Sessions { get; set; } = [];
}

/// <summary>One session enrollment detail.</summary>
public class MyEnrollmentSessionDto
{
    public Guid EnrollmentId { get; set; }
    public Guid SessionId { get; set; }
    public Guid PartId { get; set; }
    public string PartTitle { get; set; } = string.Empty;
    public int PartOrderIndex { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string Room { get; set; } = string.Empty;
    public string? TrainerName { get; set; }
    public string? TrainerEmail { get; set; }
    public string Status { get; set; } = "Enrolled";
    public int WaitlistPosition { get; set; }
    public int MaxCapacity { get; set; }
    public DateTime EnrolledAt { get; set; }
}
