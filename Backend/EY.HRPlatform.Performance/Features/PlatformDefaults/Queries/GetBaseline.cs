using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;

public sealed record GetBaselineQuery : IQuery<Result<IReadOnlyList<BaselineVersionDto>>>;

public sealed class GetBaselineQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetBaselineQuery, Result<IReadOnlyList<BaselineVersionDto>>>
{
    public async Task<Result<IReadOnlyList<BaselineVersionDto>>> Handle(
        GetBaselineQuery request,
        CancellationToken cancellationToken)
    {
        var versions = await db.PlatformObjectiveBaselineVersions
            .AsNoTracking()
            .OrderByDescending(v => v.VersionNumber)
            .ToListAsync(cancellationToken);

        IReadOnlyList<BaselineVersionDto> result = versions.Select(ToDto).ToList();
        return Result.Success(result);
    }

    internal static BaselineVersionDto ToDto(PlatformObjectiveBaselineVersion v) => new(
        v.Id, v.VersionNumber, v.Status.ToString(),
        v.MaxObjectivesPerPlan, v.AllowedWeightValues,
        v.ManagerValidationSlaDays, v.CascadeMode, v.MeasurementTypes,
        v.AttachmentsEnabled, v.PublishedAt, v.SupersededAt);
}
