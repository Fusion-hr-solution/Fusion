using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlanningCompletion.Commands;

public sealed record ExcludePlanningParticipantCommand(
    Guid CycleId,
    Guid ParticipantEmployeeId,
    ExcludePlanningParticipantRequest Request) : ICommand<Result<PlanningCompletionParticipantDetailDto>>;

public sealed class ExcludePlanningParticipantCommandHandler(
    PerformanceDbContext dbContext,
    PlanningCompletionReadService readService,
    ICurrentUserContext currentUser)
    : ICommandHandler<ExcludePlanningParticipantCommand, Result<PlanningCompletionParticipantDetailDto>>
{
    public async Task<Result<PlanningCompletionParticipantDetailDto>> Handle(
        ExcludePlanningParticipantCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Request.Reason))
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Validation("PlanningCompletion.ExclusionReasonRequired", "An exclusion reason is required."));

        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        if (cycle.Status != PerformanceCycleStatus.Launched)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Validation("PlanningCompletion.NotLaunchedInvalid", "Planning completion starts after campaign launch."));
        if (cycle.IsPlanningLocked)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Conflict("PlanningCompletion.Locked", "Planning is locked for this campaign."));

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == request.CycleId && item.EmployeeId == request.ParticipantEmployeeId,
                cancellationToken);
        if (participant is null)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.NotFound("PerformanceCycleParticipant", request.ParticipantEmployeeId));

        var exists = await dbContext.PerformanceCycleParticipantExclusions
            .AnyAsync(
                item => item.CycleId == request.CycleId && item.ParticipantEmployeeId == request.ParticipantEmployeeId,
                cancellationToken);
        if (exists)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Conflict("PlanningCompletion.AlreadyExcluded", "This participant is already excluded from lock readiness."));

        var exclusion = PerformanceCycleParticipantExclusion.Create(
            cycle.TenantId,
            cycle.Id,
            participant.EmployeeId,
            request.Request.Reason,
            currentUser.UserId,
            currentUser.FullName,
            DateTime.UtcNow);

        dbContext.PerformanceCycleParticipantExclusions.Add(exclusion);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.PlanningParticipantExcluded,
            currentUser.UserId,
            currentUser.FullName,
            $"Excluded '{participant.FullName}' from planning lock readiness.",
            correlationId: currentUser.CorrelationId));

        await dbContext.SaveChangesAsync(cancellationToken);
        return await readService.GetParticipantDetailAsync(cycle.Id, participant.EmployeeId, cancellationToken);
    }
}
