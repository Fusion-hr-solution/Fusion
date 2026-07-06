using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectivePolicy.Queries;

public sealed record GetObjectivePlanningConfigurationQuery
    : IQuery<Result<ObjectivePlanningConfigurationSummaryDto>>;

public sealed class GetObjectivePlanningConfigurationQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetObjectivePlanningConfigurationQuery, Result<ObjectivePlanningConfigurationSummaryDto>>
{
    public async Task<Result<ObjectivePlanningConfigurationSummaryDto>> Handle(
        GetObjectivePlanningConfigurationQuery query,
        CancellationToken cancellationToken)
    {
        var platform = await db.PlatformPerformanceGuardrails
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        var options = platform is null
            ? null
            : new ObjectivePlanningConfigurationOptionsDto(
                platform.MaxObjectivesPerPlan,
                platform.SupportedAllowedWeightValues,
                platform.QuantitativeAvailable,
                platform.QualitativeAvailable);

        var configuration = await db.TenantObjectivePolicies
            .AsNoTracking()
            .Include(p => p.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (configuration?.ActiveVersion is null)
            return new ObjectivePlanningConfigurationSummaryDto(false, null, options);

        return new ObjectivePlanningConfigurationSummaryDto(
            true,
            ObjectivePlanningConfigurationMapper.ToDto(configuration.ActiveVersion),
            options);
    }
}

internal static class ObjectivePlanningConfigurationMapper
{
    public static ObjectivePlanningConfigurationDto ToDto(TenantObjectivePolicyVersion version)
    {
        var methods = PerformanceConfigurationValidator.FromMeasurementTypes(version.MeasurementTypes);
        return new ObjectivePlanningConfigurationDto(
            version.Id,
            version.PolicyId,
            true,
            version.MaxObjectivesPerPlan,
            version.AllowedWeightValues,
            methods.Quantitative,
            methods.Qualitative,
            version.Version,
            version.SourceVersionId,
            version.SourceStartingConfigurationVersionId,
            version.CreatedByUserId,
            version.CreatedByName,
            version.AppliedAt,
            version.ChangeSummary);
    }
}
