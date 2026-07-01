using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class DeleteTrainingBudgetCommandHandler : ICommandHandler<DeleteTrainingBudgetCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteTrainingBudgetCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteTrainingBudgetCommand request, CancellationToken cancellationToken)
    {
        var budget = await _db.TrainingBudgets
            .FirstOrDefaultAsync(b => b.Id == request.BudgetId, cancellationToken);

        if (budget is null)
            return Result.Failure(Error.NotFound("TrainingBudget", request.BudgetId));

        // No dependent-entity guard — costs live on sessions and are not FK-linked to budgets.
        _db.TrainingBudgets.Remove(budget);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
