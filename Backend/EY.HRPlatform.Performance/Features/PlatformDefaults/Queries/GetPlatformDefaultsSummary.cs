using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;

public sealed record GetPlatformDefaultsSummaryQuery : IQuery<Result<PlatformDefaultsSummaryDto>>;

public sealed class GetPlatformDefaultsSummaryQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetPlatformDefaultsSummaryQuery, Result<PlatformDefaultsSummaryDto>>
{
    public async Task<Result<PlatformDefaultsSummaryDto>> Handle(
        GetPlatformDefaultsSummaryQuery request,
        CancellationToken cancellationToken)
    {
        var guardrails = await db.PlatformPerformanceGuardrails
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var baseline = await db.PlatformObjectiveBaselines
            .AsNoTracking()
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        var appliedGuardrails = guardrails.FirstOrDefault();
        var appliedBaseline = baseline?.PublishedVersion;

        var lastUpdated = await db.PerformanceConfigurationAuditEntries
            .AsNoTracking()
            .Where(entry =>
                entry.Scope == "Platform" &&
                (entry.Action == "GuardrailPublished" ||
                 entry.Action == "BaselinePublished" ||
                 entry.Action == "GuardrailApplyBlocked"))
            .OrderByDescending(entry => entry.OccurredAt)
            .Select(entry => new PlatformDefaultsActivityDto(
                MapAction(entry.Action),
                entry.ActorName,
                entry.OccurredAt))
            .FirstOrDefaultAsync(cancellationToken);

        return Result.Success(new PlatformDefaultsSummaryDto(
            BuildStatus(appliedGuardrails, appliedBaseline),
            appliedGuardrails is null ? null : GetGuardrailsQueryHandler.ToDto(appliedGuardrails),
            appliedBaseline is null ? null : GetBaselineQueryHandler.ToDto(appliedBaseline),
            lastUpdated));
    }

    private static PlatformDefaultsStatusDto BuildStatus(
        Domain.Entities.Platform.PlatformPerformanceGuardrails? appliedGuardrails,
        Domain.Entities.Platform.PlatformObjectiveBaselineVersion? appliedBaseline)
    {
        var ready = appliedGuardrails is not null && appliedBaseline is not null;

        if (ready)
        {
            return new PlatformDefaultsStatusDto(
                "success",
                "Ready for new tenants",
                "The standard setup and advanced limits are applied. Existing tenants are not changed.");
        }

        if (appliedGuardrails is null)
        {
            return new PlatformDefaultsStatusDto(
                "neutral",
                "Advanced limits required",
                "Set the advanced limits first so every future tenant setup stays inside a valid operating range.");
        }

        return new PlatformDefaultsStatusDto(
            "neutral",
            "Standard setup required",
            "Apply a standard setup for new tenants once the advanced limits are in place.");
    }

    private static string MapAction(string action) => action switch
    {
        "GuardrailPublished" => "Advanced limits applied",
        "BaselinePublished" => "Standard setup applied",
        "GuardrailPublishBlocked" => "Advanced limits apply blocked",
        _ => action,
    };
}
