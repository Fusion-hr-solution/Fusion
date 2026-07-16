using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults.Commands;

public sealed record ApplyPlatformPerformanceConfigurationCommand(
    ClaimsPrincipal Actor,
    ApplyPlatformPerformanceConfigurationRequest Request,
    uint? ExpectedVersion)
    : ICommand<Result<PlatformConfigurationApplyResultDto>>;

public sealed class ApplyPlatformPerformanceConfigurationCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit,
    PerformanceConfigurationValidator validator)
    : ICommandHandler<ApplyPlatformPerformanceConfigurationCommand, Result<PlatformConfigurationApplyResultDto>>
{
    public async Task<Result<PlatformConfigurationApplyResultDto>> Handle(
        ApplyPlatformPerformanceConfigurationCommand command,
        CancellationToken cancellationToken)
    {
        var errors = validator.ValidatePlatform(command.Request).ToList();
        if (errors.Count > 0)
            return new PlatformConfigurationApplyResultDto(false, null, errors, null);

        var impact = await PlatformConfigurationImpactAnalyzer.CalculateAsync(db, command.Request, cancellationToken);
        if (impact.BlockingReasons.Count > 0)
            return new PlatformConfigurationApplyResultDto(false, null, impact.BlockingReasons, impact);

        var current = await db.PlatformPerformanceGuardrails.FirstOrDefaultAsync(cancellationToken);
        if (current is not null && command.ExpectedVersion is not null && current.Version != command.ExpectedVersion)
            return Result.Failure<PlatformConfigurationApplyResultDto>(
                Error.Conflict("PlatformPerformanceConfiguration.StaleApply",
                    "The platform configuration changed. Review the latest configuration before applying again."));

        if (current is null)
        {
            current = PlatformPerformanceGuardrails.CreateApplied(
                command.Request.MaxObjectiveCountLimit,
                PerformanceConfigurationValidator.NormalizeWeights(command.Request.SupportedAllowedWeights),
                command.Request.QuantitativeAvailable,
                command.Request.QualitativeAvailable);
            db.PlatformPerformanceGuardrails.Add(current);
        }
        else
        {
            current.Apply(
                command.Request.MaxObjectiveCountLimit,
                PerformanceConfigurationValidator.NormalizeWeights(command.Request.SupportedAllowedWeights),
                command.Request.QuantitativeAvailable,
                command.Request.QualitativeAvailable);
        }

        var baseline = await db.PlatformObjectiveBaselines
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);
        if (baseline is null)
        {
            baseline = PlatformObjectiveBaseline.Create();
            db.PlatformObjectiveBaselines.Add(baseline);
        }

        var starting = baseline.Apply(
            command.Request.StartingMaxObjectiveCount,
            PerformanceConfigurationValidator.NormalizeWeights(command.Request.StartingAllowedWeights),
            PerformanceConfigurationValidator.ToMeasurementTypes(
                command.Request.StartingQuantitativeEnabled,
                command.Request.StartingQualitativeEnabled));
        db.PlatformObjectiveBaselineVersions.Add(starting);

        await audit.AppendPlatformAsync(
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "PlatformConfigurationApplied",
            "PlatformPerformanceConfiguration",
            current.Id,
            newValue: $"max={current.MaxObjectivesPerPlan};weights={current.SupportedAllowedWeightValues};starting={starting.MaxObjectivesPerPlan}/{starting.AllowedWeightValues}/{starting.MeasurementTypes}",
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        return new PlatformConfigurationApplyResultDto(
            true,
            PlatformPerformanceConfigurationMapper.ToDto(current, starting),
            [],
            null);
    }
}

internal static class PlatformConfigurationImpactAnalyzer
{
    public static async Task<PlatformConfigurationImpactDto> CalculateAsync(
        PerformanceDbContext db,
        ApplyPlatformPerformanceConfigurationRequest request,
        CancellationToken cancellationToken)
    {
        var tenantConfigurations = await db.TenantObjectivePolicyVersions
            .IgnoreQueryFilters()
            .Where(v => v.Status == ObjectivePlanningConfigurationVersionStatus.Current)
            .ToListAsync(cancellationToken);

        var supportedWeights = request.SupportedAllowedWeights
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.Ordinal);
        var reasons = new List<string>();
        var affected = 0;

        foreach (var configuration in tenantConfigurations)
        {
            var configurationWeights = configuration.AllowedWeightValues
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var methods = PerformanceConfigurationValidator.FromMeasurementTypes(configuration.MeasurementTypes);
            var invalid = configuration.MaxObjectivesPerPlan > request.MaxObjectiveCountLimit
                || configurationWeights.Any(w => !supportedWeights.Contains(w))
                || (methods.Quantitative && !request.QuantitativeAvailable)
                || (methods.Qualitative && !request.QualitativeAvailable);

            if (!invalid)
                continue;

            affected++;
        }

        if (affected > 0)
            reasons.Add($"{affected} existing tenant configuration(s) exceed the proposed platform limits.");

        return new PlatformConfigurationImpactDto(affected, reasons);
    }
}
