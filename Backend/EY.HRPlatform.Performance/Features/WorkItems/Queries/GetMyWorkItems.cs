using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.WorkItems.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.WorkItems.Queries;

public sealed record GetMyWorkItemsQuery() : IQuery<IReadOnlyList<CampaignWorkItemDto>>;

public sealed class GetMyWorkItemsQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetMyWorkItemsQuery, IReadOnlyList<CampaignWorkItemDto>>
{
    public async Task<IReadOnlyList<CampaignWorkItemDto>> Handle(
        GetMyWorkItemsQuery request,
        CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return [];

        return await dbContext.CampaignWorkItems
            .AsNoTracking()
            .Where(item => item.AssigneeEmployeeId == currentUser.EmployeeId.Value)
            .OrderBy(item => item.DueAt)
            .Select(item => new CampaignWorkItemDto(
                item.Id,
                item.CycleId,
                item.SubjectEmployeeId,
                item.AssigneeEmployeeId,
                item.Type.ToString(),
                item.Status.ToString(),
                item.DueAt,
                item.SubmittedAt,
                item.CompletedAt,
                item.Version))
            .ToListAsync(cancellationToken);
    }
}
