using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

internal static class CampaignResponsibilityReadModel
{
    public static async Task<Result<CampaignResponsibilitiesDto>> LoadAsync(
        PerformanceDbContext dbContext,
        Guid cycleId,
        string state,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.PerformanceCycles.AsNoTracking().AnyAsync(x => x.Id == cycleId, cancellationToken))
            return Result.Failure<CampaignResponsibilitiesDto>(Error.NotFound("PerformanceCycle", cycleId));

        var normalizedState = string.IsNullOrWhiteSpace(state) ? "all" : state.Trim().ToLowerInvariant();
        if (normalizedState is not ("all" or "confirmed" or "needs-decision"))
            return Result.Failure<CampaignResponsibilitiesDto>(Error.Validation("Cycle.InvalidResponsibilityState", "State must be all, confirmed, or needs-decision."));

        var participants = await dbContext.PerformanceCycleParticipants.AsNoTracking()
            .Where(x => x.CycleId == cycleId).OrderBy(x => x.FullName).ToListAsync(cancellationToken);
        var latestBySubject = (await dbContext.CampaignAssignmentResponsibilities.AsNoTracking()
                .Where(x => x.CycleId == cycleId && x.Duty == CampaignResponsibilityDuty.ObjectiveApproval)
                .ToListAsync(cancellationToken))
            .GroupBy(x => x.SubjectEmployeeId)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(item => item.Revision).First());
        var allItems = participants.Select(participant =>
        {
            latestBySubject.TryGetValue(participant.EmployeeId, out var current);
            return new CampaignResponsibilityWorkItemDto(participant.Id, participant.EmployeeId, participant.FullName,
                participant.OrgUnitName, participant.JobTitle, participant.ManagerName,
                current is null ? null : new CampaignResponsibilitySummaryDto(current.Id, current.AssigneeEmployeeId,
                    current.AssigneeName, current.Duty.ToString(), current.Source.ToString(), current.RelationshipSource,
                    current.OverrideReason, current.Revision, current.RecordedAt),
                participant.OrgUnitId,
                participant.ManagerId);
        }).ToList();
        var items = normalizedState switch
        {
            "confirmed" => allItems.Where(x => x.CurrentResponsibility is not null).ToList(),
            "needs-decision" => allItems.Where(x => x.CurrentResponsibility is null).ToList(),
            _ => allItems
        };
        var confirmedCount = allItems.Count(x => x.CurrentResponsibility is not null);
        return new CampaignResponsibilitiesDto(allItems.Count, confirmedCount, allItems.Count - confirmedCount, items);
    }
}
