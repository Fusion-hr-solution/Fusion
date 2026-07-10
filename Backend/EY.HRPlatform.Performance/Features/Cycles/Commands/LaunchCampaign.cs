using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record LaunchCampaignCommand(
    Guid CycleId,
    uint ExpectedVersion) : ICommand<Result<CampaignLaunchResultDto>>;

public sealed class LaunchCampaignCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    ICampaignReadinessResolver readinessResolver)
    : ICommandHandler<LaunchCampaignCommand, Result<CampaignLaunchResultDto>>
{
    public async Task<Result<CampaignLaunchResultDto>> Handle(
        LaunchCampaignCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.PopulationRules)
            .Include(c => c.ApproverOverrides)
            .Include(c => c.StrategicObjectives)
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<CampaignLaunchResultDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        if (cycle.Status != PerformanceCycleStatus.Draft)
        {
            return Result.Failure<CampaignLaunchResultDto>(
                Error.Conflict("Cycle.AlreadyLaunched", "Only a draft campaign can be launched."));
        }

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        // Recompute readiness server-side and fail closed on any blocking condition.
        var readiness = await readinessResolver.ResolveAsync(cycle, cancellationToken);
        if (!readiness.CanLaunch)
        {
            var reason = string.Join(" ", readiness.BlockingConditions.Select(condition => condition.Message));
            return Result.Failure<CampaignLaunchResultDto>(
                Error.Conflict("Cycle.NotReadyToLaunch", $"The campaign cannot be launched yet. {reason}".Trim()));
        }

        var baseline = readiness.Participants
            .Select(p => new ResolvedLaunchParticipant(
                p.EmployeeId,
                p.FullName,
                p.ApproverEmployeeId!.Value,
                p.ApproverName ?? "(unknown)",
                p.IsApproverOverridden,
                p.ApproverOverrideReason,
                p.EmployeeKey,
                p.Email,
                p.OrgUnitId,
                p.OrgUnitName,
                p.JobTitle,
                p.ManagerId,
                p.ManagerName))
            .ToList();

        try
        {
            cycle.Launch(baseline, DateTime.UtcNow);
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure<CampaignLaunchResultDto>(
                Error.Conflict("Cycle.LaunchRejected", exception.Message));
        }

        // Track the frozen participants explicitly so the child inserts order correctly against the
        // versioned parent update (avoids a false xmin concurrency conflict on the cycle row).
        dbContext.PerformanceCycleParticipants.AddRange(cycle.Participants);

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.CampaignLaunched,
            currentUser.UserId,
            currentUser.FullName,
            $"Launched with {baseline.Count} frozen participant(s)."));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(PerformanceCycle), cycle.Id);
        }

        return new CampaignLaunchResultDto(
            cycle.Id,
            cycle.Status.ToString(),
            cycle.LaunchedAt,
            cycle.Participants.Count,
            cycle.Version);
    }
}
