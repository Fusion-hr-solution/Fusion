using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Strategic.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Strategic.Queries;

public sealed record GetStrategicObjectivesQuery(Guid? PeriodId = null, string? OrgScope = null)
    : IQuery<Result<IReadOnlyList<StrategicObjectiveDto>>>;

public sealed class GetStrategicObjectivesQueryHandler(
    PerformanceDbContext dbContext,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor) : IQueryHandler<GetStrategicObjectivesQuery, Result<IReadOnlyList<StrategicObjectiveDto>>>
{
    public async Task<Result<IReadOnlyList<StrategicObjectiveDto>>> Handle(
        GetStrategicObjectivesQuery request,
        CancellationToken cancellationToken)
    {
        // D-15: deny-by-default read-scoping for strategic objectives
        if (!accessPolicy.CanViewStrategicObjectives(httpContextAccessor.HttpContext!.User))
            return Result.Failure<IReadOnlyList<StrategicObjectiveDto>>(
                Error.Forbidden("Strategic.Forbidden", "You do not have permission to view strategic objectives."));

        var query = dbContext.StrategicObjectives.AsNoTracking();

        if (request.PeriodId.HasValue)
            query = query.Where(o => o.PeriodId == request.PeriodId.Value);

        if (!string.IsNullOrWhiteSpace(request.OrgScope))
            query = query.Where(o => o.OrgScope == request.OrgScope);

        // Include Superseded versions for authorized callers (D-03: history remains readable)
        var results = await query
            .OrderBy(o => o.OrgScope)
            .ThenByDescending(o => o.VersionNumber)
            .Select(o => new StrategicObjectiveDto(
                o.Id,
                o.TenantId,
                o.PeriodId,
                o.OrgScope,
                o.Title,
                o.Description,
                o.Status.ToString(),
                o.VersionNumber,
                o.SupersededById,
                o.PublishedAt,
                o.Version))
            .ToListAsync(cancellationToken);

        return results;
    }
}
