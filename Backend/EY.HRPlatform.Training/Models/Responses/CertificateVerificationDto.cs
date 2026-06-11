namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>
/// Public verification payload. Intentionally minimal: a masked name and the formation/date/status
/// only — never the full name, grade, service line, or PDF.
/// </summary>
public class CertificateVerificationDto
{
    public string CertificateNumber { get; set; } = string.Empty;
    public string MaskedEmployeeName { get; set; } = string.Empty;
    public string TrainingTitle { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public string Status { get; set; } = string.Empty;
}
