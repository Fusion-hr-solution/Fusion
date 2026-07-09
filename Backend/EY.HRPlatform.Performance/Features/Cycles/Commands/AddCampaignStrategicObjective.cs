using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record AddCampaignStrategicObjectiveCommand(
    Guid CycleId,
    string Title,
    string? Description,
    string? ResponsibleFunctionLabel) : ICommand<Result<CampaignStrategicObjectiveDto>>;

public sealed class AddCampaignStrategicObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser) : ICommandHandler<AddCampaignStrategicObjectiveCommand, Result<CampaignStrategicObjectiveDto>>
{
    public async Task<Result<CampaignStrategicObjectiveDto>> Handle(
        AddCampaignStrategicObjectiveCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.StrategicObjectives)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
            return Result.Failure<CampaignStrategicObjectiveDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        CampaignStrategicObjective objective;
        try
        {
            objective = cycle.AddStrategicObjective(
                request.Title,
                request.Description,
                request.ResponsibleFunctionLabel);
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<CampaignStrategicObjectiveDto>(
                Error.Validation("CampaignStrategicObjective.Invalid", exception.Message));
        }

        dbContext.CampaignStrategicObjectives.Add(objective);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.StrategicObjectiveAdded,
            currentUser.UserId,
            currentUser.FullName,
            $"Added strategic objective '{objective.Title}'."));

        await dbContext.SaveChangesAsync(cancellationToken);

        return CycleMapper.ToStrategicObjectiveDto(objective);
    }
}
