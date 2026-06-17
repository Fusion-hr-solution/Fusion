namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>One row of the admin certificate registry. Full (unmasked) detail — admin-only. No PDF bytes.</summary>
public class CertificateRegistryDto
{
    public Guid Id { get; set; }
    public string CertificateNumber { get; set; } = string.Empty;
    public Guid EmployeeId { get; set; }
    public string EmployeeFullName { get; set; } = string.Empty;
    public string? GradeName { get; set; }
    public string? ServiceLineName { get; set; }
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public int Credits { get; set; }
    public DateTime CompletedAt { get; set; }
    public DateTime IssuedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? RevokedAt { get; set; }
    public string? RevokedReason { get; set; }
    public string? RevokedBy { get; set; }
}
