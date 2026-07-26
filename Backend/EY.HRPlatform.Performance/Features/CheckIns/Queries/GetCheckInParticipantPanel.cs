using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CheckIns.Queries;

public sealed record GetCheckInParticipantPanelQuery(Guid CycleId, Guid EmployeeId)
    : IQuery<Result<CheckInParticipantPanelDto>>;

public sealed class GetCheckInParticipantPanelQueryHandler(
    PerformanceDbContext dbContext,
    CheckInAccessGuard accessGuard) : IQueryHandler<GetCheckInParticipantPanelQuery, Result<CheckInParticipantPanelDto>>
{
    public async Task<Result<CheckInParticipantPanelDto>> Handle(
        GetCheckInParticipantPanelQuery request,
        CancellationToken cancellationToken)
    {
        var scopeResult = await accessGuard.RequireReviewerParticipantAsync(request.CycleId, request.EmployeeId, cancellationToken);
        if (scopeResult.IsFailure)
            return Result.Failure<CheckInParticipantPanelDto>(scopeResult.Error);
        var scope = scopeResult.Value;
        var now = DateTime.UtcNow;

        var checkIns = await dbContext.PerformanceCheckIns
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId && item.EmployeeId == request.EmployeeId)
            .ToListAsync(cancellationToken);

        var upcoming = checkIns
            .Where(item => item.Status == CheckInStatus.Planned && !CheckInMapper.IsCheckInOverdue(item, now))
            .OrderBy(item => item.PlannedDate)
            .Select(item => CheckInMapper.ToSummary(item, now))
            .ToList();
        var overdue = checkIns
            .Where(item => CheckInMapper.IsCheckInOverdue(item, now))
            .OrderBy(item => item.PlannedDate)
            .Select(item => CheckInMapper.ToSummary(item, now))
            .ToList();
        var completed = checkIns
            .Where(item => item.Status == CheckInStatus.Completed)
            .OrderByDescending(item => item.CompletedAt)
            .Select(item => CheckInMapper.ToSummary(item, now))
            .ToList();

        var actions = await dbContext.CheckInFollowUpActions
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId
                           && item.EmployeeId == request.EmployeeId
                           && item.Status == FollowUpActionStatus.Open)
            .OrderBy(item => item.DueDate)
            .ToListAsync(cancellationToken);

        var signals = await dbContext.ObjectiveDiscussionSignals
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId
                           && item.RaisedByEmployeeId == request.EmployeeId
                           && item.Status == DiscussionSignalStatus.Open)
            .OrderBy(item => item.RaisedAt)
            .ToListAsync(cancellationToken);

        return Result.Success(new CheckInParticipantPanelDto(
            scope.Participant.EmployeeId,
            scope.Participant.FullName,
            signals.Select(CheckInMapper.ToSignalDto).ToList(),
            upcoming,
            overdue,
            actions.Select(item => CheckInMapper.ToActionDto(item, now)).ToList(),
            completed));
    }
}
