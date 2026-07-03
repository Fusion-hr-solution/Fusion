using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Platform;
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

/// <summary>
/// Atomically applies the standard-setup baseline in one step.
/// Validates the proposed values server-side against the current platform limits (bounds + weight
/// feasibility); applies a new version (superseding the prior, preserving history) when valid, or
/// returns the validation errors without persisting anything.
/// </summary>
public sealed record ApplyBaselineCommand(
    ClaimsPrincipal Actor,
    ApplyBaselineRequest Request) : ICommand<Result<BaselineApplyResultDto>>;

public sealed class ApplyBaselineCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit,
    PolicyValidator validator)
    : ICommandHandler<ApplyBaselineCommand, Result<BaselineApplyResultDto>>
{
    public async Task<Result<BaselineApplyResultDto>> Handle(
        ApplyBaselineCommand command,
        CancellationToken cancellationToken)
    {
        var req = command.Request;

        var guardrails = await db.PlatformPerformanceGuardrails
            .FirstOrDefaultAsync(cancellationToken);
        if (guardrails is null)
            return Result.Failure<BaselineApplyResultDto>(
                new Error("PlatformGuardrails.NotFound", "Platform limits have not been configured."));

        // Validate the proposed standard setup against the platform limits (reuses policy rules).
        var validationCandidate = TenantObjectivePolicyVersion.CreateApplied(
            Guid.NewGuid(), Guid.NewGuid(), 1,
            req.MaxObjectivesPerPlan, req.AllowedWeightValues, req.ManagerValidationSlaDays,
            req.CascadeMode, req.MeasurementTypes, req.AttachmentsEnabled,
            Guid.NewGuid(), "Platform standard setup", null);

        var validation = validator.Validate(validationCandidate, guardrails);
        if (validation.IsFailure)
            return new BaselineApplyResultDto(false, null, [validation.Error.Message]);

        var baseline = await db.PlatformObjectiveBaselines
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (baseline is null)
        {
            baseline = PlatformObjectiveBaseline.Create();
            db.PlatformObjectiveBaselines.Add(baseline);
        }

        var version = baseline.Apply(
            req.MaxObjectivesPerPlan, req.AllowedWeightValues, req.ManagerValidationSlaDays,
            req.CascadeMode, req.MeasurementTypes, req.AttachmentsEnabled);
        // The version Id is store-generated but assigned by the domain factory; without an explicit
        // Add, EF treats the non-default key as an existing row and issues an UPDATE (0 rows) instead
        // of an INSERT. Mark it Added so apply works in a single unit of work.
        db.PlatformObjectiveBaselineVersions.Add(version);

        await audit.AppendPlatformAsync(
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "BaselinePublished",
            "PlatformObjectiveBaseline",
            baseline.Id,
            versionNumber: version.VersionNumber,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        return new BaselineApplyResultDto(true, GetBaselineQueryHandler.ToDto(version), []);
    }
}
