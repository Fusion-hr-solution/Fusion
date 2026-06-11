using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Certifications.Services;

public class CertificateIssuanceService : ICertificateIssuanceService
{
    private const int MaxNumberAttempts = 5;

    private readonly TrainingDbContext _db;
    private readonly ICertificateNumberGenerator _numbers;
    private readonly ICertificateQrService _qr;
    private readonly ICertificatePdfService _pdf;
    private readonly ICertificateUrlBuilder _urls;
    private readonly ILogger<CertificateIssuanceService> _logger;

    public CertificateIssuanceService(
        TrainingDbContext db,
        ICertificateNumberGenerator numbers,
        ICertificateQrService qr,
        ICertificatePdfService pdf,
        ICertificateUrlBuilder urls,
        ILogger<CertificateIssuanceService> logger)
    {
        _db = db;
        _numbers = numbers;
        _qr = qr;
        _pdf = pdf;
        _urls = urls;
        _logger = logger;
    }

    public async Task<Certification?> IssueForCompletionAsync(
        Guid employeeId,
        Guid trainingId,
        string? fullNameFromContext,
        CancellationToken cancellationToken)
    {
        // 1. Eligibility — the formation must exist and opt in to certification.
        var course = await _db.Trainings
            .AsNoTracking()
            .Where(t => t.Id == trainingId)
            .Select(t => new
            {
                t.IssuesCertificate,
                t.Title,
                t.Description,
                t.Credits,
                t.Duration
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (course is null || !course.IssuesCertificate)
            return null;

        // 2. Idempotency — at most one active certificate per (employee, formation).
        var existing = await _db.Certifications
            .FirstOrDefaultAsync(
                c => c.EmployeeId == employeeId
                  && c.TrainingId == trainingId
                  && c.Status == CertificateStatus.Valid,
                cancellationToken);

        if (existing is not null)
            return existing;

        // 3. Snapshot the employee (synced profile name first, JWT fallback otherwise).
        var profile = await _db.EmployeeProfiles
            .AsNoTracking()
            .Include(p => p.Grade)
            .Include(p => p.ServiceLine)
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId, cancellationToken);

        var fullName = !string.IsNullOrWhiteSpace(profile?.FullName)
            ? profile!.FullName!
            : (fullNameFromContext ?? string.Empty);

        var completedAt = await _db.TrainingProgress
            .AsNoTracking()
            .Where(p => p.EmployeeId == employeeId && p.TrainingId == trainingId)
            .Select(p => p.CompletedAt)
            .FirstOrDefaultAsync(cancellationToken)
            ?? DateTime.UtcNow;

        var snapshot = new CertificateSnapshot(
            EmployeeId: employeeId,
            EmployeeFullName: fullName,
            GradeId: profile?.GradeId,
            GradeName: profile?.Grade?.Name,
            ServiceLineId: profile?.ServiceLineId,
            ServiceLineName: profile?.ServiceLine?.Name,
            TrainingId: trainingId,
            TrainingTitle: course.Title,
            TrainingDescription: course.Description,
            Credits: course.Credits,
            Duration: course.Duration,
            TrainerName: null, // online formations have no trainer; in-person issuance is deferred
            CompletedAt: completedAt);

        // 4. Unique number (regenerate on the astronomically rare collision).
        var number = await GenerateUniqueNumberAsync(completedAt.Year, cancellationToken);

        var certificate = new Certification(number, snapshot);
        _db.Certifications.Add(certificate);

        // 5. Inline best-effort PDF — never blocks the row from being recorded.
        TryAttachPdf(certificate);

        return certificate;
    }

    private async Task<string> GenerateUniqueNumberAsync(int year, CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < MaxNumberAttempts; attempt++)
        {
            var candidate = _numbers.Generate(year);
            var taken = await _db.Certifications
                .AsNoTracking()
                .AnyAsync(c => c.CertificateNumber == candidate, cancellationToken);

            if (!taken)
                return candidate;
        }

        // Fall back to the last candidate; the unique index is the final guard.
        return _numbers.Generate(year);
    }

    private void TryAttachPdf(Certification certificate)
    {
        try
        {
            var verificationUrl = _urls.BuildVerificationUrl(certificate.CertificateNumber);
            var qrPng = _qr.GeneratePng(verificationUrl);
            var pdf = _pdf.Generate(certificate, qrPng, verificationUrl);
            certificate.AttachPdf(pdf, "application/pdf");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Certificate {Number} row recorded but PDF generation failed; it will be regenerated on demand.",
                certificate.CertificateNumber);
        }
    }
}
