using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Queries;

public sealed record GetEmployeeCheckInsQuery(Guid CycleId) : IQuery<Result<EmployeeCheckInsDto>>;

public sealed class GetEmployeeCheckInsQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetEmployeeCheckInsQuery, Result<EmployeeCheckInsDto>>
{
    public async Task<Result<EmployeeCheckInsDto>> Handle(
        GetEmployeeCheckInsQuery request,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Failure<EmployeeCheckInsDto>(Error.Forbidden(
                "CheckIn.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));
        var now = DateTime.UtcNow;

        var checkIns = await dbContext.PerformanceCheckIns
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId && item.EmployeeId == employeeId.Value)
            .ToListAsync(cancellationToken);

        var completedCheckInIds = checkIns
            .Where(item => item.Status == CheckInStatus.Completed)
            .Select(item => item.Id)
            .ToList();

        var actionsByCheckIn = await dbContext.CheckInFollowUpActions
            .AsNoTracking()
            .Where(item => completedCheckInIds.Contains(item.CheckInId))
            .ToListAsync(cancellationToken);

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CycleId == request.CycleId && item.EmployeeId == employeeId.Value, cancellationToken);
        var employeeName = participant?.FullName ?? string.Empty;

        var upcoming = checkIns
            .Where(item => item.Status == CheckInStatus.Planned)
            .OrderBy(item => item.PlannedDate)
            .Select(item => CheckInMapper.ToSummary(item, now))
            .ToList();
        var completed = checkIns
            .Where(item => item.Status == CheckInStatus.Completed)
            .OrderByDescending(item => item.CompletedAt)
            .Select(item => CheckInMapper.ToDetail(
                item,
                employeeName,
                actionsByCheckIn.Where(action => action.CheckInId == item.Id).OrderBy(action => action.DueDate).ToList(),
                now))
            .ToList();

        var ownedActions = await dbContext.CheckInFollowUpActions
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId && item.OwnerEmployeeId == employeeId.Value)
            .ToListAsync(cancellationToken);
        var assignedActions = ownedActions
            .Where(item => item.Status == FollowUpActionStatus.Open)
            .OrderBy(item => item.DueDate)
            .Select(item => CheckInMapper.ToActionDto(item, now))
            .ToList();
        var completedActions = ownedActions
            .Where(item => item.Status == FollowUpActionStatus.Completed)
            .OrderByDescending(item => item.ResolvedAt)
            .Select(item => CheckInMapper.ToActionDto(item, now))
            .ToList();

        var signals = await dbContext.ObjectiveDiscussionSignals
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId
                           && item.RaisedByEmployeeId == employeeId.Value
                           && item.Status == DiscussionSignalStatus.Open)
            .OrderBy(item => item.RaisedAt)
            .ToListAsync(cancellationToken);

        return Result.Success(new EmployeeCheckInsDto(
            upcoming,
            completed,
            assignedActions,
            completedActions,
            signals.Select(CheckInMapper.ToSignalDto).ToList()));
    }
}
