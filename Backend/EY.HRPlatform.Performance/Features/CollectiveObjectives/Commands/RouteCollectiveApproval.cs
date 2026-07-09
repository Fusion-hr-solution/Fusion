using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Exceptions.Services;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CollectiveObjectives.Commands;

/// <summary>
/// Routes superior-approval for a collective objective via the primary management chain.
/// D-09: fallback order delegate → next primary superior → exception owner.
/// D-10: honors the frozen superior-approval rule (never the live editable one).
/// Every route attempt emits an audit event (D-09, D-14).
/// </summary>
public sealed record RouteCollectiveApprovalCommand(Guid ObjectiveId) : ICommand<Result>;

public sealed class RouteCollectiveApprovalCommandHandler(
    PerformanceDbContext dbContext,
    ICoreWorkforceClient workforceClient,
    IExceptionCaseWorkflowService exceptionCaseWorkflowService,
    ICurrentUserContext currentUser) : ICommandHandler<RouteCollectiveApprovalCommand, Result>
{
    public async Task<Result> Handle(RouteCollectiveApprovalCommand request, CancellationToken cancellationToken)
    {
        // 1. Load the collective objective (tenant-filtered) and its campaign cycle
        var objective = await dbContext.PerformanceObjectives
            .FirstOrDefaultAsync(o => o.Id == request.ObjectiveId, cancellationToken);

        if (objective is null)
            return Result.Failure(Error.NotFound("PerformanceObjective", request.ObjectiveId));

        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(c => c.Id == objective.CycleId, cancellationToken);

        if (cycle is null)
            return Result.Failure(Error.NotFound("PerformanceCycle", objective.CycleId));

        var tenantId = cycle.TenantId;

        // 2. Governance freeze was part of the removed governed launch path; team-objective
        // superior approval is no longer configured, so it defaults to required (route to superior).
        const bool requireApproval = true;

        if (!requireApproval)
        {
            // Frozen rule says "not required" → auto-approve (D-10)
            try
            {
                // Submit first (Draft → PendingApproval), then approve (PendingApproval → Approved)
                objective.Submit(DateTime.UtcNow);
                objective.Approve(DateTime.UtcNow);
            }
            catch (DomainRuleViolationException ex)
            {
                return Result.Failure(Error.Conflict("CollectiveObjective.InvalidTransition", ex.Message));
            }

            // Emit auto-approved audit event (D-09, D-14)
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                tenantId,
                cycle.Id,
                PerformanceCycleAuditAction.CollectiveObjectiveAutoApproved,
                currentUser.UserId,
                currentUser.FullName,
                $"Auto-approved collective objective {objective.Id} per frozen rule (approval not required).",
                outcome: "Success",
                correlationId: currentUser.CorrelationId));

            await dbContext.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }

        // 3. Approval required — resolve the primary-chain approver
        var chain = await workforceClient.GetManagerChainAsync(objective.OwnerEmployeeId, cancellationToken);

        // Walk chain for the first element whose EmployeeId != owner → candidate primary superior
        // Chain ordering: root-first, chain[^1] is the direct manager (confirmed by Plan 01 test)
        Guid? approverId = null;
        string resolutionPath = "primary";

        foreach (var manager in chain)
        {
            if (manager.EmployeeId == objective.OwnerEmployeeId)
                continue;

            approverId = manager.EmployeeId;
            break;
        }

        // 4. Fallback order (D-09): delegate → next primary superior → exception owner
        if (approverId.HasValue)
        {
            // Check for an active ApprovalDelegate for this superior in this cycle
            var now = DateTime.UtcNow;
            var activeDelegate = await dbContext.ApprovalDelegates
                .FirstOrDefaultAsync(d =>
                    d.TenantId == tenantId &&
                    d.CycleId == cycle.Id &&
                    d.DelegatorEmployeeId == approverId.Value &&
                    d.IsActive &&
                    d.ValidFrom <= now &&
                    (d.ValidUntil == null || d.ValidUntil > now),
                    cancellationToken);

            if (activeDelegate is not null)
            {
                approverId = activeDelegate.DelegateEmployeeId;
                resolutionPath = "delegate";
            }
        }

        if (!approverId.HasValue)
        {
            // Exception-owner escalation was part of the removed governed launch path; with no
            // eligible superior or active delegate, approval routing simply fails.
            return Result.Failure(Error.Conflict("CollectiveObjective.NoApprover",
                "No eligible superior was available for collective objective approval routing."));
        }

        // 5. Materialize CampaignWorkItem (reuse existing pattern)
        var dueAt = cycle.ObjectiveSettingDeadline ?? cycle.PeriodEnd;
        var workItem = CampaignWorkItem.Create(
            tenantId,
            cycle.Id,
            objective.OwnerEmployeeId,
            approverId.Value,
            CampaignWorkItemType.TeamObjectiveApproval,
            dueAt);

        dbContext.CampaignWorkItems.Add(workItem);

        // 6. Emit approval-routed audit event (D-09, D-14)
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantId,
            cycle.Id,
            PerformanceCycleAuditAction.CollectiveObjectiveApprovalRouted,
            currentUser.UserId,
            currentUser.FullName,
            $"Routed collective objective {objective.Id} approval to {approverId.Value} via {resolutionPath} path.",
            outcome: "Success",
            correlationId: currentUser.CorrelationId));

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
