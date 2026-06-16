using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetTrainingBudgetsQueryHandler : IQueryHandler<GetTrainingBudgetsQuery, Result<List<TrainingBudgetDto>>>
{
    private readonly TrainingDbContext _db;

    public GetTrainingBudgetsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<TrainingBudgetDto>>> Handle(GetTrainingBudgetsQuery request, CancellationToken cancellationToken)
    {
        PeriodType? periodTypeFilter = null;
        if (!string.IsNullOrWhiteSpace(request.PeriodType))
        {
            if (!Enum.TryParse<PeriodType>(request.PeriodType, true, out var pt))
                return Result.Failure<List<TrainingBudgetDto>>(Error.Validation("TrainingBudget.InvalidPeriodType",
                    $"Invalid period type '{request.PeriodType}'. Valid values: Annual, Quarterly, Custom."));
            periodTypeFilter = pt;
        }

        var query = _db.TrainingBudgets.AsNoTracking().AsQueryable();
        if (request.ServiceLineId.HasValue)
            query = query.Where(b => b.ServiceLineId == request.ServiceLineId.Value);
        if (periodTypeFilter.HasValue)
            query = query.Where(b => b.PeriodType == periodTypeFilter.Value);

        var budgets = await query.OrderBy(b => b.PeriodStart).ToListAsync(cancellationToken);

        var result = new List<TrainingBudgetDto>(budgets.Count);
        foreach (var budget in budgets)
        {
            // Spend = committed external-session costs charged to this service line, filed by session
            // StartUtc into [PeriodStart, PeriodEnd), excluding cancelled sessions. IgnoreQueryFilters
            // so committed spend still counts even if the course was later soft-deleted.
            var spend = await _db.TrainingSessions
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(s => s.Status != SessionStatus.Cancelled
                    && s.StartUtc >= budget.PeriodStart && s.StartUtc < budget.PeriodEnd
                    && s.Part.Training.CostType == CostType.External
                    && s.Part.Training.SponsoringServiceLineId == budget.ServiceLineId)
                .Select(s => (s.ExternalTrainerCost ?? 0m) + (s.VenueCost ?? 0m)
                           + (s.MaterialsCost ?? 0m) + (s.OtherCost ?? 0m))
                .SumAsync(cancellationToken);

            result.Add(new TrainingBudgetDto
            {
                Id = budget.Id,
                ServiceLineId = budget.ServiceLineId,
                PeriodType = budget.PeriodType.ToString(),
                PeriodStart = budget.PeriodStart,
                PeriodEnd = budget.PeriodEnd,
                AllocatedAmount = budget.AllocatedAmount,
                Spend = spend,
                Remaining = budget.AllocatedAmount - spend,
                Percentage = budget.AllocatedAmount == 0m
                    ? 0m
                    : Math.Round(spend / budget.AllocatedAmount * 100m, 2)
            });
        }

        return Result.Success(result);
    }
}
