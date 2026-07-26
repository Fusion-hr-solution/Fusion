using System.Security.Claims;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Dtos;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Services;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Rounds.Queries;

public sealed record ListEvaluationRoundsQuery(ClaimsPrincipal Actor, Guid? CampaignId = null)
    : IQuery<Result<IReadOnlyList<EvaluationRoundSummaryDto>>>;
public sealed record GetEvaluationRoundQuery(ClaimsPrincipal Actor, Guid RoundId)
    : IQuery<Result<EvaluationRoundDetailDto>>;
public sealed record GetEvaluationRoundReadinessQuery(ClaimsPrincipal Actor, Guid RoundId)
    : IQuery<Result<EvaluationRoundReadinessDto>>;
public sealed record GetEvaluationAssignmentRosterQuery(
    ClaimsPrincipal Actor, Guid RoundId, int Page = 1, int PageSize = 25)
    : IQuery<Result<EvaluationAssignmentRosterDto>>;
public sealed record GetMyEvaluationAssignmentsQuery(ClaimsPrincipal Actor)
    : IQuery<Result<IReadOnlyList<EvaluationWorkEntryDto>>>;
public sealed record GetTeamEvaluationAssignmentsQuery(ClaimsPrincipal Actor)
    : IQuery<Result<IReadOnlyList<EvaluationWorkEntryDto>>>;

public sealed class ListEvaluationRoundsQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<ListEvaluationRoundsQuery, Result<IReadOnlyList<EvaluationRoundSummaryDto>>>
{
    public async Task<Result<IReadOnlyList<EvaluationRoundSummaryDto>>> Handle(ListEvaluationRoundsQuery q, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(q.Actor) && !access.CanOperateEvaluations(q.Actor))
            return EvaluationRoundErrors.Forbidden<IReadOnlyList<EvaluationRoundSummaryDto>>();
        var source = db.EvaluationRounds.AsNoTracking().AsQueryable();
        if (q.CampaignId.HasValue) source = source.Where(x => x.PerformanceCycleId == q.CampaignId);
        var rounds = await source.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var ids = rounds.Select(x => x.Id).ToArray();
        var assignments = await db.EvaluationAssignments.AsNoTracking().Where(x => ids.Contains(x.RoundId)).ToListAsync(ct);
        return rounds.Select(x => EvaluationRoundMapper.ToSummary(x, assignments.Where(a => a.RoundId == x.Id).ToArray())).ToArray();
    }
}

public sealed class GetEvaluationRoundQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetEvaluationRoundQuery, Result<EvaluationRoundDetailDto>>
{
    public async Task<Result<EvaluationRoundDetailDto>> Handle(GetEvaluationRoundQuery q, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(q.Actor) && !access.CanOperateEvaluations(q.Actor))
            return EvaluationRoundErrors.Forbidden<EvaluationRoundDetailDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, q.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundDetailDto>(q.RoundId);
        var assignments = await db.EvaluationAssignments.AsNoTracking().Where(x => x.RoundId == round.Id).ToListAsync(ct);
        return EvaluationRoundMapper.ToDetail(round, assignments);
    }
}

public sealed class GetEvaluationRoundReadinessQueryHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access, IEvaluationRoundReadinessResolver readiness)
    : IQueryHandler<GetEvaluationRoundReadinessQuery, Result<EvaluationRoundReadinessDto>>
{
    public async Task<Result<EvaluationRoundReadinessDto>> Handle(GetEvaluationRoundReadinessQuery q, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(q.Actor) && !access.CanOperateEvaluations(q.Actor))
            return EvaluationRoundErrors.Forbidden<EvaluationRoundReadinessDto>();
        var round = await EvaluationRoundLoader.LoadAsync(db, q.RoundId, ct);
        if (round is null) return EvaluationRoundErrors.NotFound<EvaluationRoundReadinessDto>(q.RoundId);
        return (await readiness.ResolveAsync(round, ct)).Dto;
    }
}

public sealed class GetEvaluationAssignmentRosterQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetEvaluationAssignmentRosterQuery, Result<EvaluationAssignmentRosterDto>>
{
    public async Task<Result<EvaluationAssignmentRosterDto>> Handle(GetEvaluationAssignmentRosterQuery q, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(q.Actor) && !access.CanOperateEvaluations(q.Actor))
            return EvaluationRoundErrors.Forbidden<EvaluationAssignmentRosterDto>();
        var exists = await db.EvaluationRounds.AsNoTracking().AnyAsync(x => x.Id == q.RoundId, ct);
        if (!exists) return EvaluationRoundErrors.NotFound<EvaluationAssignmentRosterDto>(q.RoundId);
        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 100);
        var source = db.EvaluationAssignments.AsNoTracking().Where(x => x.RoundId == q.RoundId);
        var total = await source.CountAsync(ct);
        var items = await source.OrderBy(x => x.ParticipantName).ThenBy(x => x.Kind)
            .Skip((page - 1) * size).Take(size)
            .Select(x => new EvaluationAssignmentRosterItemDto(x.Id, x.ParticipantEmployeeId,
                x.ParticipantName, x.Kind.ToString(), x.AssigneeEmployeeId, x.AssigneeName, x.Status.ToString()))
            .ToListAsync(ct);
        return new EvaluationAssignmentRosterDto(q.RoundId, page, size, total, items);
    }
}

public sealed class GetMyEvaluationAssignmentsQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetMyEvaluationAssignmentsQuery, Result<IReadOnlyList<EvaluationWorkEntryDto>>>
{
    public async Task<Result<IReadOnlyList<EvaluationWorkEntryDto>>> Handle(GetMyEvaluationAssignmentsQuery q, CancellationToken ct)
    {
        if (!access.CanViewOwnEvaluations(q.Actor)) return EvaluationRoundErrors.Forbidden<IReadOnlyList<EvaluationWorkEntryDto>>();
        var employeeId = q.Actor.GetEmployeeId();
        if (!employeeId.HasValue) return Result.Failure<IReadOnlyList<EvaluationWorkEntryDto>>(Error.Forbidden("Evaluations.EmployeeMissing", "Your employee identity could not be resolved."));
        return Result.Success(await EvaluationWorkEntryLoader.LoadAsync(db, employeeId.Value, self: true, ct));
    }
}

public sealed class GetTeamEvaluationAssignmentsQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetTeamEvaluationAssignmentsQuery, Result<IReadOnlyList<EvaluationWorkEntryDto>>>
{
    public async Task<Result<IReadOnlyList<EvaluationWorkEntryDto>>> Handle(GetTeamEvaluationAssignmentsQuery q, CancellationToken ct)
    {
        if (!access.CanViewTeamEvaluations(q.Actor)) return EvaluationRoundErrors.Forbidden<IReadOnlyList<EvaluationWorkEntryDto>>();
        var employeeId = q.Actor.GetEmployeeId();
        if (!employeeId.HasValue) return Result.Failure<IReadOnlyList<EvaluationWorkEntryDto>>(Error.Forbidden("Evaluations.EmployeeMissing", "Your employee identity could not be resolved."));
        return Result.Success(await EvaluationWorkEntryLoader.LoadAsync(db, employeeId.Value, self: false, ct));
    }
}

internal static class EvaluationWorkEntryLoader
{
    public static async Task<IReadOnlyList<EvaluationWorkEntryDto>> LoadAsync(
        PerformanceDbContext db, Guid employeeId, bool self, CancellationToken ct)
    {
        var assignments = await db.EvaluationAssignments.AsNoTracking()
            .Where(x => self
                ? x.ParticipantEmployeeId == employeeId && x.AssigneeEmployeeId == employeeId && x.Kind == Domain.Enums.EvaluationAssignmentKind.SelfAssessment
                : x.AssigneeEmployeeId == employeeId && x.Kind == Domain.Enums.EvaluationAssignmentKind.ManagerAssessment)
            .OrderBy(x => x.Status).ThenBy(x => x.ParticipantName).ToListAsync(ct);
        var roundIds = assignments.Select(x => x.RoundId).Distinct().ToArray();
        var rounds = await EvaluationRoundLoader.Query(db)
            .AsNoTracking()
            .Where(x => roundIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, ct);
        var result = new List<EvaluationWorkEntryDto>();
        foreach (var assignment in assignments)
        {
            if (!rounds.TryGetValue(assignment.RoundId, out var round)) continue;
            var snapshot = assignment.ObjectivePlanSnapshotId.HasValue
                ? round.ObjectivePlanSnapshots.SingleOrDefault(x => x.Id == assignment.ObjectivePlanSnapshotId)
                : null;
            result.Add(new EvaluationWorkEntryDto(
                EvaluationRoundMapper.ToDetail(round, new[] { assignment }),
                new EvaluationAssignmentRosterItemDto(assignment.Id, assignment.ParticipantEmployeeId,
                    assignment.ParticipantName, assignment.Kind.ToString(), assignment.AssigneeEmployeeId,
                    assignment.AssigneeName, assignment.Status.ToString()),
                snapshot?.Objectives.Select(x => new EvaluationObjectiveSnapshotDto(x.Id, x.Title, x.Description,
                    x.Weight, x.Deadline, x.MeasurementIndicator, x.TargetValue, x.TargetUnit, x.SuccessCriteria)).ToArray()
                    ?? Array.Empty<EvaluationObjectiveSnapshotDto>()));
        }
        return result;
    }
}
