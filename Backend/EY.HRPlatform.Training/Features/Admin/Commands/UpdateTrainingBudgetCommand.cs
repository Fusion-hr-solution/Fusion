using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record UpdateTrainingBudgetCommand(
    Guid BudgetId,
    string PeriodType,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    decimal AllocatedAmount) : ICommand<Result>;
