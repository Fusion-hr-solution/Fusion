using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
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

        if (state.CurrentPhase != TenantSetupPhase.Activated
            && state.CurrentPhase != TenantSetupPhase.StructurallyGoverned)
        {
            throw new InvalidTenantSetupStateException("Return to the active draft before publishing it to live.");
        }

        var draftUnits = await dbContext.DraftOrgUnits
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        var readiness = DraftStructureRules.EvaluateDraftReadiness(draftUnits, schema);

        if (!readiness.IsReadyForApproval)
        {
            throw new InvalidTenantSetupStateException("Fix the remaining structure issues before publishing the draft to live.");
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

        return Result.Success(
            await TenantSetupStateProjection.MapAsync(
                dbContext,
                state,
                recentActivities,
                cancellationToken));
    }

    private async Task ReplaceLiveStructureAsync(
        IReadOnlyCollection<DraftOrgUnit> draftUnits,
        Features.TenantSettings.Dtos.DraftStructureSchemaDto schema,
        CancellationToken cancellationToken)
    {
        var existingUnits = await dbContext.OrgUnits.ToListAsync(cancellationToken);
        var draftCodes = draftUnits
            .Select(unit => unit.ReferenceKey.Trim().ToUpperInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existingByCode = existingUnits
            .ToDictionary(unit => unit.Code, StringComparer.OrdinalIgnoreCase);
        var retiredUnits = existingUnits
            .Where(unit => !draftCodes.Contains(unit.Code))
            .ToList();

        if (retiredUnits.Count > 0)
        {
            var asOf = DateTime.UtcNow;
            var retiredUnitIds = retiredUnits
                .Select(unit => unit.Id)
                .ToList();

            var activeAssignments = retiredUnitIds.Count == 0
                ? []
                : await LoadRetiredUnitAssignmentBlocksAsync(retiredUnitIds, asOf, cancellationToken);

            if (activeAssignments.Count > 0)
            {
                var blockedCodes = retiredUnits
                    .Where(unit => activeAssignments.Any(assignment => assignment.OrgUnitId == unit.Id))
                    .Select(unit => unit.Code)
                    .OrderBy(code => code, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                throw new InvalidTenantSetupStateException(
                    $"Reassign active employees from the live org units being removed before publishing: {string.Join(", ", blockedCodes)}.");
            }

            foreach (var retiredUnit in retiredUnits.Where(unit => unit.IsActive))
            {
                retiredUnit.Deactivate();
            }
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

            var normalizedCode = draftUnit.ReferenceKey.Trim().ToUpperInvariant();
            if (existingByCode.TryGetValue(normalizedCode, out var orgUnit))
            {
                if (!orgUnit.IsActive)
                {
                    orgUnit.Activate();
                }

                orgUnit.Update(draftUnit.DisplayName, kindLabel, parentId);
            }
            else
            {
                orgUnit = OrgUnit.Create(
                    draftUnit.TenantId,
                    draftUnit.ReferenceKey,
                    draftUnit.DisplayName,
                    kindLabel,
                    parentId);
                dbContext.OrgUnits.Add(orgUnit);
                existingByCode[normalizedCode] = orgUnit;
            }

            liveUnitsByDraftId[draftUnit.Id] = orgUnit;
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

    private async Task<List<OrgUnitAssignmentBlock>> LoadRetiredUnitAssignmentBlocksAsync(
        IReadOnlyCollection<Guid> retiredUnitIds,
        DateTime asOf,
        CancellationToken cancellationToken)
    {
        var canonicalBlocks = await dbContext.WorkAssignments
            .AsNoTracking()
            .Where(assignment => assignment.IsPrimary
                && retiredUnitIds.Contains(assignment.OrgUnitId)
                && assignment.EffectiveFrom <= asOf
                && (assignment.EffectiveTo == null || asOf < assignment.EffectiveTo))
            .Join(
                dbContext.Employments.AsNoTracking(),
                assignment => assignment.EmploymentId,
                employment => employment.Id,
                (assignment, employment) => new { assignment.EmployeeId, assignment.OrgUnitId, Employment = employment })
            .Where(x => x.Employment.Status == EmploymentStatus.Active
                && x.Employment.EffectiveFrom <= asOf
                && (x.Employment.EffectiveTo == null || asOf < x.Employment.EffectiveTo))
            .Select(x => new { x.EmployeeId, x.OrgUnitId })
            .ToListAsync(cancellationToken);

        return canonicalBlocks
            .Select(x => new OrgUnitAssignmentBlock(x.OrgUnitId))
            .GroupBy(x => x.OrgUnitId)
            .Select(group => new OrgUnitAssignmentBlock(group.Key, group.Count()))
            .ToList();
    }
}

internal sealed record OrgUnitAssignmentBlock(Guid OrgUnitId, int Count = 1);
