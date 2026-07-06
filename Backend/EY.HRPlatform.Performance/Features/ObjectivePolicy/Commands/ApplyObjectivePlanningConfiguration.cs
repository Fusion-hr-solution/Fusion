using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Queries;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.ObjectivePolicy.Commands;

public sealed record ApplyObjectivePlanningConfigurationCommand(
    ClaimsPrincipal Actor,
    ApplyObjectivePlanningConfigurationRequest Request,
    uint ExpectedCurrentVersion)
    : ICommand<Result<ObjectivePlanningConfigurationApplyResultDto>>;

public sealed class ApplyObjectivePlanningConfigurationCommandHandler(
    PerformanceDbContext db,
    TenantContext tenantContext,
    IConfigurationAuditWriter audit,
    PerformanceConfigurationValidator validator)
    : ICommandHandler<ApplyObjectivePlanningConfigurationCommand, Result<ObjectivePlanningConfigurationApplyResultDto>>
{
    public async Task<Result<ObjectivePlanningConfigurationApplyResultDto>> Handle(
        ApplyObjectivePlanningConfigurationCommand command,
        CancellationToken cancellationToken)
    {
        var platform = await db.PlatformPerformanceGuardrails
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        var request = new ValidateObjectivePlanningConfigurationRequest(
            command.Request.MaxObjectiveCount,
            command.Request.AllowedWeights,
            command.Request.QuantitativeEnabled,
            command.Request.QualitativeEnabled);
        var errors = validator.ValidateTenant(request, platform);
        if (errors.Count > 0)
            return new ObjectivePlanningConfigurationApplyResultDto(false, null, [.. errors]);

        var configuration = await db.TenantObjectivePolicies
            .Include(p => p.Versions)
            .FirstOrDefaultAsync(cancellationToken);
        if (configuration?.ActiveVersion is null)
            return Result.Failure<ObjectivePlanningConfigurationApplyResultDto>(
                new Error("ObjectivePlanningConfiguration.NotConfigured",
                    "No objective planning configuration has been provisioned for this tenant."));

        var current = configuration.ActiveVersion;
        var measurementTypes = PerformanceConfigurationValidator.ToMeasurementTypes(
            command.Request.QuantitativeEnabled,
            command.Request.QualitativeEnabled);
        var normalizedWeights = PerformanceConfigurationValidator.NormalizeWeights(command.Request.AllowedWeights);

        if (current.Version != command.ExpectedCurrentVersion)
            return Result.Failure<ObjectivePlanningConfigurationApplyResultDto>(
                Error.Conflict("ObjectivePlanningConfiguration.StaleApply",
                    "The objective planning configuration changed. Review the latest configuration before applying again."));

        if (current.HasSamePlanningValues(command.Request.MaxObjectiveCount, normalizedWeights, measurementTypes))
            return new ObjectivePlanningConfigurationApplyResultDto(
                true, ObjectivePlanningConfigurationMapper.ToDto(current), []);

        var applied = configuration.ApplyConfiguration(
            command.Request.MaxObjectiveCount,
            normalizedWeights,
            measurementTypes,
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            command.Request.ChangeSummary);
        db.TenantObjectivePolicyVersions.Add(applied);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "ObjectivePlanningConfigurationApplied",
            "TenantObjectivePlanningConfiguration",
            applied.Id,
            applied.VersionNumber,
            newValue: $"max={applied.MaxObjectivesPerPlan};weights={applied.AllowedWeightValues};methods={applied.MeasurementTypes}",
            reason: command.Request.ChangeSummary,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return new ObjectivePlanningConfigurationApplyResultDto(
            true, ObjectivePlanningConfigurationMapper.ToDto(applied), []);
    }
}
