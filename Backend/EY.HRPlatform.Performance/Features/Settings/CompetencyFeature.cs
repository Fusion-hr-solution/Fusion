using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Settings;

public sealed record ListCompetenciesQuery(bool IncludeArchived = true) : IQuery<Result<IReadOnlyList<CompetencyDto>>>;
public sealed record CreateCompetencyCommand(CreateCompetencyRequest Request) : ICommand<Result<CompetencyDto>>;
public sealed record UpdateCompetencyCommand(Guid Id, UpdateCompetencyRequest Request) : ICommand<Result<CompetencyDto>>;
public sealed record ArchiveCompetencyCommand(Guid Id, CompetencyVersionRequest Request) : ICommand<Result<CompetencyDto>>;
public sealed record DeleteCompetencyCommand(Guid Id, CompetencyVersionRequest Request) : ICommand<Result<bool>>;

public sealed class ListCompetenciesHandler(PerformanceDbContext db) : IQueryHandler<ListCompetenciesQuery, Result<IReadOnlyList<CompetencyDto>>>
{
    public async Task<Result<IReadOnlyList<CompetencyDto>>> Handle(ListCompetenciesQuery request, CancellationToken cancellationToken)
    {
        var items = await db.Competencies.AsNoTracking().Where(item => request.IncludeArchived || item.State == CompetencyState.Active)
            .OrderBy(item => item.State).ThenBy(item => item.Name).ToListAsync(cancellationToken);
        var usedIn = await UsedInAsync(db, cancellationToken);
        return Result.Success<IReadOnlyList<CompetencyDto>>(items.Select(item => ToDto(item) with
        {
            UsedIn = usedIn.TryGetValue(item.Id, out var cycles) ? cycles : [],
        }).ToArray());
    }
    internal static CompetencyDto ToDto(Competency item) => new(item.Id, item.Name, item.Description, item.Behaviors, item.State.ToString(), item.FirstUsedAt, item.Version);

    /// <summary>Per competency, the cycles whose launched rounds rated it. A round keeps its competencies as a JSON list.</summary>
    internal static async Task<Dictionary<Guid, IReadOnlyList<string>>> UsedInAsync(PerformanceDbContext db, CancellationToken cancellationToken)
    {
        var rounds = await (from round in db.ReviewRounds.AsNoTracking()
                            join cycle in db.Cycles.AsNoTracking() on round.CycleId equals cycle.Id
                            where round.LaunchedAt != null
                            orderby cycle.StartDate
                            select new { round.CompetencyIdsJson, CycleName = cycle.Name })
            .ToListAsync(cancellationToken);
        return rounds
            .SelectMany(round => (System.Text.Json.JsonSerializer.Deserialize<Guid[]>(round.CompetencyIdsJson) ?? [])
                .Select(id => (Id: id, round.CycleName)))
            .GroupBy(use => use.Id)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(use => use.CycleName).Distinct().ToArray());
    }
}

public sealed class CreateCompetencyHandler(PerformanceDbContext db, ITenantContext tenant, IPerformanceAudit audit)
    : ICommandHandler<CreateCompetencyCommand, Result<CompetencyDto>>
{
    public async Task<Result<CompetencyDto>> Handle(CreateCompetencyCommand command, CancellationToken cancellationToken)
    {
        Competency item;
        try { item = Competency.Create(tenant.TenantId, command.Request.Name, command.Request.Description, command.Request.Behaviors); }
        catch (ArgumentException ex) { return Result.Failure<CompetencyDto>(PerformanceErrors.Validation("Competency.Invalid", ex.Message)); }
        if (await db.Competencies.AnyAsync(existing => existing.State == CompetencyState.Active && existing.NameKey == item.NameKey, cancellationToken))
            return Result.Failure<CompetencyDto>(PerformanceErrors.Validation("Competency.DuplicateName", "An active competency already uses this name."));
        db.Competencies.Add(item);
        audit.Record(tenant.TenantId, "Competency", item.Id, null, PerformanceAuditActions.CompetencyCreated, new { after = new { item.Name, item.Description, item.Behaviors } });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(ListCompetenciesHandler.ToDto(item));
    }
}

public sealed class UpdateCompetencyHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<UpdateCompetencyCommand, Result<CompetencyDto>>
{
    public async Task<Result<CompetencyDto>> Handle(UpdateCompetencyCommand command, CancellationToken cancellationToken)
    {
        var item = await db.Competencies.FirstOrDefaultAsync(value => value.Id == command.Id, cancellationToken);
        if (item is null) return Result.Failure<CompetencyDto>(PerformanceErrors.NotFound("Competency", command.Id));
        if (VersionGuard.Check(item, command.Request.ExpectedVersion) is { } stale) return Result.Failure<CompetencyDto>(stale);
        try
        {
            var candidate = Competency.Create(item.TenantId, command.Request.Name, command.Request.Description, command.Request.Behaviors);
            if (await db.Competencies.AnyAsync(other => other.Id != item.Id && other.State == CompetencyState.Active && other.NameKey == candidate.NameKey, cancellationToken))
                return Result.Failure<CompetencyDto>(PerformanceErrors.Validation("Competency.DuplicateName", "An active competency already uses this name."));
            var before = new { item.Name, item.Description, item.Behaviors };
            item.Update(command.Request.Name, command.Request.Description, command.Request.Behaviors);
            audit.Record(item.TenantId, "Competency", item.Id, null, PerformanceAuditActions.CompetencyChanged,
                new { before, after = new { item.Name, item.Description, item.Behaviors } });
        }
        catch (ArgumentException ex) { return Result.Failure<CompetencyDto>(PerformanceErrors.Validation("Competency.Invalid", ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<CompetencyDto>(PerformanceErrors.InvalidState("Competency.Archived", ex.Message)); }
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(ListCompetenciesHandler.ToDto(item));
    }
}

public sealed class ArchiveCompetencyHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<ArchiveCompetencyCommand, Result<CompetencyDto>>
{
    public async Task<Result<CompetencyDto>> Handle(ArchiveCompetencyCommand command, CancellationToken cancellationToken)
    {
        var item = await db.Competencies.FirstOrDefaultAsync(value => value.Id == command.Id, cancellationToken);
        if (item is null) return Result.Failure<CompetencyDto>(PerformanceErrors.NotFound("Competency", command.Id));
        if (VersionGuard.Check(item, command.Request.ExpectedVersion) is { } stale) return Result.Failure<CompetencyDto>(stale);
        if (item.State == CompetencyState.Active)
        {
            item.Archive();
            audit.Record(item.TenantId, "Competency", item.Id, null, PerformanceAuditActions.CompetencyArchived, new { item.Name, item.FirstUsedAt });
            await db.SaveChangesAsync(cancellationToken);
        }
        return Result.Success(ListCompetenciesHandler.ToDto(item));
    }
}

public sealed class DeleteCompetencyHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<DeleteCompetencyCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteCompetencyCommand command, CancellationToken cancellationToken)
    {
        var item = await db.Competencies.FirstOrDefaultAsync(value => value.Id == command.Id, cancellationToken);
        if (item is null) return Result.Failure<bool>(PerformanceErrors.NotFound("Competency", command.Id));
        if (VersionGuard.Check(item, command.Request.ExpectedVersion) is { } stale) return Result.Failure<bool>(stale);
        if (item.FirstUsedAt is not null)
            return Result.Failure<bool>(PerformanceErrors.InvalidState("Competency.InUse", "This competency has been used by a launched review round. Archive it instead."));
        audit.Record(item.TenantId, "Competency", item.Id, null, PerformanceAuditActions.CompetencyDeleted, new { item.Name });
        db.Competencies.Remove(item);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(true);
    }
}
