using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record ToggleCampaignStrategicObjectiveCommand(
    Guid CycleId,
    Guid ObjectiveId,
    uint ExpectedVersion,
    bool IsActive) : ICommand<Result<CampaignStrategicObjectiveDto>>;

public sealed class ToggleCampaignStrategicObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser) : ICommandHandler<ToggleCampaignStrategicObjectiveCommand, Result<CampaignStrategicObjectiveDto>>
{
    public async Task<Result<CampaignStrategicObjectiveDto>> Handle(
        ToggleCampaignStrategicObjectiveCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.StrategicObjectives)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
            return Result.Failure<CampaignStrategicObjectiveDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        var objective = cycle.StrategicObjectives.FirstOrDefault(item => item.Id == request.ObjectiveId);
        if (objective is null)
            return Result.Failure<CampaignStrategicObjectiveDto>(Error.NotFound("CampaignStrategicObjective", request.ObjectiveId));

        ConcurrencyGuard.Ensure(objective.Version, request.ExpectedVersion, nameof(CampaignStrategicObjective), objective.Id);

        cycle.SetStrategicObjectiveActive(request.ObjectiveId, request.IsActive);

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.StrategicObjectiveToggled,
            currentUser.UserId,
            currentUser.FullName,
            $"Marked strategic objective '{objective.Title}' as {(request.IsActive ? "active" : "inactive")}."));

        await dbContext.SaveChangesAsync(cancellationToken);

        return CycleMapper.ToStrategicObjectiveDto(objective);
    }
}
