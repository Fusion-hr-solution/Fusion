using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Services;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Assessments.Queries;

public sealed record GetMyEvaluationsQuery(ClaimsPrincipal Actor, int Page = 1, int PageSize = 20)
    : IQuery<Result<MyEvaluationsPageDto>>;
public sealed record GetMyAssessmentWorkspaceQuery(ClaimsPrincipal Actor, Guid RoundId)
    : IQuery<Result<AssessmentWorkspaceDto>>;
public sealed record GetTeamAssessmentQueueQuery(ClaimsPrincipal Actor, Guid RoundId, int Page = 1, int PageSize = 20)
    : IQuery<Result<TeamQueueDto>>;
public sealed record GetParticipantAssessmentWorkspaceQuery(ClaimsPrincipal Actor, Guid RoundId, Guid ParticipantEmployeeId)
    : IQuery<Result<ParticipantWorkspaceDto>>;
public sealed record GetRoundCompletionQuery(ClaimsPrincipal Actor, Guid RoundId)
    : IQuery<Result<RoundCompletionDto>>;

// ─── My evaluations list ─────────────────────────────────────────────────────

public sealed class GetMyEvaluationsQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetMyEvaluationsQuery, Result<MyEvaluationsPageDto>>
{
    public async Task<Result<MyEvaluationsPageDto>> Handle(GetMyEvaluationsQuery q, CancellationToken ct)
    {
        if (!access.CanViewOwnEvaluations(q.Actor)) return EvaluationAssessmentErrors.Forbidden<MyEvaluationsPageDto>();
        var employeeId = q.Actor.GetEmployeeId();
        if (!employeeId.HasValue) return Result.Failure<MyEvaluationsPageDto>(
            Error.Forbidden("Evaluations.EmployeeMissing", "Your employee identity could not be resolved."));

        var page = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 1, 100);

        // Page over rounds (the list unit), ordered in SQL: dated work first, then by name.
        var roundsQuery = db.EvaluationRounds.AsNoTracking()
            .Where(r => db.EvaluationAssignments.Any(
                a => a.RoundId == r.Id && a.ParticipantEmployeeId == employeeId.Value));
        var total = await roundsQuery.CountAsync(ct);
        var pageRoundIds = await roundsQuery
            .OrderBy(r => r.SelfAssessmentDeadline == null && r.ManagerAssessmentDeadline == null)
            .ThenBy(r => r.SelfAssessmentDeadline ?? r.ManagerAssessmentDeadline)
            .ThenBy(r => r.Name).ThenBy(r => r.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(r => r.Id)
            .ToListAsync(ct);

        var rounds = await db.EvaluationRounds.AsNoTracking()
            .Include(r => r.ScaleSnapshot).ThenInclude(s => s!.Levels)
            .Where(r => pageRoundIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);
        var mine = await db.EvaluationAssignments.AsNoTracking()
            .Where(a => a.ParticipantEmployeeId == employeeId.Value && pageRoundIds.Contains(a.RoundId))
            .ToListAsync(ct);
        var byRound = mine.ToLookup(a => a.RoundId);

        var items = new List<MyEvaluationListItemDto>(pageRoundIds.Count);
        foreach (var roundId in pageRoundIds)
        {
            if (!rounds.TryGetValue(roundId, out var round)) continue;
            var self = byRound[roundId].FirstOrDefault(a => a.Kind == EvaluationAssignmentKind.SelfAssessment);
            var manager = byRound[roundId].FirstOrDefault(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment);
            var (status, nextAction, deadline) = ResolveEmployeeState(round, self, manager);

            items.Add(new MyEvaluationListItemDto(
                round.Id, round.Name, round.Type.ToString(), status, nextAction, deadline,
                manager?.FinalizedAt, manager?.AcknowledgedAt, manager?.FinalScore, manager?.FinalRatingOrdinal,
                manager?.FinalRatingOrdinal is int o ? round.ScaleSnapshot!.Levels.FirstOrDefault(l => l.Ordinal == o)?.Label : null));
        }

        return new MyEvaluationsPageDto(page, pageSize, total, items);
    }

    private static (string Status, string NextAction, DateTime? Deadline) ResolveEmployeeState(
        EvaluationRound round, EvaluationAssignment? self, EvaluationAssignment? manager)
    {
        if (manager?.Status == EvaluationAssignmentStatus.Finalized)
            return manager.AcknowledgedAt.HasValue
                ? ("Acknowledged", "View result", null)
                : ("Finalized", "Acknowledge", null);
        if (self is not null)
            return self.Status switch
            {
                EvaluationAssignmentStatus.NotStarted => ("Not started", "Start self-assessment", round.SelfAssessmentDeadline),
                EvaluationAssignmentStatus.InProgress => ("In progress", "Continue self-assessment", round.SelfAssessmentDeadline),
                _ => ("Submitted", "Awaiting manager", null)
            };
        return ("In progress", "Awaiting manager", null);
    }
}

// ─── My assessment workspace (self authoring / result) ───────────────────────

public sealed class GetMyAssessmentWorkspaceQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetMyAssessmentWorkspaceQuery, Result<AssessmentWorkspaceDto>>
{
    public async Task<Result<AssessmentWorkspaceDto>> Handle(GetMyAssessmentWorkspaceQuery q, CancellationToken ct)
    {
        if (!access.CanViewOwnEvaluations(q.Actor)) return EvaluationAssessmentErrors.Forbidden<AssessmentWorkspaceDto>();
        var employeeId = q.Actor.GetEmployeeId();
        if (!employeeId.HasValue) return EvaluationAssessmentErrors.Forbidden<AssessmentWorkspaceDto>();

        var round = await EvaluationAssignmentLoader.LoadRoundAsync(db, q.RoundId, ct);
        if (round is null) return EvaluationAssessmentErrors.NotFound<AssessmentWorkspaceDto>(q.RoundId);

        var assignments = await EvaluationAssignmentLoader.WithResponses(db).AsNoTracking()
            .Where(a => a.RoundId == q.RoundId && a.ParticipantEmployeeId == employeeId.Value)
            .ToListAsync(ct);
        var self = assignments.FirstOrDefault(a => a.Kind == EvaluationAssignmentKind.SelfAssessment);
        var manager = assignments.FirstOrDefault(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment);
        if (self is null && manager is null) return EvaluationAssessmentErrors.NotFound<AssessmentWorkspaceDto>(q.RoundId);

        // Manager-only round before finalization: the employee gets round identity only — never the
        // manager's draft or submitted-but-unfinalized content. Finalization is the visibility boundary.
        if (self is null && manager!.Status != EvaluationAssignmentStatus.Finalized)
            return EvaluationAssessmentMapper.AwaitingWorkspace(round, manager);

        var result = manager?.Status == EvaluationAssignmentStatus.Finalized
            ? EvaluationAssessmentMapper.Result(round, manager)
            : null;

        // Self+manager rounds author against the self assignment; a manager-only round exposes the
        // participant a read-only result surface (built on the manager assignment) once finalized.
        var authoringAssignment = self ?? manager!;
        var editable = self is not null &&
            self.Status is EvaluationAssignmentStatus.NotStarted or EvaluationAssignmentStatus.InProgress;

        return EvaluationAssessmentMapper.Workspace(round, authoringAssignment, editable, result, manager);
    }
}

// ─── Team assessment queue ───────────────────────────────────────────────────

public sealed class GetTeamAssessmentQueueQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetTeamAssessmentQueueQuery, Result<TeamQueueDto>>
{
    public async Task<Result<TeamQueueDto>> Handle(GetTeamAssessmentQueueQuery q, CancellationToken ct)
    {
        if (!access.CanViewTeamEvaluations(q.Actor)) return EvaluationAssessmentErrors.Forbidden<TeamQueueDto>();
        var employeeId = q.Actor.GetEmployeeId();
        if (!employeeId.HasValue) return EvaluationAssessmentErrors.Forbidden<TeamQueueDto>();

        var round = await EvaluationAssignmentLoader.LoadRoundAsync(db, q.RoundId, ct);
        if (round is null) return EvaluationAssessmentErrors.NotFound<TeamQueueDto>(q.RoundId);

        var page = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 1, 100);
        var now = DateTime.UtcNow;
        var managerOnly = round.AssessmentModel == EvaluationAssessmentModel.ManagerOnly;
        var selfDeadlinePassed = round.SelfAssessmentDeadline is { } sdl && now > sdl;

        // Attention-first ordering runs in SQL over the manager assignment + left-joined self status;
        // response projections are loaded only for the selected page.
        var baseQuery =
            from m in db.EvaluationAssignments.AsNoTracking()
            where m.RoundId == q.RoundId && m.AssigneeEmployeeId == employeeId.Value
                && m.Kind == EvaluationAssignmentKind.ManagerAssessment
                && !db.EvaluationRoundExclusions.Any(e => e.RoundId == m.RoundId
                    && e.ParticipantEmployeeId == m.ParticipantEmployeeId)
            join s0 in db.EvaluationAssignments.AsNoTracking().Where(a =>
                    a.RoundId == q.RoundId && a.Kind == EvaluationAssignmentKind.SelfAssessment)
                on m.ParticipantEmployeeId equals s0.ParticipantEmployeeId into selfJoin
            from s in selfJoin.DefaultIfEmpty()
            select new
            {
                Manager = m,
                SelfId = (Guid?)s!.Id,
                SelfStatus = (EvaluationAssignmentStatus?)s!.Status,
                Actionable = managerOnly || selfDeadlinePassed
                    || s!.Status == EvaluationAssignmentStatus.Submitted
                    || s!.Status == EvaluationAssignmentStatus.Finalized
            };

        var total = await baseQuery.CountAsync(ct);
        var pageRows = await baseQuery
            .OrderBy(x => x.Manager.Status == EvaluationAssignmentStatus.Finalized
                ? (x.Manager.AcknowledgedAt != null ? 5 : 3)
                : (!x.Actionable ? 4 : (x.Manager.Status == EvaluationAssignmentStatus.Submitted ? 1 : 2)))
            .ThenBy(x => x.Manager.ParticipantName).ThenBy(x => x.Manager.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        var assignmentIds = pageRows.Select(x => x.Manager.Id)
            .Concat(pageRows.Where(x => x.SelfId.HasValue).Select(x => x.SelfId!.Value))
            .ToArray();
        var objectiveRatings = (await db.Set<EvaluationObjectiveRating>().AsNoTracking()
                .Where(r => assignmentIds.Contains(r.AssignmentId))
                .Select(r => new { r.AssignmentId, ItemId = r.ObjectiveSnapshotId, Ordinal = r.RatingOrdinal })
                .ToListAsync(ct))
            .Concat(await db.Set<EvaluationSkillRating>().AsNoTracking()
                .Where(r => assignmentIds.Contains(r.AssignmentId))
                .Select(r => new { r.AssignmentId, ItemId = r.SkillSnapshotItemId, Ordinal = r.ProficiencyOrdinal })
                .ToListAsync(ct))
            .ToLookup(r => r.AssignmentId);

        var items = pageRows.Select(row =>
        {
            var manager = row.Manager;
            var actionable = EvaluationActionability.IsManagerActionable(
                round.AssessmentModel, row.SelfStatus, round.SelfAssessmentDeadline, now);
            var selfMissing = EvaluationActionability.SelfAssessmentMissing(row.SelfStatus, round.SelfAssessmentDeadline, now);
            var selfSubmitted = row.SelfStatus is EvaluationAssignmentStatus.Submitted or EvaluationAssignmentStatus.Finalized;
            var materialDiffs = 0;
            if (actionable && selfSubmitted && row.SelfId is { } selfId)
            {
                var selfRatings = objectiveRatings[selfId].ToDictionary(r => r.ItemId, r => r.Ordinal);
                materialDiffs = objectiveRatings[manager.Id].Count(mr =>
                    selfRatings.TryGetValue(mr.ItemId, out var sr) &&
                    EvaluationAssessmentRules.IsMaterialDifference(sr, mr.Ordinal));
            }
            var nextAction = ResolveNextAction(manager, actionable, selfSubmitted);
            return new TeamQueueItemDto(
                manager.ParticipantEmployeeId, manager.ParticipantName, row.SelfId, manager.Id, manager.Status.ToString(),
                actionable, selfSubmitted, selfMissing, materialDiffs,
                round.ManagerAssessmentDeadline, manager.FinalizedAt, manager.AcknowledgedAt, nextAction);
        }).ToArray();

        return new TeamQueueDto(round.Id, round.Name, round.AssessmentModel.ToString(), page, pageSize, total, items);
    }

    private static string ResolveNextAction(EvaluationAssignment manager, bool actionable, bool selfSubmitted)
    {
        if (manager.Status == EvaluationAssignmentStatus.Finalized)
            return manager.AcknowledgedAt.HasValue ? "Acknowledged" : "Awaiting acknowledgement";
        if (!actionable) return "Awaiting self-assessment";
        return manager.Status switch
        {
            EvaluationAssignmentStatus.Submitted => "Finalize",
            EvaluationAssignmentStatus.InProgress => "Continue assessment",
            _ => "Start assessment"
        };
    }

}

// ─── Participant (comparison / finalization) workspace ───────────────────────

public sealed class GetParticipantAssessmentWorkspaceQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetParticipantAssessmentWorkspaceQuery, Result<ParticipantWorkspaceDto>>
{
    public async Task<Result<ParticipantWorkspaceDto>> Handle(GetParticipantAssessmentWorkspaceQuery q, CancellationToken ct)
    {
        var employeeId = q.Actor.GetEmployeeId();
        var round = await EvaluationAssignmentLoader.LoadRoundAsync(db, q.RoundId, ct);
        if (round is null) return EvaluationAssessmentErrors.NotFound<ParticipantWorkspaceDto>(q.RoundId);

        var assignments = await EvaluationAssignmentLoader.WithResponses(db).AsNoTracking()
            .Where(a => a.RoundId == q.RoundId && a.ParticipantEmployeeId == q.ParticipantEmployeeId)
            .ToListAsync(ct);
        var manager = assignments.FirstOrDefault(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment);
        var self = assignments.FirstOrDefault(a => a.Kind == EvaluationAssignmentKind.SelfAssessment);
        if (manager is null) return EvaluationAssessmentErrors.NotFound<ParticipantWorkspaceDto>(q.RoundId);

        var isFinalized = manager.Status == EvaluationAssignmentStatus.Finalized;
        var isFrozenReviewer = employeeId.HasValue && manager.AssigneeEmployeeId == employeeId.Value
            && access.CanViewTeamEvaluations(q.Actor);
        var isParticipant = employeeId.HasValue && q.ParticipantEmployeeId == employeeId.Value
            && access.CanViewOwnEvaluations(q.Actor);
        var isHr = access.CanManageEvaluations(q.Actor) || access.CanOperateEvaluations(q.Actor);

        // Frozen reviewer authors and always sees the manager side; participant/HR read only after finalization.
        bool canRead = isFrozenReviewer || (isFinalized && (isParticipant || isHr));
        if (!canRead) return EvaluationAssessmentErrors.Forbidden<ParticipantWorkspaceDto>();

        var now = DateTime.UtcNow;
        var actionable = EvaluationActionability.IsManagerActionable(
            round.AssessmentModel, self?.Status, round.SelfAssessmentDeadline, now);
        var selfMissing = EvaluationActionability.SelfAssessmentMissing(self?.Status, round.SelfAssessmentDeadline, now);
        var selfSubmitted = self?.Status is EvaluationAssignmentStatus.Submitted or EvaluationAssignmentStatus.Finalized;

        // Manager content is visible to the reviewer always; to the participant/HR only once finalized.
        var includeManagerContent = isFrozenReviewer || isFinalized;
        // Self content reaches the reviewer only when actionable; the participant always sees their own.
        var includeSelfContent = (isFrozenReviewer && actionable) || isParticipant || (isHr && isFinalized);

        var result = isFinalized ? EvaluationAssessmentMapper.Result(round, manager) : null;

        return EvaluationAssessmentMapper.ParticipantWorkspace(
            round, manager, self, actionable, selfSubmitted, selfMissing,
            includeManagerContent, includeSelfContent, result);
    }
}

// ─── HR round completion ─────────────────────────────────────────────────────

public sealed class GetRoundCompletionQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetRoundCompletionQuery, Result<RoundCompletionDto>>
{
    public async Task<Result<RoundCompletionDto>> Handle(GetRoundCompletionQuery q, CancellationToken ct)
    {
        if (!access.CanManageEvaluations(q.Actor) && !access.CanOperateEvaluations(q.Actor))
            return EvaluationAssessmentErrors.Forbidden<RoundCompletionDto>();
        var round = await db.EvaluationRounds.AsNoTracking().SingleOrDefaultAsync(r => r.Id == q.RoundId, ct);
        if (round is null) return EvaluationAssessmentErrors.NotFound<RoundCompletionDto>(q.RoundId);

        // Counts only — never unfinalized assessment content.
        var assignments = await db.EvaluationAssignments.AsNoTracking()
            .Where(a => a.RoundId == q.RoundId)
            .Where(a => !db.EvaluationRoundExclusions.Any(e => e.RoundId == a.RoundId
                && e.ParticipantEmployeeId == a.ParticipantEmployeeId))
            .Select(a => new { a.Kind, a.Status, a.ParticipantEmployeeId, a.AcknowledgedAt })
            .ToListAsync(ct);
        var now = DateTime.UtcNow;
        var self = assignments.Where(a => a.Kind == EvaluationAssignmentKind.SelfAssessment).ToArray();
        var manager = assignments.Where(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment).ToArray();

        int SelfCount(EvaluationAssignmentStatus s) => self.Count(a => a.Status == s);
        int ManagerCount(EvaluationAssignmentStatus s) => manager.Count(a => a.Status == s);

        var overdueSelf = round.SelfAssessmentDeadline is { } sd && now > sd
            ? self.Count(a => a.Status is EvaluationAssignmentStatus.NotStarted or EvaluationAssignmentStatus.InProgress) : 0;
        var overdueManager = now > round.ManagerAssessmentDeadline
            ? manager.Count(a => a.Status is EvaluationAssignmentStatus.NotStarted or EvaluationAssignmentStatus.InProgress) : 0;
        var overdueFinal = round.FinalizationDeadline is { } fd && now > fd
            ? manager.Count(a => a.Status != EvaluationAssignmentStatus.Finalized) : 0;

        return new RoundCompletionDto(
            round.Id, round.Name, round.AssessmentModel.ToString(),
            manager.Select(a => a.ParticipantEmployeeId).Distinct().Count(),
            SelfCount(EvaluationAssignmentStatus.NotStarted), SelfCount(EvaluationAssignmentStatus.InProgress), SelfCount(EvaluationAssignmentStatus.Submitted),
            ManagerCount(EvaluationAssignmentStatus.NotStarted), ManagerCount(EvaluationAssignmentStatus.InProgress), ManagerCount(EvaluationAssignmentStatus.Submitted),
            ManagerCount(EvaluationAssignmentStatus.Finalized),
            manager.Count(a => a.AcknowledgedAt.HasValue),
            overdueSelf, overdueManager, overdueFinal);
    }
}
