namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>
/// An employee's own certificate as shown on "Mes Certificats". Full (unmasked) detail — it is the
/// employee's own record. Excludes the PDF bytes; those are streamed only by the download endpoint.
/// </summary>
public class MyCertificateDto
{
    public Guid Id { get; set; }
    public string CertificateNumber { get; set; } = string.Empty;
    public string TrainingTitle { get; set; } = string.Empty;
    public string? TrainingDescription { get; set; }
    public int Credits { get; set; }
    public string? Duration { get; set; }
    public string? TrainerName { get; set; }
    public string? GradeName { get; set; }
    public string? ServiceLineName { get; set; }
    public DateTime CompletedAt { get; set; }
    public DateTime IssuedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? RevokedAt { get; set; }
    public string? RevokedReason { get; set; }
}
