using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.EmployeeObjectives;

public sealed class EmployeeObjectivePlanAccessGuard(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
{
    public async Task<Result<PerformanceCycleParticipant>> RequireParticipantAsync(
        Guid cycleId,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure<PerformanceCycleParticipant>(Error.Forbidden(
                "EmployeeObjectivePlan.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == cycleId && item.EmployeeId == employeeId.Value,
                cancellationToken);

        if (participant is null)
            return Result.Failure<PerformanceCycleParticipant>(Error.Forbidden(
                "EmployeeObjectivePlan.NotParticipantForbidden",
                "Only included campaign participants can manage their objective plan."));

        return Result.Success(participant);
    }

    public Result EnsureOwnPlan(EmployeeObjectivePlan plan)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure(Error.Forbidden(
                "EmployeeObjectivePlan.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        if (plan.EmployeeId != employeeId.Value)
            return Result.Failure(Error.Forbidden(
                "EmployeeObjectivePlan.NotOwnerForbidden",
                "You can only manage your own objective plan."));

        return Result.Success();
    }
}
