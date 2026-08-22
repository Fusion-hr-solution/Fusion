using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles;

/// <summary>
/// Builds the Draft-Overview launch-readiness view and the derived operational-milestone rail
/// from persisted state — no live Core call. Population readiness rides on the confirmed roster
/// (persisted at confirmation); live candidate resolution is the Population Lens surface's job.
/// </summary>
public static class CycleDetailComposer
{
    public static async Task<CycleDetailDto> ComposeAsync(PerformanceDbContext db, PerformanceCycle cycle, CancellationToken cancellationToken)
    {
        var publishedStrategyCount = await db.Objectives.AsNoTracking()
            .CountAsync(o => o.CycleId == cycle.Id && o.State == ObjectiveLifecycleState.Published, cancellationToken);
        var draftStrategyCount = await db.Objectives.AsNoTracking()
            .CountAsync(o => o.CycleId == cycle.Id && o.OwnershipScope == ObjectiveOwnershipScope.Company && o.State == ObjectiveLifecycleState.Draft, cancellationToken);

        var definition = await db.PopulationDefinitions.AsNoTracking().FirstOrDefaultAsync(d => d.CycleId == cycle.Id, cancellationToken);
        var participantCount = await db.Participants.AsNoTracking().CountAsync(p => p.CycleId == cycle.Id, cancellationToken);
        var populationConfirmed = definition is { IsConfirmed: true } && participantCount > 0;

        var otherActiveExists = await db.Cycles.AsNoTracking()
            .AnyAsync(c => c.Id != cycle.Id && c.State == CycleLifecycleState.Active, cancellationToken);

        var blockers = BuildBlockers(cycle, publishedStrategyCount, populationConfirmed, participantCount, otherActiveExists);

        var areas = new List<LaunchReadinessAreaDto>
        {
            new("details", "Cycle details", cycle.HasValidDates,
                cycle.HasValidDates ? null : "Set a valid date range and planning deadline."),
            new("direction", "Strategic direction", publishedStrategyCount > 0,
                publishedStrategyCount > 0 ? null : "Publish at least one strategic objective."),
            new("population", "Population", populationConfirmed,
                populationConfirmed ? null : "Resolve and confirm the participant population."),
        };

        var canActivate = cycle.IsDraft && blockers.Count == 0;

        var readiness = new LaunchReadinessDto(canActivate, areas, blockers);
        var milestones = BuildMilestones(cycle, publishedStrategyCount > 0, populationConfirmed);

        return new CycleDetailDto(
            PerformanceMappers.ToSummary(cycle),
            readiness,
            milestones,
            publishedStrategyCount,
            draftStrategyCount,
            populationConfirmed,
            participantCount);
    }

    public static async Task<IReadOnlyList<string>> ResolveBlockersAsync(PerformanceDbContext db, PerformanceCycle cycle, CancellationToken cancellationToken)
    {
        var publishedStrategyCount = await db.Objectives.AsNoTracking()
            .CountAsync(o => o.CycleId == cycle.Id && o.State == ObjectiveLifecycleState.Published, cancellationToken);
        var definition = await db.PopulationDefinitions.AsNoTracking().FirstOrDefaultAsync(d => d.CycleId == cycle.Id, cancellationToken);
        var participantCount = await db.Participants.AsNoTracking().CountAsync(p => p.CycleId == cycle.Id, cancellationToken);
        var populationConfirmed = definition is { IsConfirmed: true } && participantCount > 0;
        var otherActiveExists = await db.Cycles.AsNoTracking()
            .AnyAsync(c => c.Id != cycle.Id && c.State == CycleLifecycleState.Active, cancellationToken);

        return BuildBlockers(cycle, publishedStrategyCount, populationConfirmed, participantCount, otherActiveExists);
    }

    private static List<string> BuildBlockers(
        PerformanceCycle cycle,
        int publishedStrategyCount,
        bool populationConfirmed,
        int participantCount,
        bool otherActiveExists)
    {
        var blockers = new List<string>();
        if (otherActiveExists)
            blockers.Add("Another Cycle is already Active. Only one Cycle can be Active at a time.");
        if (!cycle.HasValidDates)
            blockers.Add("The Cycle dates are not valid.");
        if (publishedStrategyCount == 0)
            blockers.Add("No strategic objective has been published.");
        if (participantCount == 0)
            blockers.Add("The population is empty.");
        else if (!populationConfirmed)
            blockers.Add("The population has not been confirmed.");
        return blockers;
    }

    private static List<MilestoneStateDto> BuildMilestones(PerformanceCycle cycle, bool strategyPublished, bool populationConfirmed)
        =>
        [
            new(OperationalMilestone.StrategicDirectionPublished, strategyPublished),
            new(OperationalMilestone.PopulationConfirmed, populationConfirmed),
            new(OperationalMilestone.PlanningOpened, cycle.IsActive),
            new(OperationalMilestone.PlanningCompleted, false),
            new(OperationalMilestone.PerformanceEndReached, cycle.IsActive && DateOnly.FromDateTime(DateTime.UtcNow) > cycle.EndDate),
            new(OperationalMilestone.ClosureReady, false),
        ];
}
