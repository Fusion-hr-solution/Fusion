using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Certifications.Queries;

public record GetCertificateStatsQuery : IQuery<Result<CertificateStatsDto>>;

public class GetCertificateStatsQueryHandler : IQueryHandler<GetCertificateStatsQuery, Result<CertificateStatsDto>>
{
    private readonly TrainingDbContext _db;

    public GetCertificateStatsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<CertificateStatsDto>> Handle(GetCertificateStatsQuery request, CancellationToken cancellationToken)
    {
        var certs = _db.Certifications.AsNoTracking();

        var total = await certs.CountAsync(cancellationToken);
        var revoked = await certs.CountAsync(c => c.Status == CertificateStatus.Revoked, cancellationToken);

        var byTrainingRaw = await certs
            .GroupBy(c => c.TrainingTitle)
            .Select(g => new { Title = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToListAsync(cancellationToken);

        var byMonthRaw = await certs
            .GroupBy(c => new { c.IssuedAt.Year, c.IssuedAt.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var stats = new CertificateStatsDto
        {
            Total = total,
            RevokedCount = revoked,
            ValidCount = total - revoked,
            ByTraining = byTrainingRaw
                .Select(x => new CertificateCountByKeyDto { Key = x.Title, Count = x.Count })
                .ToList(),
            ByMonth = byMonthRaw
                .OrderBy(x => x.Year).ThenBy(x => x.Month)
                .Select(x => new CertificateCountByKeyDto { Key = $"{x.Year:D4}-{x.Month:D2}", Count = x.Count })
                .ToList()
        };

        return Result.Success(stats);
    }
}
