using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ApproveTenantStructure;

public sealed class ApproveTenantStructureCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<ApproveTenantStructureCommand, Result<TenantSetupStateDto>>
{
    public async Task<Result<TenantSetupStateDto>> Handle(
        ApproveTenantStructureCommand request,
        CancellationToken cancellationToken)
    {
        var state = await dbContext.TenantSetupStates
            .FirstOrDefaultAsync(cancellationToken);

        if (state is null || state.CurrentPhase == TenantSetupPhase.NotStarted)
        {
            throw new InvalidTenantSetupStateException("Start setup before approving the structure.");
        }

        if (state.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException("TenantSetupState", state.Id);
        }

        if (state.CurrentPhase == TenantSetupPhase.StructurallyGoverned)
        {
            throw new InvalidTenantSetupStateException("The structure is already approved. Reopen it if changes are needed.");
        }

        if (state.CurrentPhase != TenantSetupPhase.Activated)
        {
            throw new InvalidTenantSetupStateException("Only the active draft can be approved here.");
        }

        var readiness = await DraftStructureRules.EvaluateDraftReadinessAsync(dbContext, cancellationToken);
        if (!readiness.IsReadyForApproval)
        {
            throw new InvalidTenantSetupStateException("Fix the remaining structure issues before approval.");
        }

        state.Approve(
            request.ActorUserId,
            request.ActorFullName,
            request.ActorRole,
            request.IsPlatformAssisted);

        dbContext.TenantSetupActivities.Add(
            TenantSetupActivity.Create(
                state.TenantId,
                state.Id,
                TenantSetupActivityType.Approved,
                request.ActorUserId,
                request.ActorFullName,
                request.ActorRole,
                request.IsPlatformAssisted));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("TenantSetupState", state.Id);
        }

        var recentActivities = await dbContext.TenantSetupActivities
            .AsNoTracking()
            .Where(activity => activity.TenantSetupStateId == state.Id)
            .OrderByDescending(activity => activity.CreatedAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        return Result.Success(
            await TenantSetupStateProjection.MapAsync(
                dbContext,
                state,
                recentActivities,
                cancellationToken));
    }
}