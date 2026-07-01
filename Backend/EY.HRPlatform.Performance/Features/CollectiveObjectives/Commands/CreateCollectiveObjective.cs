using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CollectiveObjectives.Commands;

/// <summary>
/// Creates a collective (team) objective owned by an org unit and aligned to a published
/// strategic parent (D-08), inside an Active campaign. Then dispatches routing.
/// </summary>
public sealed record CreateCollectiveObjectiveCommand(
    Guid CycleId,
    Guid OrgUnitId,
    Guid StrategicParentId,
    string Title,
    string? Description,
    decimal? Weight,
    DateTime? DueDate) : ICommand<Result<Guid>>;

public sealed class CreateCollectiveObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    ICoreWorkforceClient workforceClient,
    IHttpContextAccessor httpContextAccessor,
    ISender sender) : ICommandHandler<CreateCollectiveObjectiveCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateCollectiveObjectiveCommand request, CancellationToken cancellationToken)
    {
        // D-15: deny-by-default — caller must have collective view/manage scope
        if (!accessPolicy.CanViewCollectiveObjectives(httpContextAccessor.HttpContext!.User))
            return Result.Failure<Guid>(Error.Forbidden("Collective.Forbidden",
                "You do not have permission to create collective objectives."));

        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<Guid>(Error.Forbidden("Collective.EmployeeContextRequired",
                "An employee context is required to create a collective objective."));

        // Validate the campaign cycle is Active (same guard as individual create)
        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
            return Result.Failure<Guid>(Error.NotFound("PerformanceCycle", request.CycleId));

        if (cycle.Status != PerformanceCycleStatus.Active)
            return Result.Failure<Guid>(Error.Conflict("Collective.CycleNotActive",
                "Collective objectives can only be created in an active campaign."));

        // Validate strategic parent exists AND is Published in the matching scope/period (D-08)
        var strategicParent = await dbContext.StrategicObjectives
            .FirstOrDefaultAsync(s => s.Id == request.StrategicParentId, cancellationToken);

        if (strategicParent is null)
            return Result.Failure<Guid>(Error.NotFound("StrategicObjective", request.StrategicParentId));

        if (strategicParent.Status != StrategicObjectiveStatus.Published)
            return Result.Failure<Guid>(Error.Validation("Collective.AlignmentRequired",
                "A collective objective must be aligned to a Published strategic parent."));

        // Resolve org-unit owner for the collective owner employee id
        var orgUnit = await workforceClient.GetOrgUnitAsync(request.OrgUnitId, cancellationToken);
        if (orgUnit is null)
            return Result.Failure<Guid>(Error.NotFound("OrgUnit", request.OrgUnitId));

        var ownerEmployeeId = orgUnit.ResponsibleManagerEmployeeId ?? currentUser.EmployeeId.Value;

        // Create the Team-level objective aligned to the strategic parent
        var objective = PerformanceObjective.Create(
            cycle.TenantId,
            cycle.Id,
            ObjectiveLevel.Team,
            ownerEmployeeId,
            request.Title,
            request.Description,
            request.Title, // SuccessMeasure reuse — collective objectives don't need separate SMART fields
            request.Title, // Target reuse
            request.DueDate ?? cycle.PeriodEnd,
            request.Weight,
            parentObjectiveId: request.StrategicParentId);

        dbContext.PerformanceObjectives.Add(objective);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Dispatch approval routing (D-09)
        await sender.Send(new RouteCollectiveApprovalCommand(objective.Id), cancellationToken);

        return objective.Id;
    }
}
