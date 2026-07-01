using EY.HRPlatform.Performance.Features.CollectiveObjectives.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CollectiveObjectives.Queries;

/// <summary>
/// Lists collective (team) objectives with strategic parent provenance (D-15).
/// Deny-by-default: requires CanViewCollectiveObjectives + valid scope.
/// Provenance (parent id/title) visible without exposing strategic parent content.
/// </summary>
public sealed record GetCollectiveObjectivesQuery(
    Guid? CycleId = null,
    Guid? StrategicParentId = null) : IQuery<Result<IReadOnlyList<CollectiveObjectiveDto>>>;

public sealed class GetCollectiveObjectivesQueryHandler(
    PerformanceDbContext dbContext,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor) : IQueryHandler<GetCollectiveObjectivesQuery, Result<IReadOnlyList<CollectiveObjectiveDto>>>
{
    public async Task<Result<IReadOnlyList<CollectiveObjectiveDto>>> Handle(
        GetCollectiveObjectivesQuery request,
        CancellationToken cancellationToken)
    {
        // D-15: deny-by-default read-scoping for collective objectives
        if (!accessPolicy.CanViewCollectiveObjectives(httpContextAccessor.HttpContext!.User))
            return Result.Failure<IReadOnlyList<CollectiveObjectiveDto>>(
                Error.Forbidden("Collective.Forbidden",
                    "You do not have permission to view collective objectives."));

        // Build a joined query: collective objectives + strategic parent for provenance
        var query = from obj in dbContext.PerformanceObjectives
                    join strategic in dbContext.StrategicObjectives
                        on obj.ParentObjectiveId equals strategic.Id into strategicJoin
                    from s in strategicJoin.DefaultIfEmpty()
                    where obj.Level == Domain.Enums.ObjectiveLevel.Team
                    select new { obj, s };

        if (request.CycleId.HasValue)
            query = query.Where(x => x.obj.CycleId == request.CycleId.Value);

        if (request.StrategicParentId.HasValue)
            query = query.Where(x => x.obj.ParentObjectiveId == request.StrategicParentId.Value);

        var results = await query
            .OrderBy(x => x.obj.Title)
            .Select(x => new CollectiveObjectiveDto(
                x.obj.Id,
                x.obj.CycleId,
                x.obj.OwnerEmployeeId,
                x.obj.ParentObjectiveId,
                x.s != null ? x.s.Title : null, // ParentStrategicTitle provenance (D-15)
                x.obj.Title,
                x.obj.Description,
                x.obj.Weight,
                x.obj.DueDate,
                x.obj.Status.ToString(),
                x.obj.SubmittedAt,
                x.obj.ApprovedAt,
                x.obj.Version))
            .ToListAsync(cancellationToken);

        return results;
    }
}
