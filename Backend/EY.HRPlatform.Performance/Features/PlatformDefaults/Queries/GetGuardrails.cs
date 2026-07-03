using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;

public sealed record GetGuardrailsQuery : IQuery<Result<GuardrailsDto>>;

public sealed class GetGuardrailsQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetGuardrailsQuery, Result<GuardrailsDto>>
{
    public async Task<Result<GuardrailsDto>> Handle(
        GetGuardrailsQuery request,
        CancellationToken cancellationToken)
    {
        var guardrails = await db.PlatformPerformanceGuardrails
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (guardrails is null)
            return Result.Failure<GuardrailsDto>(
                new Error("PlatformGuardrails.NotFound", "Platform guardrails have not been configured."));

        return ToDto(guardrails);
    }

    internal static GuardrailsDto ToDto(PlatformPerformanceGuardrails g) => new(
        g.Id, g.Version,
        g.MinObjectivesPerPlan, g.MaxObjectivesPerPlan,
        g.MinManagerValidationSlaDays, g.MaxManagerValidationSlaDays,
        g.PermittedWeightDecimalPlaces, g.MaxAllowedWeightingValues,
        g.SupportedMeasurementTypes,
        g.MaxTemplateTitleLength, g.MaxTemplateDescriptionLength,
        g.MaxTemplateTags);
}
