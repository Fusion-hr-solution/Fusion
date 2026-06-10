using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.ClearDraftStructure;

public sealed class ClearDraftStructureCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<ClearDraftStructureCommand, Result>
{
    public async Task<Result> Handle(
        ClearDraftStructureCommand request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureDraftEditableAsync(dbContext, cancellationToken);
        var setupState = await dbContext.TenantSetupStates.FirstAsync(cancellationToken);

        var draftOrgUnits = await dbContext.DraftOrgUnits.ToListAsync(cancellationToken);

        if (draftOrgUnits.Count == 0)
        {
            return Result.Success();
        }

        dbContext.DraftOrgUnits.RemoveRange(draftOrgUnits);

        if (request.ActorUserId.HasValue
            && !string.IsNullOrWhiteSpace(request.ActorFullName)
            && !string.IsNullOrWhiteSpace(request.ActorRole))
        {
            dbContext.TenantSetupActivities.Add(
                TenantSetupActivity.Create(
                    setupState.TenantId,
                    setupState.Id,
                    TenantSetupActivityType.DraftCleared,
                    request.ActorUserId.Value,
                    request.ActorFullName,
                    request.ActorRole,
                    request.IsPlatformAssisted));
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
