using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCampaignResponsibilityHistoryQuery(Guid CycleId, Guid SubjectEmployeeId)
    : IQuery<Result<IReadOnlyList<CampaignResponsibilitySummaryDto>>>;

public sealed class GetCampaignResponsibilityHistoryQueryHandler(PerformanceDbContext dbContext)
    : IQueryHandler<GetCampaignResponsibilityHistoryQuery, Result<IReadOnlyList<CampaignResponsibilitySummaryDto>>>
{
    public async Task<Result<IReadOnlyList<CampaignResponsibilitySummaryDto>>> Handle(
        GetCampaignResponsibilityHistoryQuery request,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.PerformanceCycles.AsNoTracking().AnyAsync(cycle => cycle.Id == request.CycleId, cancellationToken))
            return Result.Failure<IReadOnlyList<CampaignResponsibilitySummaryDto>>(Error.NotFound("PerformanceCycle", request.CycleId));

        var revisions = await dbContext.CampaignAssignmentResponsibilities.AsNoTracking()
            .Where(item => item.CycleId == request.CycleId && item.SubjectEmployeeId == request.SubjectEmployeeId)
            .OrderByDescending(item => item.Revision)
            .Select(item => new CampaignResponsibilitySummaryDto(item.Id, item.AssigneeEmployeeId,
                item.AssigneeName, item.Duty.ToString(), item.Source.ToString(), item.RelationshipSource,
                item.OverrideReason, item.Revision, item.RecordedAt))
            .ToListAsync(cancellationToken);

        return revisions;
    }
}
