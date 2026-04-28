using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetCompletionTrendQueryHandler
    : IQueryHandler<GetCompletionTrendQuery, Result<CompletionTrendDto>>
{
    private readonly TrainingDbContext _db;

    public GetCompletionTrendQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<CompletionTrendDto>> Handle(
        GetCompletionTrendQuery request, CancellationToken cancellationToken)
    {
        var cutoff = DateTime.UtcNow.AddMonths(-12);

        var monthlyData = await _db.TrainingProgress
            .Where(tp => tp.CreatedAt >= cutoff)
            .GroupBy(tp => new { tp.CreatedAt.Year, tp.CreatedAt.Month })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Total = g.Count(),
                Completed = g.Count(tp => tp.Status == TrainingStatus.Completed)
            })
            .OrderBy(x => x.Year)
            .ThenBy(x => x.Month)
            .ToListAsync(cancellationToken);

        var points = monthlyData.Select(m => new CompletionTrendPointDto
        {
            Year = m.Year,
            Month = m.Month,
            Label = new DateTime(m.Year, m.Month, 1).ToString("MMM yyyy"),
            CompletionRate = m.Total > 0
                ? Math.Round((double)m.Completed / m.Total * 100, 1)
                : 0,
            CompletedCount = m.Completed,
            TotalCount = m.Total
        }).ToList();

        return Result.Success(new CompletionTrendDto { Points = points });
    }
}
