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

public sealed record UpdateCampaignStrategicObjectiveCommand(
    Guid CycleId,
    Guid ObjectiveId,
    uint ExpectedVersion,
    string Title,
    string? Description,
    string? ResponsibleFunctionLabel) : ICommand<Result<CampaignStrategicObjectiveDto>>;

public sealed class UpdateCampaignStrategicObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser) : ICommandHandler<UpdateCampaignStrategicObjectiveCommand, Result<CampaignStrategicObjectiveDto>>
{
    public async Task<Result<CampaignStrategicObjectiveDto>> Handle(
        UpdateCampaignStrategicObjectiveCommand request,
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

        try
        {
            cycle.EditStrategicObjective(
                request.ObjectiveId,
                request.Title,
                request.Description,
                request.ResponsibleFunctionLabel);
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<CampaignStrategicObjectiveDto>(
                Error.Validation("CampaignStrategicObjective.Invalid", exception.Message));
        }

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.StrategicObjectiveUpdated,
            currentUser.UserId,
            currentUser.FullName,
            $"Updated strategic objective '{objective.Title}'."));

        await dbContext.SaveChangesAsync(cancellationToken);

        return CycleMapper.ToStrategicObjectiveDto(objective);
    }
}
