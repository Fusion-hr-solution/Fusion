using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ReopenTenantStructure;

public sealed class ReopenTenantStructureCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<ReopenTenantStructureCommand, Result<TenantSetupStateDto>>
{
    public async Task<Result<TenantSetupStateDto>> Handle(
        ReopenTenantStructureCommand request,
        CancellationToken cancellationToken)
    {
        var state = await dbContext.TenantSetupStates
            .FirstOrDefaultAsync(cancellationToken);

        if (state is null || state.CurrentPhase == TenantSetupPhase.NotStarted)
        {
            throw new InvalidTenantSetupStateException("Start setup before reopening the draft.");
        }

        if (state.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException("TenantSetupState", state.Id);
        }

        if (state.CurrentPhase != TenantSetupPhase.StructurallyGoverned)
        {
            throw new InvalidTenantSetupStateException("Only an approved structure can be reopened.");
        }

        state.Reopen();

        dbContext.TenantSetupActivities.Add(
            TenantSetupActivity.Create(
                state.TenantId,
                state.Id,
                TenantSetupActivityType.Reopened,
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

        return Result.Success(TenantSetupStateMapper.Map(state, recentActivities));
    }
}