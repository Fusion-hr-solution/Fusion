using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Budget;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public record GetBudgetReportForExportQuery(DateTime? From, DateTime? To, Guid? ServiceLineId)
    : IQuery<Result<BudgetReportDto>>;

public class GetBudgetReportForExportQueryHandler
    : IQueryHandler<GetBudgetReportForExportQuery, Result<BudgetReportDto>>
{
    private readonly TrainingDbContext _db;

    public GetBudgetReportForExportQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<BudgetReportDto>> Handle(
        GetBudgetReportForExportQuery request, CancellationToken cancellationToken)
    {
        var slLookup = (await _db.ServiceLines.AsNoTracking()
                .Select(s => new { s.Id, s.Name, s.Color })
                .ToListAsync(cancellationToken))
            .ToDictionary(s => s.Id, s => (s.Name, s.Color));

        var from = request.From;
        var to = request.To;

        // ── Per-service-line summary (budgets overlapping the window) ──
        var budgetsQuery = _db.TrainingBudgets.AsNoTracking().AsQueryable();
        if (request.ServiceLineId.HasValue)
            budgetsQuery = budgetsQuery.Where(b => b.ServiceLineId == request.ServiceLineId.Value);
        var budgets = await budgetsQuery.ToListAsync(cancellationToken);

        var overlapping = budgets
            .Where(b => (to == null || b.PeriodStart < to.Value) && (from == null || b.PeriodEnd > from.Value))
            .ToList();

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
                slLookup.TryGetValue(kv.Key, out var sl);
                var allocated = kv.Value.Allocated;
                var spent = kv.Value.Spent;
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

        // ── Contributing external sessions (detail) ──
        var detailRaw = await _db.TrainingSessions
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(s => s.Status != SessionStatus.Cancelled
                && s.Part.Training.CostType == CostType.External
                && s.Part.Training.SponsoringServiceLineId != null
                && (request.ServiceLineId == null || s.Part.Training.SponsoringServiceLineId == request.ServiceLineId)
                && (from == null || s.StartUtc >= from.Value)
                && (to == null || s.StartUtc < to.Value))
            .OrderByDescending(s => s.StartUtc)
            .Select(s => new
            {
                ServiceLineId = s.Part.Training.SponsoringServiceLineId!.Value,
                s.Part.Training.Title,
                s.StartUtc,
                Amount = (s.ExternalTrainerCost ?? 0m) + (s.VenueCost ?? 0m)
                       + (s.MaterialsCost ?? 0m) + (s.OtherCost ?? 0m),
                s.TrainerName,
            })
            .ToListAsync(cancellationToken);

        var detail = detailRaw
            .Select(d =>
            {
                slLookup.TryGetValue(d.ServiceLineId, out var sl);
                return new BudgetReportDetailRowDto
                {
                    ServiceLineName = sl.Name ?? "Unknown",
                    TrainingTitle = d.Title,
                    StartUtc = d.StartUtc,
                    Amount = d.Amount,
                    TrainerName = d.TrainerName,
                };
            })
            .ToList();

        var totalAllocated = rows.Sum(r => r.Allocated);
        var totalSpent = rows.Sum(r => r.Spent);

        string periodLabel = (from, to) switch
        {
            ({ } f, { } t) => $"{f:yyyy-MM-dd} to {t:yyyy-MM-dd}",
            ({ } f, null) => $"from {f:yyyy-MM-dd}",
            (null, { } t) => $"until {t:yyyy-MM-dd}",
            _ => "All time",
        };

        var serviceLineFilter = "All service lines";
        if (request.ServiceLineId.HasValue && slLookup.TryGetValue(request.ServiceLineId.Value, out var filterSl))
            serviceLineFilter = filterSl.Name ?? "Unknown";

        return Result.Success(new BudgetReportDto
        {
            PeriodLabel = periodLabel,
            ServiceLineFilter = serviceLineFilter,
            TotalAllocated = totalAllocated,
            TotalSpent = totalSpent,
            TotalRemaining = totalAllocated - totalSpent,
            PercentConsumed = totalAllocated == 0m ? 0m : Math.Round(totalSpent / totalAllocated * 100m, 2),
            ServiceLines = rows,
            Detail = detail,
        });
    }
}
