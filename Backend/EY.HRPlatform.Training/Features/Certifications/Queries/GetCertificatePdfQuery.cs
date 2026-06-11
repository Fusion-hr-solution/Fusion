using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Features.Certifications.Services;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Certifications.Queries;

public record GetCertificatePdfQuery(string CertificateNumber, Guid RequestingUserId, bool IsAdmin)
    : IQuery<Result<CertificatePdfResult>>;

public record CertificatePdfResult(byte[] Content, string ContentType, string FileName);

public class GetCertificatePdfQueryHandler : IQueryHandler<GetCertificatePdfQuery, Result<CertificatePdfResult>>
{
    private readonly TrainingDbContext _db;
    private readonly ICertificateUrlBuilder _urls;
    private readonly ICertificateQrService _qr;
    private readonly ICertificatePdfService _pdf;

    public GetCertificatePdfQueryHandler(
        TrainingDbContext db,
        ICertificateUrlBuilder urls,
        ICertificateQrService qr,
        ICertificatePdfService pdf)
    {
        _db = db;
        _urls = urls;
        _qr = qr;
        _pdf = pdf;
    }

    public async Task<Result<CertificatePdfResult>> Handle(GetCertificatePdfQuery request, CancellationToken cancellationToken)
    {
        var number = request.CertificateNumber?.Trim();
        if (string.IsNullOrWhiteSpace(number))
            return Result.Failure<CertificatePdfResult>(new Error("Certificate.NotFound", "Certificate not found."));

        // Tracked load — the entity may be mutated (lazy PDF regeneration) and saved below.
        var certificate = await _db.Certifications
            .FirstOrDefaultAsync(c => c.CertificateNumber == number, cancellationToken);

        if (certificate is null)
            return Result.Failure<CertificatePdfResult>(new Error("Certificate.NotFound", "Certificate not found."));

        // Only the owner (or an admin) may download the PDF.
        if (certificate.EmployeeId != request.RequestingUserId && !request.IsAdmin)
            return Result.Failure<CertificatePdfResult>(new Error("Certificate.Forbidden", "You cannot access this certificate."));

        // Lazy regeneration — the PDF is a deterministic cache of the snapshot.
        if (certificate.PdfContent is null || certificate.PdfContent.Length == 0)
        {
            var url = _urls.BuildVerificationUrl(certificate.CertificateNumber);
            var bytes = _pdf.Generate(certificate, _qr.GeneratePng(url), url);
            certificate.AttachPdf(bytes, "application/pdf");
            await _db.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(new CertificatePdfResult(
            certificate.PdfContent!,
            certificate.PdfContentType ?? "application/pdf",
            $"{certificate.CertificateNumber}.pdf"));
    }
}
