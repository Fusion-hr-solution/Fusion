namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>
/// Header info for a participant export (session/training context).
/// </summary>
public class SessionParticipantExportDto
{
    public Guid SessionId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string PartTitle { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string Room { get; set; } = string.Empty;
    public int MaxCapacity { get; set; }
    public string? TrainerName { get; set; }
    public List<SessionParticipantRowDto> Participants { get; set; } = [];
}

/// <summary>
/// One row of participant data (one enrolled or attended employee).
/// </summary>
public class SessionParticipantRowDto
{
    public Guid EmployeeId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Grade { get; set; }
    public string? ServiceLine { get; set; }
    public DateTime EnrollmentDate { get; set; }
    public string AttendanceStatus { get; set; } = string.Empty;
}
