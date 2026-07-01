using System.Globalization;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public record GetBudgetSpendTrendQuery(DateTime? From, DateTime? To, Guid? ServiceLineId)
    : IQuery<Result<BudgetTrendDto>>;

public class GetBudgetSpendTrendQueryHandler
    : IQueryHandler<GetBudgetSpendTrendQuery, Result<BudgetTrendDto>>
{
    private readonly TrainingDbContext _db;

    public GetBudgetSpendTrendQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<BudgetTrendDto>> Handle(
        GetBudgetSpendTrendQuery request, CancellationToken cancellationToken)
    {
        var q = _db.TrainingSessions
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(s => s.Status != SessionStatus.Cancelled && s.Part.Training.CostType == CostType.External);

        if (request.ServiceLineId.HasValue)
            q = q.Where(s => s.Part.Training.SponsoringServiceLineId == request.ServiceLineId.Value);
        if (request.From.HasValue)
            q = q.Where(s => s.StartUtc >= request.From.Value);
        if (request.To.HasValue)
            q = q.Where(s => s.StartUtc < request.To.Value);

        var grouped = await q
            .GroupBy(s => new { s.StartUtc.Year, s.StartUtc.Month })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Spend = g.Sum(s => (s.ExternalTrainerCost ?? 0m) + (s.VenueCost ?? 0m)
                                 + (s.MaterialsCost ?? 0m) + (s.OtherCost ?? 0m)),
            })
            .ToListAsync(cancellationToken);

        var points = grouped
            .OrderBy(p => p.Year).ThenBy(p => p.Month)
            .Select(p => new BudgetTrendPointDto
            {
                Year = p.Year,
                Month = p.Month,
                Label = new DateTime(p.Year, p.Month, 1).ToString("MMM yyyy", CultureInfo.InvariantCulture),
                Spend = p.Spend,
            })
            .ToList();

        return Result.Success(new BudgetTrendDto { Points = points });
    }
}
