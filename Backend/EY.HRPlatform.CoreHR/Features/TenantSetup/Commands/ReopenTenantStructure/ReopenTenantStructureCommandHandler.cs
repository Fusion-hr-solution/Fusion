using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
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

        if (state.CurrentPhase != TenantSetupPhase.StructurallyGoverned
            && state.CurrentPhase != TenantSetupPhase.StructurallyPublished
            && state.CurrentPhase != TenantSetupPhase.Operational)
        {
            throw new InvalidTenantSetupStateException("Only an approved or published structure can be reopened.");
        }

        var useTransaction = !string.Equals(
            dbContext.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.OrdinalIgnoreCase);
        await using var transaction = useTransaction
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        if (state.CurrentPhase == TenantSetupPhase.StructurallyPublished
            || state.CurrentPhase == TenantSetupPhase.Operational)
        {
            await ReseedDraftStructureFromLiveAsync(cancellationToken);
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

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
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

    private async Task ReseedDraftStructureFromLiveAsync(CancellationToken cancellationToken)
    {
        var liveUnits = await dbContext.OrgUnits
            .AsNoTracking()
            .Where(unit => unit.IsActive)
            .OrderBy(unit => unit.Code)
            .ToListAsync(cancellationToken);

        if (liveUnits.Count == 0)
        {
            return;
        }

        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        var kindKeyByLabel = schema.OrgUnitKinds
            .GroupBy(kind => kind.DisplayLabel.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Key, StringComparer.OrdinalIgnoreCase);
        var existingDraftUnits = await dbContext.DraftOrgUnits.ToListAsync(cancellationToken);

        if (existingDraftUnits.Count > 0)
        {
            dbContext.DraftOrgUnits.RemoveRange(existingDraftUnits);
        }

        var liveLookup = liveUnits.ToDictionary(unit => unit.Id);
        var draftByLiveId = new Dictionary<Guid, DraftOrgUnit>();

        foreach (var liveUnit in liveUnits
            .OrderBy(unit => GetDepth(unit, liveLookup))
            .ThenBy(unit => unit.Code, StringComparer.OrdinalIgnoreCase))
        {
            if (!kindKeyByLabel.TryGetValue(liveUnit.Type, out var kindKey))
            {
                throw new InvalidTenantSetupStateException(
                    $"Live unit type '{liveUnit.Type}' is no longer available. Update the org-unit kinds before reopening the draft.");
            }

            var parentId = liveUnit.ParentId.HasValue
                ? draftByLiveId[liveUnit.ParentId.Value].Id
                : (Guid?)null;
            var draftUnit = DraftOrgUnit.Create(
                liveUnit.TenantId,
                liveUnit.Code,
                liveUnit.Name,
                kindKey,
                null,
                null,
                null,
                parentId);

            dbContext.DraftOrgUnits.Add(draftUnit);
            draftByLiveId[liveUnit.Id] = draftUnit;
        }
    }

    private static int GetDepth(
        OrgUnit unit,
        IReadOnlyDictionary<Guid, OrgUnit> lookup)
    {
        var depth = 0;
        var currentParentId = unit.ParentId;

        while (currentParentId.HasValue && lookup.TryGetValue(currentParentId.Value, out var parent))
        {
            depth += 1;
            currentParentId = parent.ParentId;
        }

        return depth;
    }
}