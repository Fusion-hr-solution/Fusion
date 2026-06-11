using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Certifications.Queries;

public record VerifyCertificateQuery(string CertificateNumber) : IQuery<Result<CertificateVerificationDto>>;

public class VerifyCertificateQueryHandler : IQueryHandler<VerifyCertificateQuery, Result<CertificateVerificationDto>>
{
    private readonly TrainingDbContext _db;

    public VerifyCertificateQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<CertificateVerificationDto>> Handle(VerifyCertificateQuery request, CancellationToken cancellationToken)
    {
        var number = request.CertificateNumber?.Trim();
        if (string.IsNullOrWhiteSpace(number))
            return Result.Failure<CertificateVerificationDto>(new Error("Certificate.NotFound", "Certificate not found."));

        // Projection deliberately excludes PdfContent and the raw full name.
        var cert = await _db.Certifications
            .AsNoTracking()
            .Where(c => c.CertificateNumber == number)
            .Select(c => new
            {
                c.CertificateNumber,
                c.EmployeeFullName,
                c.TrainingTitle,
                c.IssuedAt,
                c.Status
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (cert is null)
            return Result.Failure<CertificateVerificationDto>(new Error("Certificate.NotFound", "Certificate not found."));

        return Result.Success(new CertificateVerificationDto
        {
            CertificateNumber = cert.CertificateNumber,
            MaskedEmployeeName = CertificateNameMasking.Mask(cert.EmployeeFullName),
            TrainingTitle = cert.TrainingTitle,
            IssuedAt = cert.IssuedAt,
            Status = cert.Status.ToString()
        });
    }
}
