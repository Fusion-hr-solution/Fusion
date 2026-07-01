using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Features.Admin.Budget;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public record GetBudgetDashboardSummaryQuery(DateTime? From, DateTime? To, Guid? ServiceLineId)
    : IQuery<Result<BudgetDashboardSummaryDto>>;

public class GetBudgetDashboardSummaryQueryHandler
    : IQueryHandler<GetBudgetDashboardSummaryQuery, Result<BudgetDashboardSummaryDto>>
{
    private readonly TrainingDbContext _db;

    public GetBudgetDashboardSummaryQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<BudgetDashboardSummaryDto>> Handle(
        GetBudgetDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        var query = _db.TrainingBudgets.AsNoTracking().AsQueryable();
        if (request.ServiceLineId.HasValue)
            query = query.Where(b => b.ServiceLineId == request.ServiceLineId.Value);

        var budgets = await query.ToListAsync(cancellationToken);

        // A budget overlaps the selected window when it starts before the window ends and ends after
        // it starts (half-open). Null from/to means open-ended on that side.
        var from = request.From;
        var to = request.To;
        var overlapping = budgets
            .Where(b => (to == null || b.PeriodStart < to.Value) && (from == null || b.PeriodEnd > from.Value))
            .ToList();

        var slLookup = (await _db.ServiceLines.AsNoTracking()
                .Select(s => new { s.Id, s.Name, s.Color })
                .ToListAsync(cancellationToken))
            .ToDictionary(s => s.Id, s => (s.Name, s.Color));

        var perServiceLine = new Dictionary<Guid, (decimal Allocated, decimal Spent)>();
        foreach (var b in overlapping)
        {
            var spend = await BudgetSpendCalculator.ComputeSpendAsync(
                _db, b.ServiceLineId, b.PeriodStart, b.PeriodEnd, cancellationToken);
            perServiceLine.TryGetValue(b.ServiceLineId, out var acc);
            perServiceLine[b.ServiceLineId] = (acc.Allocated + b.AllocatedAmount, acc.Spent + spend);
        }

        var rows = perServiceLine
            .Select(kv =>
            {
                var allocated = kv.Value.Allocated;
                var spent = kv.Value.Spent;
                slLookup.TryGetValue(kv.Key, out var sl);
                return new BudgetByServiceLineDto
                {
                    ServiceLineId = kv.Key,
                    ServiceLineName = sl.Name ?? "Unknown",
                    Color = sl.Color ?? "#000000",
                    Allocated = allocated,
                    Spent = spent,
                    Remaining = allocated - spent,
                    PercentConsumed = allocated == 0m ? 0m : Math.Round(spent / allocated * 100m, 2),
                };
            })
            .OrderBy(r => r.ServiceLineName)
            .ToList();

        var totalAllocated = rows.Sum(r => r.Allocated);
        var totalSpent = rows.Sum(r => r.Spent);

        var summary = new BudgetDashboardSummaryDto
        {
            TotalAllocated = totalAllocated,
            TotalSpent = totalSpent,
            TotalRemaining = totalAllocated - totalSpent,
            PercentConsumed = totalAllocated == 0m ? 0m : Math.Round(totalSpent / totalAllocated * 100m, 2),
            ByServiceLine = rows,
            Alerts = rows
                .Where(r => r.PercentConsumed >= 80m)
                .Select(r => new BudgetServiceLineAlertDto
                {
                    ServiceLineId = r.ServiceLineId,
                    ServiceLineName = r.ServiceLineName,
                    PercentConsumed = r.PercentConsumed,
                    ThresholdBand = r.PercentConsumed >= 100m ? 100 : r.PercentConsumed >= 90m ? 90 : 80,
                })
                .OrderByDescending(a => a.PercentConsumed)
                .ToList(),
        };

        return Result.Success(summary);
    }
}
