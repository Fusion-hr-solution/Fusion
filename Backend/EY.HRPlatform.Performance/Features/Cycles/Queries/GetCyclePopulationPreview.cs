using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

/// <summary>
/// Resolves a cycle's population rules against live Core data for preview while editing a draft.
/// </summary>
public sealed record GetCyclePopulationPreviewQuery(Guid CycleId) : IQuery<Result<CyclePopulationPreviewDto>>;

public sealed class GetCyclePopulationPreviewQueryHandler(
    PerformanceDbContext dbContext,
    IPerformancePopulationResolver populationResolver)
    : IQueryHandler<GetCyclePopulationPreviewQuery, Result<CyclePopulationPreviewDto>>
{
    public async Task<Result<CyclePopulationPreviewDto>> Handle(
        GetCyclePopulationPreviewQuery request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Include(c => c.PopulationRules)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<CyclePopulationPreviewDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var members = await populationResolver.ResolveAsync(cycle, cancellationToken);

        var memberDtos = members
            .Select(member => new CyclePopulationMemberDto(
                member.EmployeeId,
                string.IsNullOrWhiteSpace(member.DisplayName) ? member.FullName : member.DisplayName,
                member.WorkEmail,
                member.JobTitle,
                member.OrgUnit?.OrgUnitId,
                member.OrgUnit?.Name,
                member.Manager?.DisplayName,
                member.IsActive))
            .ToList();

        return new CyclePopulationPreviewDto(memberDtos.Count, memberDtos);
    }
}
