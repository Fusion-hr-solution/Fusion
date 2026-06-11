using EY.HRPlatform.Training.Domain.Entities;

namespace EY.HRPlatform.Training.Features.Certifications.Services;

/// <summary>
/// Issues a certificate when a formation is completed. Trigger-agnostic: any completion path can
/// call it. Stages the (snapshotted) certificate row into the supplied unit of work — it does NOT
/// call SaveChanges, so the row commits atomically with the completion that triggered it. The PDF
/// is generated inline best-effort: a PDF failure never prevents the row from being recorded.
/// </summary>
public interface ICertificateIssuanceService
{
    /// <param name="fullNameFromContext">
    /// Fallback display name (e.g. the authenticated user's JWT full name) used only when the
    /// employee's synced profile name is not yet available.
    /// </param>
    /// <returns>The issued (or already-existing active) certificate, or null when not eligible.</returns>
    Task<Certification?> IssueForCompletionAsync(
        Guid employeeId,
        Guid trainingId,
        string? fullNameFromContext,
        CancellationToken cancellationToken);
}
