using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Milestones.Commands;

public sealed record CorrectObjectiveProgressCommand(Guid ObjectiveId, decimal Percent, string Reason) : ICommand<Result>;

public sealed class CorrectObjectiveProgressCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor) : ICommandHandler<CorrectObjectiveProgressCommand, Result>
{
    public async Task<Result> Handle(CorrectObjectiveProgressCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Progress.EmployeeContextRequired", "An employee context is required to correct progress."));

        var objective = await dbContext.PerformanceObjectives
            .SingleOrDefaultAsync(o => o.Id == request.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure(Error.NotFound("PerformanceObjective", request.ObjectiveId));

        // D-13: manager-only correction (with CanCorrectObjectiveProgress permission)
        var principal = httpContextAccessor.HttpContext?.User;
        if (principal is null || !accessPolicy.CanCorrectObjectiveProgress(principal))
            return Result.Failure(Error.Forbidden("Progress.NotManager", "Only managers can correct progress."));

        // Reason required
        if (string.IsNullOrWhiteSpace(request.Reason))
            return Result.Failure(Error.Validation("Progress.ReasonRequired", "A reason is required to correct progress."));

        // Progress-window check
        if (objective.Status != ObjectiveStatus.Approved)
            return Result.Failure(Error.Conflict("Progress.ObjectiveNotApproved", "Progress can only be corrected on approved objectives."));

        var cycle = await dbContext.PerformanceCycles
            .SingleOrDefaultAsync(c => c.Id == objective.CycleId, cancellationToken);
        if (cycle is null || cycle.Status != PerformanceCycleStatus.Active)
            return Result.Failure(Error.Conflict("Progress.CampaignNotActive", "Progress can only be corrected while the campaign is active."));

        // Accept both modes for correction
        var previousPercent = objective.ProgressMode == ObjectiveProgressMode.MilestoneRollup
            ? CalculateMilestoneRollupPercent(objective.Id)
            : objective.ManualProgressPercent;

        decimal newPercent = request.Percent;

        // Store old values for audit
        var oldMode = objective.ProgressMode;

        // Correction overrides mode to ManualPercent and sets percent (D-12)
        if (objective.ProgressMode == ObjectiveProgressMode.MilestoneRollup)
        {
            objective.SetProgressMode(ObjectiveProgressMode.ManualPercent);
        }

        try
        {
            objective.SetManualProgress(newPercent, DateTime.UtcNow);
        }
        catch (DomainRuleViolationException ex)
        {
            return Result.Failure(Error.Conflict("Progress.InvalidCorrection", ex.Message));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return Result.Failure(Error.Validation("Progress.InvalidPercent", ex.Message));
        }

        // Append-only progress history with correction metadata (D-14)
        var entry = ObjectiveProgressEntry.Create(
            objective.TenantId,
            objective.Id,
            currentUser.EmployeeId.Value,
            currentUser.FullName,
            oldMode,
            previousPercent,
            newPercent,
            "ManagerCorrection",
            request.Reason);
        dbContext.ObjectiveProgressEntries.Add(entry);

        // D-14: manager correction emits governance audit event
        var auditEvent = PerformanceCycleAuditEvent.Create(
            objective.TenantId,
            objective.CycleId,
            PerformanceCycleAuditAction.ObjectiveProgressCorrected,
            currentUser.EmployeeId.Value,
            currentUser.FullName,
            $"Corrected progress from {previousPercent:F1}% to {newPercent:F1}%. Reason: {request.Reason}");
        dbContext.PerformanceCycleAuditEvents.Add(auditEvent);

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    private decimal CalculateMilestoneRollupPercent(Guid objectiveId)
    {
        var milestones = dbContext.PerformanceObjectiveMilestones
            .Where(m => m.ObjectiveId == objectiveId)
            .ToList();
        if (milestones.Count == 0) return 0m;
        return (decimal)milestones.Count(m => m.IsCompleted) / milestones.Count * 100m;
    }
}
