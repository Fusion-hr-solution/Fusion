using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.People;

/// <summary>The reviewer an active cycle captured at its start; a change of manager doesn't move it.</summary>
public sealed record ReviewerStaysDto(Guid CycleId, string CycleName, Guid ReviewerEmployeeId, string ReviewerName);

/// <summary>A 1:1 series with a manager the person stops reporting to; it ends on the change's date.</summary>
public sealed record OneOnOneEndsDto(Guid SeriesId, Guid ManagerEmployeeId, string ManagerName);

public sealed record LineEffectsDto(IReadOnlyList<ReviewerStaysDto> ReviewersStay, IReadOnlyList<OneOnOneEndsDto> OneOnOnesEnd);

/// <param name="NewManagerEmployeeId">Who the person will report to; null when they leave or have no manager.</param>
public sealed record GetLineEffectsQuery(Guid EmployeeId, Guid? NewManagerEmployeeId) : IQuery<Result<LineEffectsDto>>;

/// <summary>
/// What a change of reporting line does in Performance, for Core HR's change panel: the reviewer captured at an
/// active cycle's start stays, and 1:1 series with any other manager end on the date (D-12).
/// </summary>
public sealed class GetLineEffectsHandler(PerformanceDbContext db) : IQueryHandler<GetLineEffectsQuery, Result<LineEffectsDto>>
{
    public async Task<Result<LineEffectsDto>> Handle(GetLineEffectsQuery query, CancellationToken cancellationToken)
    {
        var reviewers = await (
            from participant in db.Participants.AsNoTracking()
            join cycle in db.Cycles.AsNoTracking() on participant.CycleId equals cycle.Id
            where participant.EmployeeId == query.EmployeeId
                && cycle.State == CycleLifecycleState.Active
                && participant.ManagerEmployeeId != null
                && participant.ManagerEmployeeId != query.NewManagerEmployeeId
            orderby cycle.StartDate
            select new ReviewerStaysDto(cycle.Id, cycle.Name, participant.ManagerEmployeeId!.Value, participant.ManagerDisplayName ?? ""))
            .ToListAsync(cancellationToken);
        var series = await db.OneOnOneSeries.AsNoTracking()
            .Where(item => item.ReportEmployeeId == query.EmployeeId && item.EndedAt == null
                && item.ManagerEmployeeId != query.NewManagerEmployeeId)
            .OrderBy(item => item.ManagerName)
            .Select(item => new OneOnOneEndsDto(item.Id, item.ManagerEmployeeId, item.ManagerName))
            .ToListAsync(cancellationToken);
        return Result.Success(new LineEffectsDto(reviewers, series));
    }
}
