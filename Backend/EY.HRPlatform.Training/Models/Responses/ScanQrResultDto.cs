namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>Result returned when an employee successfully scans a session QR code.</summary>
public class ScanQrResultDto
{
    public Guid SessionId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string PartTitle { get; set; } = string.Empty;
    public DateTime SessionStartUtc { get; set; }
    public DateTime AttendedAt { get; set; }
}
