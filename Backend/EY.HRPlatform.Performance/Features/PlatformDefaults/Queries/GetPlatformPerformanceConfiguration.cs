using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;

public sealed record GetPlatformPerformanceConfigurationQuery
    : IQuery<Result<PlatformPerformanceConfigurationSummaryDto>>;

public sealed class GetPlatformPerformanceConfigurationQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetPlatformPerformanceConfigurationQuery, Result<PlatformPerformanceConfigurationSummaryDto>>
{
    public async Task<Result<PlatformPerformanceConfigurationSummaryDto>> Handle(
        GetPlatformPerformanceConfigurationQuery query,
        CancellationToken cancellationToken)
    {
        var configuration = await db.PlatformPerformanceGuardrails
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        var starting = await db.PlatformObjectiveBaselines
            .AsNoTracking()
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (configuration is null || starting?.CurrentVersion is null)
            return new PlatformPerformanceConfigurationSummaryDto(false, null);

        return new PlatformPerformanceConfigurationSummaryDto(
            true,
            PlatformPerformanceConfigurationMapper.ToDto(configuration, starting.CurrentVersion));
    }
}

internal static class PlatformPerformanceConfigurationMapper
{
    public static PlatformPerformanceConfigurationDto ToDto(
        PlatformPerformanceGuardrails configuration,
        PlatformObjectiveBaselineVersion starting)
    {
        var startingMethods = PerformanceConfigurationValidator.FromMeasurementTypes(starting.MeasurementTypes);

        return new PlatformPerformanceConfigurationDto(
            configuration.Id,
            configuration.Version,
            configuration.MaxObjectivesPerPlan,
            configuration.SupportedAllowedWeightValues,
            configuration.QuantitativeAvailable,
            configuration.QualitativeAvailable,
            new StartingObjectivePlanningConfigurationDto(
                starting.Id,
                starting.VersionNumber,
                starting.MaxObjectivesPerPlan,
                starting.AllowedWeightValues,
                startingMethods.Quantitative,
                startingMethods.Qualitative,
                starting.AppliedAt),
            starting.AppliedAt,
            null,
            null);
    }
}
