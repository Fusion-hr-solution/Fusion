using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Progress;

public sealed record GetContributionOverviewQuery(Guid CycleId) : IQuery<Result<ContributionOverviewDto>>;
public sealed record GetContributionDetailQuery(Guid CycleId, Guid ObjectiveId) : IQuery<Result<ContributionDetailDto>>;

public sealed class GetContributionOverviewHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetContributionOverviewQuery, Result<ContributionOverviewDto>>
{
    public async Task<Result<ContributionOverviewDto>> Handle(GetContributionOverviewQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<ContributionOverviewDto>(Error.NotFound("Cycle", request.CycleId));

        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken);
        var roots = graph.All
            .Where(o => o.OwnershipScope == ObjectiveOwnershipScope.Company && o.State == ObjectiveLifecycleState.Published)
            .OrderBy(o => o.Title)
            .Select(o => ContributionComposer.ToNode(o, graph))
            .ToList();

        return Result.Success(new ContributionOverviewDto(cycle.Id, cycle.Name, roots));
    }
}

public sealed class GetContributionDetailHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetContributionDetailQuery, Result<ContributionDetailDto>>
{
    public async Task<Result<ContributionDetailDto>> Handle(GetContributionDetailQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<ContributionDetailDto>(Error.NotFound("Cycle", request.CycleId));

        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken);
        var node = graph.ById.GetValueOrDefault(request.ObjectiveId);
        if (node is null || node.OwnershipScope == ObjectiveOwnershipScope.Employee)
            return Result.Failure<ContributionDetailDto>(Error.NotFound("Objective", request.ObjectiveId));

        return Result.Success(ContributionComposer.BuildDetail(node, graph));
    }
}

/// <summary>
/// Builds the Contribution Explorer read models from the objective graph — company strategic roots
/// drilling into organizational scope, reported progress as the primary figure with coverage as
/// quieter context, and configured contributors distinct from mere alignment. Employee-scope
/// objectives are never surfaced here; the explorer is an organizational aggregate, permission-safe
/// by construction.
/// </summary>
public static class ContributionComposer
{
    public static ContributionNodeDto ToNode(Objective objective, GoalsComposer.Graph graph)
    {
        var reported = ProgressCalc.For(objective, graph);
        var childCount = graph.ChildrenByParent[objective.Id].Count();

        decimal? contributionToParent = null;
        if (objective.ParentObjectiveId is not null && graph.ById.TryGetValue(objective.ParentObjectiveId.Value, out var parent))
        {
            var link = parent.ContributionLinks.FirstOrDefault(l => l.ChildObjectiveId == objective.Id);
            if (link is not null) contributionToParent = link.Weight;
        }

        return new ContributionNodeDto(
            objective.Id,
            objective.OwnershipScope,
            objective.Title,
            objective.OrgUnitName,
            objective.AccountablePersonId,
            graph.Names.GetValueOrDefault(objective.AccountablePersonId),
            objective.ProgressSource,
            reported.HasProgress,
            reported.Progress,
            reported.Coverage,
            childCount,
            objective.ContributionLinks.Count,
            contributionToParent);
    }

    public static ContributionDetailDto BuildDetail(Objective objective, GoalsComposer.Graph graph)
    {
        var trail = new List<ContributionNodeDto>();
        var current = objective.ParentObjectiveId;
        var guard = 0;
        while (current is not null && guard++ < 100)
        {
            if (!graph.ById.TryGetValue(current.Value, out var ancestor)) break;
            trail.Insert(0, ToNode(ancestor, graph));
            current = ancestor.ParentObjectiveId;
        }

        var children = graph.ChildrenByParent[objective.Id]
            .OrderBy(o => o.Title)
            .Select(o => ToNode(o, graph))
            .ToList();

        // Contributors are the configured contribution links (distinct from aligned children).
        var contributors = objective.ContributionLinks
            .Select(link =>
            {
                var child = graph.ById.GetValueOrDefault(link.ChildObjectiveId);
                var reported = child is null ? new ProgressCalc.Reported(false, 0m, null) : ProgressCalc.For(child, graph);
                return new ContributionContributorDto(
                    link.ChildObjectiveId,
                    child?.Title ?? "Removed objective",
                    link.Weight,
                    reported.HasProgress,
                    reported.Progress);
            })
            .OrderByDescending(c => c.Weight)
            .ToList();

        return new ContributionDetailDto(ToNode(objective, graph), objective.Description, trail, children, contributors);
    }
}
