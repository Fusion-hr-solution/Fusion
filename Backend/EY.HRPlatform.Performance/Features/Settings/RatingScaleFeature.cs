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

public sealed record GetRatingScaleQuery : IQuery<Result<RatingScaleDto>>;
public sealed record UpdateRatingScaleCommand(UpdateRatingScaleRequest Request) : ICommand<Result<RatingScaleDto>>;

public sealed class GetRatingScaleHandler(PerformanceDbContext db, ITenantContext tenant)
    : IQueryHandler<GetRatingScaleQuery, Result<RatingScaleDto>>
{
    public async Task<Result<RatingScaleDto>> Handle(GetRatingScaleQuery request, CancellationToken cancellationToken)
    {
        var scale = await db.RatingScales.SingleOrDefaultAsync(cancellationToken);
        if (scale is null)
        {
            scale = RatingScale.CreateDefault(tenant.TenantId);
            var initial = scale.CreateNextVersion(RatingScaleDefaults.Levels);
            db.RatingScales.Add(scale);
            db.RatingScaleVersions.Add(initial);
            await db.SaveChangesAsync(cancellationToken);
            return await RatingScaleMapper.ToDtoAsync(db, scale, initial, cancellationToken);
        }

        var version = await db.RatingScaleVersions.SingleAsync(v => v.Id == scale.CurrentVersionId
            && v.RatingScaleId == scale.Id, cancellationToken);
        return await RatingScaleMapper.ToDtoAsync(db, scale, version, cancellationToken);
    }
}

public sealed class UpdateRatingScaleHandler(PerformanceDbContext db, ITenantContext tenant, IPerformanceAudit audit)
    : ICommandHandler<UpdateRatingScaleCommand, Result<RatingScaleDto>>
{
    public async Task<Result<RatingScaleDto>> Handle(UpdateRatingScaleCommand command, CancellationToken cancellationToken)
    {
        if (TryNormalize(command.Request.Levels, out var levels) is { } validation)
            return Result.Failure<RatingScaleDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.RatingScaleInvalid, validation));

        var scale = await db.RatingScales.SingleOrDefaultAsync(cancellationToken)
            ?? RatingScale.CreateDefault(tenant.TenantId);
        if (VersionGuard.Check(scale, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<RatingScaleDto>(stale);

        RatingScaleVersion? previous = scale.CurrentVersionId is null ? null
            : await db.RatingScaleVersions.SingleAsync(v => v.Id == scale.CurrentVersionId && v.RatingScaleId == scale.Id, cancellationToken);
        var next = scale.CreateNextVersion(levels);
        if (db.Entry(scale).State == EntityState.Detached) db.RatingScales.Add(scale);
        db.RatingScaleVersions.Add(next);
        audit.Record(tenant.TenantId, "RatingScale", scale.Id, null, PerformanceAuditActions.RatingScaleChanged,
            new { before = previous?.Levels, after = next.Levels, version = next.Number });
        await db.SaveChangesAsync(cancellationToken);
        return await RatingScaleMapper.ToDtoAsync(db, scale, next, cancellationToken);
    }

    private static string? TryNormalize(IReadOnlyList<RatingScaleLevelDto>? input, out IReadOnlyList<RatingScaleLevel> levels)
    {
        levels = [];
        if (input is null || input.Count is < 3 or > 7)
            return "A rating scale must contain between three and seven levels.";
        if (input.Where((level, index) => level is null || level.Value != index + 1
                || string.IsNullOrWhiteSpace(level.Label)).Any())
            return "Rating levels must be ordered from 1 and every level needs a label.";
        var normalized = input.Select(level => new RatingScaleLevel(level.Value, level.Label.Trim(),
            string.IsNullOrWhiteSpace(level.Description) ? null : level.Description.Trim())).ToArray();
        if (normalized.Select(level => level.Label).Distinct(StringComparer.OrdinalIgnoreCase).Count() != normalized.Length)
            return "Rating level labels must be unique.";
        levels = normalized;
        return null;
    }
}

public static class RatingScaleDefaults
{
    public static readonly IReadOnlyList<RatingScaleLevel> Levels =
    [
        new(1, "Needs improvement", null),
        new(2, "Developing", null),
        new(3, "Effective", null),
        new(4, "Strong", null),
        new(5, "Exceptional", null),
    ];
}

public static class RatingScaleMapper
{
    public static RatingScaleDto ToDto(RatingScale scale, RatingScaleVersion version)
        => new(version.Number, version.Levels.Select(level => new RatingScaleLevelDto(level.Value, level.Label, level.Description)).ToArray())
        { Version = scale.Version };

    /// <summary>The scale with its version history: a launched round records the version it rates on.</summary>
    public static async Task<RatingScaleDto> ToDtoAsync(PerformanceDbContext db, RatingScale scale, RatingScaleVersion current,
        CancellationToken cancellationToken)
    {
        var versions = await db.RatingScaleVersions.AsNoTracking().Where(v => v.RatingScaleId == scale.Id)
            .OrderByDescending(v => v.Number).Select(v => new { v.Id, v.Number, v.CreatedAt }).ToListAsync(cancellationToken);
        var rounds = await (from round in db.ReviewRounds.AsNoTracking()
                            join cycle in db.Cycles.AsNoTracking() on round.CycleId equals cycle.Id
                            where round.RatingScaleVersionId != null && round.LaunchedAt != null
                            orderby round.LaunchedAt
                            select new { VersionId = round.RatingScaleVersionId!.Value, CycleName = cycle.Name, RoundName = round.Name })
            .ToListAsync(cancellationToken);
        var usedBy = rounds.ToLookup(round => round.VersionId, round => $"{round.CycleName} · {round.RoundName}");
        return ToDto(scale, current) with
        {
            Versions = versions.Select(v => new RatingScaleVersionDto(v.Number, v.CreatedAt, usedBy[v.Id].ToArray())).ToArray(),
        };
    }
}
