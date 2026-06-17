using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Certifications.Commands;

public record RevokeCertificateCommand(Guid CertificateId, string Reason, string? RevokedBy) : ICommand<Result>;

public class RevokeCertificateCommandHandler : ICommandHandler<RevokeCertificateCommand, Result>
{
    private readonly TrainingDbContext _db;

    public RevokeCertificateCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(RevokeCertificateCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return Result.Failure(Error.Validation("Certificate.RevokeReasonRequired", "A revocation reason is required."));

        var certificate = await _db.Certifications
            .FirstOrDefaultAsync(c => c.Id == request.CertificateId, cancellationToken);

        if (certificate is null)
            return Result.Failure(Error.NotFound("Certificate", request.CertificateId));

        if (certificate.Status == CertificateStatus.Revoked)
            return Result.Failure(Error.Conflict("Certificate.AlreadyRevoked", "This certificate is already revoked."));

        // Revocation is terminal — the certificate is never edited or restored (see ADR-0001).
        certificate.Revoke(request.Reason.Trim(), request.RevokedBy);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
