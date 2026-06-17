using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Certifications.Commands;

public record ReinstateCertificateCommand(Guid CertificateId, string? ReinstatedBy) : ICommand<Result>;

public class ReinstateCertificateCommandHandler : ICommandHandler<ReinstateCertificateCommand, Result>
{
    private readonly TrainingDbContext _db;
    private readonly ILogger<ReinstateCertificateCommandHandler> _logger;

    public ReinstateCertificateCommandHandler(TrainingDbContext db, ILogger<ReinstateCertificateCommandHandler> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<Result> Handle(ReinstateCertificateCommand request, CancellationToken cancellationToken)
    {
        var certificate = await _db.Certifications
            .FirstOrDefaultAsync(c => c.Id == request.CertificateId, cancellationToken);

        if (certificate is null)
            return Result.Failure(Error.NotFound("Certificate", request.CertificateId));

        if (certificate.Status != CertificateStatus.Revoked)
            return Result.Failure(Error.Conflict("Certificate.NotRevoked", "Only a revoked certificate can be reinstated."));

        // Reinstating would create a second active certificate for the same (employee, formation),
        // which the one-active-cert invariant forbids — e.g. when the formation was re-completed.
        var activeExists = await _db.Certifications.AnyAsync(
            c => c.EmployeeId == certificate.EmployeeId
              && c.TrainingId == certificate.TrainingId
              && c.Status == CertificateStatus.Valid
              && c.Id != certificate.Id,
            cancellationToken);

        if (activeExists)
            return Result.Failure(Error.Conflict(
                "Certificate.ActiveExists",
                "A newer active certificate already exists for this formation; this one cannot be reinstated."));

        certificate.Reinstate(request.ReinstatedBy);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Certificate {Number} reinstated by {Admin}",
            certificate.CertificateNumber, request.ReinstatedBy);

        return Result.Success();
    }
}
