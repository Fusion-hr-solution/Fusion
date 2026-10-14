using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Reviews;

namespace EY.HRPlatform.Performance.Features.Security.Policies;

public sealed record CycleVisibilityActor(Guid EmployeeId, bool IsAdministrator, string? AggregateViewScope);

/// <summary>One tenant-scoped visibility rule for Cycle lists, details and workspace selection.</summary>
public static class CyclePolicy
{
    public static IQueryable<PerformanceCycle> Visible(
        IQueryable<PerformanceCycle> cycles,
        IQueryable<Participant> participants,
        IQueryable<PerformanceReview> reviews,
        CycleVisibilityActor actor)
    {
        if (actor.IsAdministrator) return cycles;

        var relatedParticipants = participants
            .Where(participant => actor.EmployeeId != Guid.Empty
                && (participant.EmployeeId == actor.EmployeeId || participant.ManagerEmployeeId == actor.EmployeeId))
            .Select(participant => participant.CycleId);
        var relatedReviews = reviews
            .Where(review => actor.EmployeeId != Guid.Empty
                && (review.SubjectEmployeeId == actor.EmployeeId || review.ReviewerEmployeeId == actor.EmployeeId))
            .Select(review => review.CycleId);
        var related = relatedParticipants.Union(relatedReviews);
        var tenantView = actor.AggregateViewScope == "Tenant";

        return cycles.Where(cycle => cycle.State == CycleLifecycleState.Active
            || (cycle.State == CycleLifecycleState.Closed && (tenantView || related.Contains(cycle.Id))));
    }
}
