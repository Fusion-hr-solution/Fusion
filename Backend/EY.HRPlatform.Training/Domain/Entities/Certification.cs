using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// An immutable, verifiable certificate issued to a named employee on formation completion.
/// Every displayed value is snapshotted at issuance (see <see cref="CertificateSnapshot"/>) so
/// later edits to the course, the employee's grade/service line, or a course soft-delete never
/// change an issued certificate. EmployeeId/TrainingId/GradeId/ServiceLineId are kept only as
/// soft references for querying — there are no FK constraints, so a certificate survives the
/// deletion of anything it references. A certificate may be revoked but never edited.
/// </summary>
public class Certification : BaseEntity
{
    public Guid EmployeeId { get; private set; }
    public string CertificateNumber { get; private set; } = string.Empty;

    // --- Employee snapshot ---
    public string EmployeeFullName { get; private set; } = string.Empty;
    public Guid? GradeId { get; private set; }
    public string? GradeName { get; private set; }
    public Guid? ServiceLineId { get; private set; }
    public string? ServiceLineName { get; private set; }

    // --- Formation snapshot ---
    public Guid TrainingId { get; private set; }
    public string TrainingTitle { get; private set; } = string.Empty;
    public string? TrainingDescription { get; private set; }
    public int Credits { get; private set; }
    public string? Duration { get; private set; }
    public string? TrainerName { get; private set; }

    public DateTime CompletedAt { get; private set; }
    public DateTime IssuedAt { get; private set; } = DateTime.UtcNow;

    // --- Status ---
    public CertificateStatus Status { get; private set; } = CertificateStatus.Valid;
    public DateTime? RevokedAt { get; private set; }
    public string? RevokedReason { get; private set; }
    public string? RevokedBy { get; private set; }

    // --- Stored PDF (bytea). Never selected by list/verify projections — only on download. ---
    public byte[]? PdfContent { get; private set; }
    public string? PdfContentType { get; private set; }
    public DateTime? PdfGeneratedAt { get; private set; }

    private Certification() { }

    public Certification(string certificateNumber, CertificateSnapshot snapshot)
    {
        CertificateNumber = certificateNumber;
        EmployeeId = snapshot.EmployeeId;
        EmployeeFullName = snapshot.EmployeeFullName;
        GradeId = snapshot.GradeId;
        GradeName = snapshot.GradeName;
        ServiceLineId = snapshot.ServiceLineId;
        ServiceLineName = snapshot.ServiceLineName;
        TrainingId = snapshot.TrainingId;
        TrainingTitle = snapshot.TrainingTitle;
        TrainingDescription = snapshot.TrainingDescription;
        Credits = snapshot.Credits;
        Duration = snapshot.Duration;
        TrainerName = snapshot.TrainerName;
        CompletedAt = snapshot.CompletedAt;
        IssuedAt = DateTime.UtcNow;
        Status = CertificateStatus.Valid;
    }

    /// <summary>Attaches (or replaces) the generated PDF bytes. The PDF is a regenerable cache.</summary>
    public void AttachPdf(byte[] content, string contentType)
    {
        PdfContent = content;
        PdfContentType = contentType;
        PdfGeneratedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Revokes the certificate, with a recorded reason.</summary>
    public void Revoke(string reason, string? revokedBy)
    {
        if (Status == CertificateStatus.Revoked)
            return;

        Status = CertificateStatus.Revoked;
        RevokedReason = reason;
        RevokedBy = revokedBy;
        RevokedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Reverses a revocation (admin mistake recovery). Clears the revocation fields and records the
    /// actor in <see cref="BaseEntity.UpdatedBy"/>. Callers must ensure no other active certificate
    /// exists for the same (employee, formation) before calling — see the one-active-cert invariant.
    /// </summary>
    public void Reinstate(string? reinstatedBy)
    {
        if (Status == CertificateStatus.Valid)
            return;

        Status = CertificateStatus.Valid;
        RevokedReason = null;
        RevokedBy = null;
        RevokedAt = null;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = reinstatedBy;
    }
}
