using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class CreateTrainingBudgetCommandHandler : ICommandHandler<CreateTrainingBudgetCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public CreateTrainingBudgetCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(CreateTrainingBudgetCommand request, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<PeriodType>(request.PeriodType, true, out var periodType))
            return Result.Failure<Guid>(Error.Validation("TrainingBudget.InvalidPeriodType",
                $"Invalid period type '{request.PeriodType}'. Valid values: Annual, Quarterly, Custom."));

        if (request.PeriodEnd <= request.PeriodStart)
            return Result.Failure<Guid>(Error.Validation("TrainingBudget.InvalidPeriod",
                "Period end must be after period start."));

        var serviceLineExists = await _db.ServiceLines
            .AnyAsync(s => s.Id == request.ServiceLineId, cancellationToken);
        if (!serviceLineExists)
            return Result.Failure<Guid>(Error.NotFound("ServiceLine", request.ServiceLineId));

        // Non-overlap per service line: half-open [start, end); adjacent periods (end == next start) are fine.
        var overlaps = await _db.TrainingBudgets.AnyAsync(b =>
            b.ServiceLineId == request.ServiceLineId &&
            request.PeriodStart < b.PeriodEnd &&
            request.PeriodEnd > b.PeriodStart, cancellationToken);
        if (overlaps)
            return Result.Failure<Guid>(Error.Conflict("TrainingBudget.PeriodOverlap",
                "A budget period for this service line overlaps an existing one."));

        var budget = new TrainingBudget(
            request.ServiceLineId, periodType, request.PeriodStart, request.PeriodEnd, request.AllocatedAmount);

        _db.TrainingBudgets.Add(budget);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(budget.Id);
    }
}
