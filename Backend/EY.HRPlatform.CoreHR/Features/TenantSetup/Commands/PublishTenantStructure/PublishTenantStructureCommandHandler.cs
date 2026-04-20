using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.PublishTenantStructure;

public sealed class PublishTenantStructureCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<PublishTenantStructureCommand, Result<TenantSetupStateDto>>
{
    public async Task<Result<TenantSetupStateDto>> Handle(
        PublishTenantStructureCommand request,
        CancellationToken cancellationToken)
    {
        var state = await dbContext.TenantSetupStates
            .FirstOrDefaultAsync(cancellationToken);

        if (state is null || state.CurrentPhase == TenantSetupPhase.NotStarted)
        {
            throw new InvalidTenantSetupStateException("Start setup before publishing the structure.");
        }

        if (state.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException("TenantSetupState", state.Id);
        }

        if (state.CurrentPhase == TenantSetupPhase.StructurallyPublished)
        {
            throw new InvalidTenantSetupStateException("The structure is already live.");
        }

        if (state.CurrentPhase == TenantSetupPhase.Operational)
        {
            throw new InvalidTenantSetupStateException("Setup is already complete.");
        }

        if (state.CurrentPhase != TenantSetupPhase.StructurallyGoverned)
        {
            throw new InvalidTenantSetupStateException("Approve the structure before publishing it to live.");
        }

        var draftUnits = await dbContext.DraftOrgUnits
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        var readiness = DraftStructureRules.EvaluateDraftReadiness(draftUnits, schema);

        if (!readiness.IsReadyForApproval)
        {
            throw new InvalidTenantSetupStateException("Reopen the draft and fix the remaining structure issues before publishing.");
        }

        var useTransaction = !string.Equals(
            dbContext.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.OrdinalIgnoreCase);
        await using var transaction = useTransaction
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        try
        {
            await ReplaceLiveStructureAsync(draftUnits, schema, cancellationToken);

            state.Publish();
            state.Complete();

            dbContext.TenantSetupActivities.AddRange(
                TenantSetupActivity.Create(
                    state.TenantId,
                    state.Id,
                    TenantSetupActivityType.Published,
                    request.ActorUserId,
                    request.ActorFullName,
                    request.ActorRole,
                    request.IsPlatformAssisted),
                TenantSetupActivity.Create(
                    state.TenantId,
                    state.Id,
                    TenantSetupActivityType.Completed,
                    request.ActorUserId,
                    request.ActorFullName,
                    request.ActorRole,
                    request.IsPlatformAssisted));

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

        return Result.Success(TenantSetupStateMapper.Map(state, recentActivities));
    }

    private async Task ReplaceLiveStructureAsync(
        IReadOnlyCollection<DraftOrgUnit> draftUnits,
        Features.TenantSettings.Dtos.DraftStructureSchemaDto schema,
        CancellationToken cancellationToken)
    {
        var existingUnits = await dbContext.OrgUnits.ToListAsync(cancellationToken);
        if (existingUnits.Count > 0)
        {
            var existingById = existingUnits.ToDictionary(unit => unit.Id);
            var existingByDepth = existingUnits
                .OrderByDescending(unit => GetDepth(unit, existingById))
                .ToList();

            dbContext.OrgUnits.RemoveRange(existingByDepth);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var kindLabelLookup = DraftStructureRules.CreateOrgUnitKindLabelLookup(schema);
        var draftLookup = draftUnits.ToDictionary(unit => unit.Id);
        var draftUnitsByDepth = draftUnits
            .OrderBy(unit => GetDepth(unit, draftLookup))
            .ThenBy(unit => unit.ReferenceKey, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var liveUnitsByDraftId = new Dictionary<Guid, OrgUnit>();

        foreach (var draftUnit in draftUnitsByDepth)
        {
            if (!kindLabelLookup.TryGetValue(draftUnit.OrgUnitKindKey, out var kindLabel))
            {
                throw new InvalidTenantSetupStateException(
                    $"Unit type '{draftUnit.OrgUnitKindKey}' is no longer available. Reopen the draft and fix it before publishing.");
            }

            var parentId = draftUnit.ParentId.HasValue
                ? liveUnitsByDraftId[draftUnit.ParentId.Value].Id
                : (Guid?)null;

            var orgUnit = OrgUnit.Create(
                draftUnit.TenantId,
                draftUnit.ReferenceKey,
                draftUnit.DisplayName,
                kindLabel,
                parentId);

            liveUnitsByDraftId[draftUnit.Id] = orgUnit;
            dbContext.OrgUnits.Add(orgUnit);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static int GetDepth<TUnit>(
        TUnit unit,
        IReadOnlyDictionary<Guid, TUnit> lookup)
        where TUnit : class
    {
        var depth = 0;
        var currentParentId = GetParentId(unit);

        while (currentParentId.HasValue && lookup.TryGetValue(currentParentId.Value, out var parent))
        {
            depth += 1;
            currentParentId = GetParentId(parent);
        }

        return depth;
    }

    private static Guid? GetParentId<TUnit>(TUnit unit)
        where TUnit : class
        => unit switch
        {
            DraftOrgUnit draftOrgUnit => draftOrgUnit.ParentId,
            OrgUnit orgUnit => orgUnit.ParentId,
            _ => null,
        };
}