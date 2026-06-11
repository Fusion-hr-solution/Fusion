using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Certifications.Queries;

public record GetCertificateRegistryForExportQuery(
    Guid? TrainingId, Guid? GradeId, DateTime? From, DateTime? To, string? Status, string? Search)
    : IQuery<Result<List<CertificateRegistryDto>>>;

public class GetCertificateRegistryForExportQueryHandler
    : IQueryHandler<GetCertificateRegistryForExportQuery, Result<List<CertificateRegistryDto>>>
{
    // Safety cap so an export can never load an unbounded result set into memory.
    private const int MaxRows = 10_000;

    private readonly TrainingDbContext _db;

    public GetCertificateRegistryForExportQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<CertificateRegistryDto>>> Handle(
        GetCertificateRegistryForExportQuery request, CancellationToken cancellationToken)
    {
        var query = CertificateRegistryFilter.Apply(
            _db.Certifications.AsNoTracking(),
            request.TrainingId, request.GradeId, request.From, request.To, request.Status, request.Search);

        var rows = await query
            .OrderByDescending(c => c.IssuedAt)
            .Take(MaxRows)
            .Select(c => new CertificateRegistryDto
            {
                Id = c.Id,
                CertificateNumber = c.CertificateNumber,
                EmployeeId = c.EmployeeId,
                EmployeeFullName = c.EmployeeFullName,
                GradeName = c.GradeName,
                ServiceLineName = c.ServiceLineName,
                TrainingId = c.TrainingId,
                TrainingTitle = c.TrainingTitle,
                Credits = c.Credits,
                CompletedAt = c.CompletedAt,
                IssuedAt = c.IssuedAt,
                Status = c.Status.ToString(),
                RevokedAt = c.RevokedAt,
                RevokedReason = c.RevokedReason,
                RevokedBy = c.RevokedBy
            })
            .ToListAsync(cancellationToken);

        return Result.Success(rows);
    }
}
