using EY.HRPlatform.Performance.Features.Objectives.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Objectives.Queries;

public sealed record GetMyObjectivesQuery() : IQuery<IReadOnlyList<PerformanceObjectiveDto>>;

public sealed class GetMyObjectivesQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetMyObjectivesQuery, IReadOnlyList<PerformanceObjectiveDto>>
{
    public async Task<IReadOnlyList<PerformanceObjectiveDto>> Handle(
        GetMyObjectivesQuery request,
        CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return [];

        return await dbContext.PerformanceObjectives
            .AsNoTracking()
            .Where(objective => objective.OwnerEmployeeId == currentUser.EmployeeId.Value)
            .OrderBy(objective => objective.DueDate)
            .Select(objective => new PerformanceObjectiveDto(
                objective.Id,
                objective.CycleId,
                objective.Level.ToString(),
                objective.OwnerEmployeeId,
                objective.ParentObjectiveId,
                objective.Title,
                objective.Description,
                objective.SuccessMeasure,
                objective.Target,
                objective.DueDate,
                objective.Weight,
                objective.Status.ToString(),
                objective.SubmittedAt,
                objective.ApprovedAt,
                objective.Version))
            .ToListAsync(cancellationToken);
    }
}
