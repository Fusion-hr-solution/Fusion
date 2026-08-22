using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Population;

public sealed record GetPopulationQuery(Guid CycleId) : IQuery<Result<PopulationDto>>;
public sealed record SetPopulationCommand(Guid CycleId, SetPopulationRequest Request) : ICommand<Result<PopulationDto>>;
public sealed record ConfirmPopulationCommand(Guid CycleId) : ICommand<Result<PopulationDto>>;

public sealed class GetPopulationHandler(PerformanceDbContext db, ITenantContext tenant, PopulationResolutionService resolver)
    : IQueryHandler<GetPopulationQuery, Result<PopulationDto>>
{
    public async Task<Result<PopulationDto>> Handle(GetPopulationQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PopulationDto>(Error.NotFound("Cycle", request.CycleId));

        var definition = await LoadOrCreateDefinitionAsync(db, tenant, cycle, cancellationToken);
        if (db.Entry(definition).State == EntityState.Added)
            await db.SaveChangesAsync(cancellationToken);

        var resolution = await resolver.ResolveAsync(cycle, definition, cancellationToken);
        return ToDto(definition, resolution);
    }

    internal static async Task<PopulationDefinition> LoadOrCreateDefinitionAsync(
        PerformanceDbContext db, ITenantContext tenant, PerformanceCycle cycle, CancellationToken cancellationToken)
    {
        var definition = await db.PopulationDefinitions
            .Include(d => d.OrgUnitSelections)
            .Include(d => d.Inclusions)
            .Include(d => d.Exclusions)
            .FirstOrDefaultAsync(d => d.CycleId == cycle.Id, cancellationToken);

        if (definition is null)
        {
            definition = PopulationDefinition.Create(tenant.TenantId, cycle.Id, cycle.StartDate);
            db.PopulationDefinitions.Add(definition);
            // Persisted by the caller's SaveChanges so creation and any first mutation land in
            // one write; read paths simply resolve against the in-memory instance.
        }

        return definition;
    }

    internal static PopulationDto ToDto(PopulationDefinition definition, PopulationResolution resolution)
        => new(
            PerformanceMappers.ToSelectionDto(definition),
            resolution.ReadyCount,
            resolution.NeedsAttentionCount,
            resolution.ExcludedCount,
            resolution.Candidates.Select(PerformanceMappers.ToDto).ToList());
}

public sealed class SetPopulationHandler(PerformanceDbContext db, ITenantContext tenant, PopulationResolutionService resolver)
    : ICommandHandler<SetPopulationCommand, Result<PopulationDto>>
{
    public async Task<Result<PopulationDto>> Handle(SetPopulationCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PopulationDto>(Error.NotFound("Cycle", command.CycleId));
        if (!cycle.IsDraft)
            return Result.Failure<PopulationDto>(Error.Conflict("Cycle.NotDraft", "Population can only be changed while the Cycle is Draft."));

        var definition = await GetPopulationHandler.LoadOrCreateDefinitionAsync(db, tenant, cycle, cancellationToken);
        var request = command.Request;

        try
        {
            definition.SetSelection(
                request.Mode,
                (request.OrgUnitSelections ?? []).Select(selection => (selection.OrgUnitId, selection.IncludeDescendants)),
                request.Inclusions ?? [],
                (request.Exclusions ?? []).Select(exclusion => (exclusion.EmployeeId, exclusion.Reason)));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<PopulationDto>(Error.Validation("Population.Invalid", ex.Message));
        }

        // SetSelection replaces the rule's child rows wholesale (they are immutable value rows,
        // never edited in place). A brand-new child with a client-generated key reached through
        // the already-tracked definition is detected as Modified rather than Added; correct it so
        // it inserts instead of trying to UPDATE a row that does not exist.
        foreach (var entry in db.ChangeTracker.Entries().Where(e => e.State == EntityState.Modified))
        {
            if (entry.Entity is PopulationOrgUnitSelection or PopulationInclusion or PopulationExclusion)
                entry.State = EntityState.Added;
        }

        // Changing the rule invalidates any previously confirmed roster.
        var existingParticipants = await db.Participants.Where(p => p.CycleId == cycle.Id).ToListAsync(cancellationToken);
        if (existingParticipants.Count > 0)
            db.Participants.RemoveRange(existingParticipants);

        await db.SaveChangesAsync(cancellationToken);

        var resolution = await resolver.ResolveAsync(cycle, definition, cancellationToken);
        return GetPopulationHandler.ToDto(definition, resolution);
    }
}

public sealed class ConfirmPopulationHandler(PerformanceDbContext db, ITenantContext tenant, PopulationResolutionService resolver)
    : ICommandHandler<ConfirmPopulationCommand, Result<PopulationDto>>
{
    public async Task<Result<PopulationDto>> Handle(ConfirmPopulationCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PopulationDto>(Error.NotFound("Cycle", command.CycleId));
        if (!cycle.IsDraft)
            return Result.Failure<PopulationDto>(Error.Conflict("Cycle.NotDraft", "Population can only be confirmed while the Cycle is Draft."));

        var definition = await GetPopulationHandler.LoadOrCreateDefinitionAsync(db, tenant, cycle, cancellationToken);
        var resolution = await resolver.ResolveAsync(cycle, definition, cancellationToken);

        if (resolution.UnresolvedBlockers.Count > 0)
        {
            var names = string.Join(", ", resolution.UnresolvedBlockers.Take(5).Select(candidate => candidate.DisplayName));
            return Result.Failure<PopulationDto>(Error.Conflict(
                "Population.Unresolved",
                $"{resolution.UnresolvedBlockers.Count} participant(s) need attention before confirmation: {names}. Resolve the Core data issue or exclude them with a reason."));
        }

        var roster = resolution.Candidates.Where(candidate => candidate.CountsToRoster).ToList();
        if (roster.Count == 0)
            return Result.Failure<PopulationDto>(Error.Conflict("Population.Empty", "The population is empty. Broaden the selection before confirming."));

        var existing = await db.Participants.Where(p => p.CycleId == cycle.Id).ToListAsync(cancellationToken);
        if (existing.Count > 0)
            db.Participants.RemoveRange(existing);

        foreach (var candidate in roster)
        {
            db.Participants.Add(Participant.Create(
                tenant.TenantId,
                cycle.Id,
                candidate.EmployeeId,
                candidate.DisplayName,
                candidate.JobTitle,
                candidate.OrgUnitId,
                candidate.OrgUnitName,
                candidate.ManagerEmployeeId,
                candidate.ManagerDisplayName,
                candidate.ByExplicitInclusion));
        }

        definition.MarkConfirmed();
        await db.SaveChangesAsync(cancellationToken);

        var confirmed = await resolver.ResolveAsync(cycle, definition, cancellationToken);
        return GetPopulationHandler.ToDto(definition, confirmed);
    }
}
