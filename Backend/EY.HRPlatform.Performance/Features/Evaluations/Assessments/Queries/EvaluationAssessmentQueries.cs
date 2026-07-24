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

public sealed record GetMyEvaluationsQuery(ClaimsPrincipal Actor)
    : IQuery<Result<IReadOnlyList<MyEvaluationListItemDto>>>;
public sealed record GetMyAssessmentWorkspaceQuery(ClaimsPrincipal Actor, Guid RoundId)
    : IQuery<Result<AssessmentWorkspaceDto>>;
public sealed record GetTeamAssessmentQueueQuery(ClaimsPrincipal Actor, Guid RoundId)
    : IQuery<Result<TeamQueueDto>>;
public sealed record GetParticipantAssessmentWorkspaceQuery(ClaimsPrincipal Actor, Guid RoundId, Guid ParticipantEmployeeId)
    : IQuery<Result<ParticipantWorkspaceDto>>;
public sealed record GetRoundCompletionQuery(ClaimsPrincipal Actor, Guid RoundId)
    : IQuery<Result<RoundCompletionDto>>;

// ─── My evaluations list ─────────────────────────────────────────────────────

public sealed class GetMyEvaluationsQueryHandler(PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : IQueryHandler<GetMyEvaluationsQuery, Result<IReadOnlyList<MyEvaluationListItemDto>>>
{
    public async Task<Result<IReadOnlyList<MyEvaluationListItemDto>>> Handle(GetMyEvaluationsQuery q, CancellationToken ct)
    {
        if (!access.CanViewOwnEvaluations(q.Actor)) return EvaluationAssessmentErrors.Forbidden<IReadOnlyList<MyEvaluationListItemDto>>();
        var employeeId = q.Actor.GetEmployeeId();
        if (!employeeId.HasValue) return Result.Failure<IReadOnlyList<MyEvaluationListItemDto>>(
            Error.Forbidden("Evaluations.EmployeeMissing", "Your employee identity could not be resolved."));

        var mine = await db.EvaluationAssignments.AsNoTracking()
            .Where(a => a.ParticipantEmployeeId == employeeId.Value)
            .ToListAsync(ct);
        var roundIds = mine.Select(a => a.RoundId).Distinct().ToArray();
        var rounds = await db.EvaluationRounds.AsNoTracking()
            .Include(r => r.ScaleSnapshot).ThenInclude(s => s!.Levels)
            .Where(r => roundIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);

        var items = new List<MyEvaluationListItemDto>();
        foreach (var group in mine.GroupBy(a => a.RoundId))
        {
            if (!rounds.TryGetValue(group.Key, out var round)) continue;
            var self = group.FirstOrDefault(a => a.Kind == EvaluationAssignmentKind.SelfAssessment);
            var manager = group.FirstOrDefault(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment);
            var (status, nextAction, deadline) = ResolveEmployeeState(round, self, manager);

            items.Add(new MyEvaluationListItemDto(
                round.Id, round.Name, round.Type.ToString(), status, nextAction, deadline,
                manager?.FinalizedAt, manager?.AcknowledgedAt, manager?.FinalScore, manager?.FinalRatingOrdinal,
                manager?.FinalRatingOrdinal is int o ? round.ScaleSnapshot!.Levels.FirstOrDefault(l => l.Ordinal == o)?.Label : null));
        }

        return items
            .OrderByDescending(x => x.Deadline.HasValue)
            .ThenBy(x => x.Deadline)
            .ThenBy(x => x.RoundName)
            .ToArray();
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

        var managerAssignments = await EvaluationAssignmentLoader.WithResponses(db).AsNoTracking()
            .Where(a => a.RoundId == q.RoundId && a.AssigneeEmployeeId == employeeId.Value
                && a.Kind == EvaluationAssignmentKind.ManagerAssessment)
            .ToListAsync(ct);
        if (managerAssignments.Count == 0)
            return new TeamQueueDto(round.Id, round.Name, round.AssessmentModel.ToString(), Array.Empty<TeamQueueItemDto>());

        var participantIds = managerAssignments.Select(a => a.ParticipantEmployeeId).ToArray();
        var selfByParticipant = await db.EvaluationAssignments.AsNoTracking()
            .Where(a => a.RoundId == q.RoundId && participantIds.Contains(a.ParticipantEmployeeId)
                && a.Kind == EvaluationAssignmentKind.SelfAssessment)
            .Include(a => a.ObjectiveRatings).Include(a => a.SkillRatings)
            .ToDictionaryAsync(a => a.ParticipantEmployeeId, ct);
        var now = DateTime.UtcNow;

        var items = managerAssignments.Select(manager =>
        {
            selfByParticipant.TryGetValue(manager.ParticipantEmployeeId, out var self);
            var actionable = EvaluationActionability.IsManagerActionable(
                round.AssessmentModel, self?.Status, round.SelfAssessmentDeadline, now);
            var selfMissing = EvaluationActionability.SelfAssessmentMissing(self?.Status, round.SelfAssessmentDeadline, now);
            var selfSubmitted = self?.Status is EvaluationAssignmentStatus.Submitted or EvaluationAssignmentStatus.Finalized;
            var materialDiffs = actionable && selfSubmitted ? CountMaterialDifferences(round, manager, self) : 0;
            var nextAction = ResolveNextAction(manager, actionable, selfSubmitted);
            return new TeamQueueItemDto(
                manager.ParticipantEmployeeId, manager.ParticipantName, self?.Id, manager.Id, manager.Status.ToString(),
                actionable, selfSubmitted, selfMissing, materialDiffs,
                round.ManagerAssessmentDeadline, manager.FinalizedAt, manager.AcknowledgedAt, nextAction);
        }).ToList();

        // Attention-first: actionable-unfinalized, then material differences, then awaiting-ack, muted awaiting-self last.
        var ordered = items
            .OrderBy(i => AttentionRank(i))
            .ThenByDescending(i => i.MaterialDifferenceCount)
            .ThenBy(i => i.ParticipantName)
            .ToArray();
        return new TeamQueueDto(round.Id, round.Name, round.AssessmentModel.ToString(), ordered);
    }

    private static int AttentionRank(TeamQueueItemDto i)
    {
        if (i.Status == EvaluationAssignmentStatus.Finalized.ToString())
            return i.AcknowledgedAt.HasValue ? 5 : 3; // acknowledged last-ish, awaiting-ack mid
        if (!i.Actionable) return 4;                    // awaiting self — muted
        if (i.Status == EvaluationAssignmentStatus.Submitted.ToString()) return 1; // ready to finalize
        return 2;                                        // actionable, not yet submitted
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

    private static int CountMaterialDifferences(EvaluationRound round, EvaluationAssignment manager, EvaluationAssignment? self)
    {
        if (self is null) return 0;
        var selfObj = self.ObjectiveRatings.ToDictionary(r => r.ObjectiveSnapshotId, r => r.RatingOrdinal);
        var count = manager.ObjectiveRatings.Count(mr =>
            selfObj.TryGetValue(mr.ObjectiveSnapshotId, out var sr) &&
            EvaluationAssessmentRules.IsMaterialDifference(sr, mr.RatingOrdinal));
        var selfSkill = self.SkillRatings.ToDictionary(r => r.SkillSnapshotItemId, r => r.ProficiencyOrdinal);
        count += manager.SkillRatings.Count(mr =>
            selfSkill.TryGetValue(mr.SkillSnapshotItemId, out var sr) &&
            EvaluationAssessmentRules.IsMaterialDifference(sr, mr.ProficiencyOrdinal));
        return count;
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
