using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Services;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Assessments;

/// <summary>
/// Frozen-assignee resource checks and snapshot loading for assessment mutations. Access is decided
/// against the assignment's frozen assignee (never live org data); a cross-tenant id is not-found via
/// the ambient tenant query filter.
/// </summary>
internal sealed record AssessmentContext(
    EvaluationAssignment? Assignment,
    EvaluationRound? Round,
    EvaluationAssessmentSnapshot? Snapshot,
    Error? Failure);

internal static class EvaluationAssessmentAuth
{
    public static async Task<AssessmentContext> LoadSelfAsync(
        PerformanceDbContext db, IPerformanceAccessPolicyService access,
        ClaimsPrincipal actor, Guid assignmentId, CancellationToken ct)
    {
        if (!access.CanViewOwnEvaluations(actor))
            return Fail(Error.Forbidden("Evaluations.Forbidden", "You do not have access to this assignment."));
        var employeeId = actor.GetEmployeeId();
        var assignment = await EvaluationAssignmentLoader.LoadAsync(db, assignmentId, ct);
        if (assignment is null || assignment.Kind != EvaluationAssignmentKind.SelfAssessment)
            return Fail(Error.NotFound("EvaluationAssignment", assignmentId));
        if (!employeeId.HasValue || assignment.AssigneeEmployeeId != employeeId.Value)
            return Fail(Error.Forbidden("Evaluations.Forbidden", "You are not the assignee of this self-assessment."));

        var round = await EvaluationAssignmentLoader.LoadRoundAsync(db, assignment.RoundId, ct);
        if (round is null) return Fail(Error.NotFound("EvaluationRound", assignment.RoundId));
        return new AssessmentContext(assignment, round, EvaluationAssessmentSnapshotBuilder.Build(round, assignment), null);
    }

    public static async Task<AssessmentContext> LoadManagerAsync(
        PerformanceDbContext db, IPerformanceAccessPolicyService access,
        ClaimsPrincipal actor, Guid assignmentId, bool requireActionable, CancellationToken ct)
    {
        if (!access.CanViewTeamEvaluations(actor))
            return Fail(Error.Forbidden("Evaluations.Forbidden", "You do not have access to this assignment."));
        var employeeId = actor.GetEmployeeId();
        var assignment = await EvaluationAssignmentLoader.LoadAsync(db, assignmentId, ct);
        if (assignment is null || assignment.Kind != EvaluationAssignmentKind.ManagerAssessment)
            return Fail(Error.NotFound("EvaluationAssignment", assignmentId));
        if (!employeeId.HasValue || assignment.AssigneeEmployeeId != employeeId.Value)
            return Fail(Error.Forbidden("Evaluations.Forbidden", "You are not the frozen reviewer for this assignment."));

        var round = await EvaluationAssignmentLoader.LoadRoundAsync(db, assignment.RoundId, ct);
        if (round is null) return Fail(Error.NotFound("EvaluationRound", assignment.RoundId));

        if (requireActionable)
        {
            var selfStatus = await db.EvaluationAssignments.AsNoTracking()
                .Where(a => a.RoundId == assignment.RoundId && a.ParticipantEmployeeId == assignment.ParticipantEmployeeId
                    && a.Kind == EvaluationAssignmentKind.SelfAssessment)
                .Select(a => (EvaluationAssignmentStatus?)a.Status)
                .FirstOrDefaultAsync(ct);
            var actionable = EvaluationActionability.IsManagerActionable(
                round.AssessmentModel, selfStatus, round.SelfAssessmentDeadline, DateTime.UtcNow);
            if (!actionable)
                return Fail(Error.Conflict("Evaluations.NotActionable",
                    "The self-assessment is not yet submitted and its deadline has not passed."));
        }

        return new AssessmentContext(assignment, round, EvaluationAssessmentSnapshotBuilder.Build(round, assignment), null);
    }

    /// <summary>Rebuilds the reviewer's comparison workspace after a mutation.</summary>
    public static async Task<Result<ParticipantWorkspaceDto>> ManagerWorkspaceAsync(
        PerformanceDbContext db, IPerformanceAccessPolicyService access, ClaimsPrincipal actor,
        EvaluationRound round, EvaluationAssignment manager, CancellationToken ct)
    {
        var self = await EvaluationAssignmentLoader.WithResponses(db).AsNoTracking().SingleOrDefaultAsync(
            a => a.RoundId == manager.RoundId && a.ParticipantEmployeeId == manager.ParticipantEmployeeId
                && a.Kind == EvaluationAssignmentKind.SelfAssessment, ct);
        var now = DateTime.UtcNow;
        var actionable = EvaluationActionability.IsManagerActionable(
            round.AssessmentModel, self?.Status, round.SelfAssessmentDeadline, now);
        var selfMissing = EvaluationActionability.SelfAssessmentMissing(self?.Status, round.SelfAssessmentDeadline, now);
        var selfSubmitted = self?.Status is EvaluationAssignmentStatus.Submitted or EvaluationAssignmentStatus.Finalized;
        var isFinalized = manager.Status == EvaluationAssignmentStatus.Finalized;
        var result = isFinalized ? EvaluationAssessmentMapper.Result(round, manager) : null;

        return EvaluationAssessmentMapper.ParticipantWorkspace(
            round, manager, self, actionable, selfSubmitted, selfMissing,
            includeManagerContent: true, includeSelfContent: actionable, result);
    }

    private static AssessmentContext Fail(Error error) => new(null, null, null, error);
}
