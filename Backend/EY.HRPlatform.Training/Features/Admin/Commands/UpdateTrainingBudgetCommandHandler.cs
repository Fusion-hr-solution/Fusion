using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpdateTrainingBudgetCommandHandler : ICommandHandler<UpdateTrainingBudgetCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateTrainingBudgetCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateTrainingBudgetCommand request, CancellationToken cancellationToken)
    {
        var budget = await _db.TrainingBudgets
            .FirstOrDefaultAsync(b => b.Id == request.BudgetId, cancellationToken);

        if (budget is null)
            return Result.Failure(Error.NotFound("TrainingBudget", request.BudgetId));

        if (!Enum.TryParse<PeriodType>(request.PeriodType, true, out var periodType))
            return Result.Failure(Error.Validation("TrainingBudget.InvalidPeriodType",
                $"Invalid period type '{request.PeriodType}'. Valid values: Annual, Quarterly, Custom."));

        if (request.PeriodEnd <= request.PeriodStart)
            return Result.Failure(Error.Validation("TrainingBudget.InvalidPeriod",
                "Period end must be after period start."));

        // Non-overlap per service line, excluding this budget itself.
        var overlaps = await _db.TrainingBudgets.AnyAsync(b =>
            b.Id != request.BudgetId &&
            b.ServiceLineId == budget.ServiceLineId &&
            request.PeriodStart < b.PeriodEnd &&
            request.PeriodEnd > b.PeriodStart, cancellationToken);
        if (overlaps)
            return Result.Failure(Error.Conflict("TrainingBudget.PeriodOverlap",
                "A budget period for this service line overlaps an existing one."));

        budget.Update(periodType, request.PeriodStart, request.PeriodEnd, request.AllocatedAmount);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
