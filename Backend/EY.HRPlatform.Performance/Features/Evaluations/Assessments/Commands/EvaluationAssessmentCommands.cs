using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Services;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Assessments.Commands;

public sealed record SaveSelfDraftCommand(ClaimsPrincipal Actor, Guid AssignmentId, EvaluationAssessmentDraftInput Input, uint ExpectedVersion)
    : ICommand<Result<AssessmentWorkspaceDto>>;
public sealed record SubmitSelfCommand(ClaimsPrincipal Actor, Guid AssignmentId, uint ExpectedVersion)
    : ICommand<Result<AssessmentWorkspaceDto>>;
public sealed record SaveManagerDraftCommand(ClaimsPrincipal Actor, Guid AssignmentId, EvaluationAssessmentDraftInput Input, uint ExpectedVersion)
    : ICommand<Result<ParticipantWorkspaceDto>>;
public sealed record SubmitManagerCommand(ClaimsPrincipal Actor, Guid AssignmentId, uint ExpectedVersion)
    : ICommand<Result<ParticipantWorkspaceDto>>;
public sealed record ReopenSelfCommand(ClaimsPrincipal Actor, Guid SelfAssignmentId, string Reason, uint ExpectedVersion)
    : ICommand<Result<ParticipantWorkspaceDto>>;
public sealed record FinalizeEvaluationCommand(
    ClaimsPrincipal Actor, Guid ManagerAssignmentId, EvaluationFinalizationInput Input, uint ExpectedVersion)
    : ICommand<Result<ParticipantWorkspaceDto>>;
/// <remarks>
/// The single deliberate exception to read-only archive semantics (design D3). Acknowledgement is
/// employee-initiated and unbounded in time, so it cannot gate closure — which means it must remain
/// possible after closure, or an unresponsive employee would either hold the cycle open forever or
/// lose the ability to acknowledge their own evaluation.
/// </remarks>
[ClosedCampaignExempt(
    "Acknowledging a finalized evaluation stays permitted after closure: it does not gate auto-close, "
    + "so blocking it would strand the employee's own acknowledgement.")]
public sealed record AcknowledgeEvaluationCommand(
    ClaimsPrincipal Actor, Guid ManagerAssignmentId, string? Comment, uint ExpectedVersion)
    : ICommand<Result<AssessmentWorkspaceDto>>;

// ─── Self authoring ──────────────────────────────────────────────────────────

public sealed class SaveSelfDraftCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<SaveSelfDraftCommand, Result<AssessmentWorkspaceDto>>
{
    public async Task<Result<AssessmentWorkspaceDto>> Handle(SaveSelfDraftCommand c, CancellationToken ct)
    {
        var ctx = await EvaluationAssessmentAuth.LoadSelfAsync(db, access, c.Actor, c.AssignmentId, ct);
        if (ctx.Failure is { } f) return Result.Failure<AssessmentWorkspaceDto>(f);
        ConcurrencyGuard.Ensure(ctx.Assignment!.Version, c.ExpectedVersion, nameof(EvaluationAssignment), ctx.Assignment.Id);
        try
        {
            ctx.Assignment.SaveDraft(c.Input, ctx.Snapshot!, DateTime.UtcNow);
            await db.SaveChangesAsync(ct);
            return EvaluationAssessmentMapper.Workspace(ctx.Round!, ctx.Assignment, editable: true, result: null);
        }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException(nameof(EvaluationAssignment), ctx.Assignment.Id); }
        catch (Exception ex) when (EvaluationAssessmentErrors.IsCorrectable(ex))
        {
            return EvaluationAssessmentErrors.Invalid<AssessmentWorkspaceDto>(ex);
        }
    }
}

public sealed class SubmitSelfCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access, IActivityLog activity)
    : ICommandHandler<SubmitSelfCommand, Result<AssessmentWorkspaceDto>>
{
    public async Task<Result<AssessmentWorkspaceDto>> Handle(SubmitSelfCommand c, CancellationToken ct)
    {
        var ctx = await EvaluationAssessmentAuth.LoadSelfAsync(db, access, c.Actor, c.AssignmentId, ct);
        if (ctx.Failure is { } f) return Result.Failure<AssessmentWorkspaceDto>(f);
        ConcurrencyGuard.Ensure(ctx.Assignment!.Version, c.ExpectedVersion, nameof(EvaluationAssignment), ctx.Assignment.Id);
        try
        {
            ctx.Assignment.Submit(ctx.Snapshot!, DateTime.UtcNow);
            activity.Record("EvaluationSelfAssessmentSubmitted", nameof(EvaluationAssignment), ctx.Assignment.Id,
                new { ctx.Assignment.RoundId, ctx.Assignment.ParticipantEmployeeId });
            await db.SaveChangesAsync(ct);
            return EvaluationAssessmentMapper.Workspace(ctx.Round!, ctx.Assignment, editable: false, result: null);
        }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException(nameof(EvaluationAssignment), ctx.Assignment.Id); }
        catch (Exception ex) when (EvaluationAssessmentErrors.IsCorrectable(ex))
        {
            return EvaluationAssessmentErrors.Invalid<AssessmentWorkspaceDto>(ex, ctx.Round!, ctx.Assignment);
        }
    }
}

// ─── Manager authoring ───────────────────────────────────────────────────────

public sealed class SaveManagerDraftCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access)
    : ICommandHandler<SaveManagerDraftCommand, Result<ParticipantWorkspaceDto>>
{
    public async Task<Result<ParticipantWorkspaceDto>> Handle(SaveManagerDraftCommand c, CancellationToken ct)
    {
        var ctx = await EvaluationAssessmentAuth.LoadManagerAsync(db, access, c.Actor, c.AssignmentId, requireActionable: true, ct);
        if (ctx.Failure is { } f) return Result.Failure<ParticipantWorkspaceDto>(f);
        ConcurrencyGuard.Ensure(ctx.Assignment!.Version, c.ExpectedVersion, nameof(EvaluationAssignment), ctx.Assignment.Id);
        try
        {
            ctx.Assignment.SaveDraft(c.Input, ctx.Snapshot!, DateTime.UtcNow);
            await db.SaveChangesAsync(ct);
            return await EvaluationAssessmentAuth.ManagerWorkspaceAsync(db, access, c.Actor, ctx.Round!, ctx.Assignment, ct);
        }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException(nameof(EvaluationAssignment), ctx.Assignment.Id); }
        catch (Exception ex) when (EvaluationAssessmentErrors.IsCorrectable(ex))
        {
            return EvaluationAssessmentErrors.Invalid<ParticipantWorkspaceDto>(ex);
        }
    }
}

public sealed class SubmitManagerCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access, IActivityLog activity)
    : ICommandHandler<SubmitManagerCommand, Result<ParticipantWorkspaceDto>>
{
    public async Task<Result<ParticipantWorkspaceDto>> Handle(SubmitManagerCommand c, CancellationToken ct)
    {
        var ctx = await EvaluationAssessmentAuth.LoadManagerAsync(db, access, c.Actor, c.AssignmentId, requireActionable: true, ct);
        if (ctx.Failure is { } f) return Result.Failure<ParticipantWorkspaceDto>(f);
        ConcurrencyGuard.Ensure(ctx.Assignment!.Version, c.ExpectedVersion, nameof(EvaluationAssignment), ctx.Assignment.Id);
        try
        {
            ctx.Assignment.Submit(ctx.Snapshot!, DateTime.UtcNow);
            activity.Record("EvaluationManagerAssessmentSubmitted", nameof(EvaluationAssignment), ctx.Assignment.Id,
                new { ctx.Assignment.RoundId, ctx.Assignment.ParticipantEmployeeId });
            await db.SaveChangesAsync(ct);
            return await EvaluationAssessmentAuth.ManagerWorkspaceAsync(db, access, c.Actor, ctx.Round!, ctx.Assignment, ct);
        }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException(nameof(EvaluationAssignment), ctx.Assignment.Id); }
        catch (Exception ex) when (EvaluationAssessmentErrors.IsCorrectable(ex))
        {
            return EvaluationAssessmentErrors.Invalid<ParticipantWorkspaceDto>(ex, ctx.Round!, ctx.Assignment);
        }
    }
}

// ─── Reopen self ─────────────────────────────────────────────────────────────

public sealed class ReopenSelfCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access, IActivityLog activity)
    : ICommandHandler<ReopenSelfCommand, Result<ParticipantWorkspaceDto>>
{
    public async Task<Result<ParticipantWorkspaceDto>> Handle(ReopenSelfCommand c, CancellationToken ct)
    {
        var self = await EvaluationAssignmentLoader.LoadAsync(db, c.SelfAssignmentId, ct);
        if (self is null || self.Kind != EvaluationAssignmentKind.SelfAssessment)
            return EvaluationAssessmentErrors.NotFound<ParticipantWorkspaceDto>(c.SelfAssignmentId);

        var manager = await db.EvaluationAssignments
            .SingleOrDefaultAsync(a => a.RoundId == self.RoundId
                && a.ParticipantEmployeeId == self.ParticipantEmployeeId
                && a.Kind == EvaluationAssignmentKind.ManagerAssessment, ct);
        var employeeId = c.Actor.GetEmployeeId();
        var isReviewer = employeeId.HasValue && manager is not null && manager.AssigneeEmployeeId == employeeId.Value
            && access.CanViewTeamEvaluations(c.Actor);
        if (!isReviewer && !access.CanOperateEvaluations(c.Actor))
            return EvaluationAssessmentErrors.Forbidden<ParticipantWorkspaceDto>();

        ConcurrencyGuard.Ensure(self.Version, c.ExpectedVersion, nameof(EvaluationAssignment), self.Id);
        try
        {
            self.ReopenSelf(c.Reason, DateTime.UtcNow);
            activity.Record("EvaluationSelfAssessmentReopened", nameof(EvaluationAssignment), self.Id,
                new { self.RoundId, self.ParticipantEmployeeId, c.Reason });
            await db.SaveChangesAsync(ct);
            var round = await EvaluationAssignmentLoader.LoadRoundAsync(db, self.RoundId, ct);
            return await EvaluationAssessmentAuth.ManagerWorkspaceAsync(db, access, c.Actor, round!, manager!, ct);
        }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException(nameof(EvaluationAssignment), self.Id); }
        catch (Exception ex) when (EvaluationAssessmentErrors.IsCorrectable(ex))
        {
            return EvaluationAssessmentErrors.Invalid<ParticipantWorkspaceDto>(ex);
        }
    }
}

// ─── Finalize ────────────────────────────────────────────────────────────────

public sealed class FinalizeEvaluationCommandHandler(
    PerformanceDbContext db,
    IPerformanceAccessPolicyService access,
    IActivityLog activity,
    Features.Cycles.Services.CampaignClosureEligibilityResolver closureEligibility,
    Features.Cycles.Services.CampaignCloser campaignCloser)
    : ICommandHandler<FinalizeEvaluationCommand, Result<ParticipantWorkspaceDto>>
{
    public async Task<Result<ParticipantWorkspaceDto>> Handle(FinalizeEvaluationCommand c, CancellationToken ct)
    {
        var ctx = await EvaluationAssessmentAuth.LoadManagerAsync(db, access, c.Actor, c.ManagerAssignmentId, requireActionable: false, ct);
        if (ctx.Failure is { } f) return Result.Failure<ParticipantWorkspaceDto>(f);
        var manager = ctx.Assignment!;
        var round = ctx.Round!;

        var self = await EvaluationAssignmentLoader.WithResponses(db).SingleOrDefaultAsync(
            a => a.RoundId == manager.RoundId && a.ParticipantEmployeeId == manager.ParticipantEmployeeId
                && a.Kind == EvaluationAssignmentKind.SelfAssessment, ct);

        ConcurrencyGuard.Ensure(manager.Version, c.ExpectedVersion, nameof(EvaluationAssignment), manager.Id);
        try
        {
            manager.Finalize(self, c.Input, round.ObjectivesWeightPercent, round.SkillsWeightPercent,
                round.ScaleSnapshot!.Levels.Count, DateTime.UtcNow);
            activity.Record("EvaluationFinalized", nameof(EvaluationAssignment), manager.Id,
                new { manager.RoundId, manager.ParticipantEmployeeId, manager.FinalScore, manager.FinalRatingOrdinal });

            // Auto-close runs inline, not on a domain event: event delivery here is at-most-once and
            // best-effort, and closing a campaign is a business-critical transition. Inline in the
            // finalize transaction means the campaign either finalizes-and-closes or neither (D3).
            await SaveWithAutomaticClosureAsync(round.PerformanceCycleId, c.Actor, ct);

            return await EvaluationAssessmentAuth.ManagerWorkspaceAsync(db, access, c.Actor, round, manager, ct);
        }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException(nameof(EvaluationAssignment), manager.Id); }
        catch (Exception ex) when (EvaluationAssessmentErrors.IsCorrectable(ex))
        {
            return EvaluationAssessmentErrors.Invalid<ParticipantWorkspaceDto>(ex);
        }
    }

    /// <summary>
    /// Saves the finalization, then closes the campaign in the same transaction when this was the
    /// last outstanding manager assessment. Eligibility has to be evaluated after the finalization is
    /// visible to the query, so both writes are wrapped in one transaction rather than one save.
    /// </summary>
    private async Task SaveWithAutomaticClosureAsync(
        Guid campaignId,
        System.Security.Claims.ClaimsPrincipal actor,
        CancellationToken ct)
    {
        // The in-memory provider used by tests has no transaction support; there, the two saves are
        // sequential and the reconciliation sweep is the backstop.
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(ct)
            : null;

        await db.SaveChangesAsync(ct);

        if (await closureEligibility.IsEligibleForAutomaticClosureAsync(campaignId, ct))
        {
            await campaignCloser.StageCloseAsync(
                campaignId,
                CampaignClosureKind.Automatic,
                actor.GetUserId(),
                actor.GetFullName(),
                DateTime.UtcNow,
                ct);

            await db.SaveChangesAsync(ct);
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync(ct);
        }
    }
}

// ─── Acknowledge ─────────────────────────────────────────────────────────────

public sealed class AcknowledgeEvaluationCommandHandler(
    PerformanceDbContext db, IPerformanceAccessPolicyService access, IActivityLog activity)
    : ICommandHandler<AcknowledgeEvaluationCommand, Result<AssessmentWorkspaceDto>>
{
    public async Task<Result<AssessmentWorkspaceDto>> Handle(AcknowledgeEvaluationCommand c, CancellationToken ct)
    {
        if (!access.CanViewOwnEvaluations(c.Actor)) return EvaluationAssessmentErrors.Forbidden<AssessmentWorkspaceDto>();
        var employeeId = c.Actor.GetEmployeeId();
        var manager = await EvaluationAssignmentLoader.LoadAsync(db, c.ManagerAssignmentId, ct);
        if (manager is null || manager.Kind != EvaluationAssignmentKind.ManagerAssessment)
            return EvaluationAssessmentErrors.NotFound<AssessmentWorkspaceDto>(c.ManagerAssignmentId);
        if (!employeeId.HasValue || manager.ParticipantEmployeeId != employeeId.Value)
            return EvaluationAssessmentErrors.Forbidden<AssessmentWorkspaceDto>();

        ConcurrencyGuard.Ensure(manager.Version, c.ExpectedVersion, nameof(EvaluationAssignment), manager.Id);
        try
        {
            manager.Acknowledge(c.Comment, DateTime.UtcNow);
            activity.Record("EvaluationAcknowledged", nameof(EvaluationAssignment), manager.Id,
                new { manager.RoundId, manager.ParticipantEmployeeId });
            await db.SaveChangesAsync(ct);
            var round = await EvaluationAssignmentLoader.LoadRoundAsync(db, manager.RoundId, ct);
            var result = EvaluationAssessmentMapper.Result(round!, manager);
            return EvaluationAssessmentMapper.Workspace(round!, manager, editable: false, result);
        }
        catch (DbUpdateConcurrencyException) { throw new ConcurrencyException(nameof(EvaluationAssignment), manager.Id); }
        catch (Exception ex) when (EvaluationAssessmentErrors.IsCorrectable(ex))
        {
            return EvaluationAssessmentErrors.Invalid<AssessmentWorkspaceDto>(ex);
        }
    }
}
