using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
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
/// Atomically applies advanced platform limits in one step. Evaluates impact against active tenant policies and the standard setup; applies
/// when clean, or returns the blocking impact without persisting anything on conflict.
/// </summary>
public sealed record ApplyGuardrailsCommand(
    ClaimsPrincipal Actor,
    ApplyGuardrailsRequest Request) : ICommand<Result<GuardrailsApplyResultDto>>;

public sealed class ApplyGuardrailsCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit,
    IGuardrailImpactAnalyzer impactAnalyzer)
    : ICommandHandler<ApplyGuardrailsCommand, Result<GuardrailsApplyResultDto>>
{
    public async Task<Result<GuardrailsApplyResultDto>> Handle(
        ApplyGuardrailsCommand command,
        CancellationToken cancellationToken)
    {
        var req = command.Request;

        // Build an in-memory candidate purely to evaluate impact (not persisted unless clean).
        PlatformPerformanceGuardrails candidate;
        try
        {
            candidate = PlatformPerformanceGuardrails.CreateApplied(
                req.MinObjectivesPerPlan, req.MaxObjectivesPerPlan,
                req.MinManagerValidationSlaDays, req.MaxManagerValidationSlaDays,
                req.PermittedWeightDecimalPlaces, req.MaxAllowedWeightingValues,
                req.SupportedMeasurementTypes,
                req.MaxTemplateTitleLength, req.MaxTemplateDescriptionLength, req.MaxTemplateTags);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GuardrailsApplyResultDto>(
                Error.Validation("PlatformGuardrails.Invalid", ex.Message));
        }

        var impact = await impactAnalyzer.AnalyzeAsync(candidate, cancellationToken);
        if (impact.HasConflicts)
        {
            await audit.AppendPlatformAsync(
                command.Actor.GetUserId(),
                command.Actor.GetFullName(),
                "GuardrailApplyBlocked",
                "PlatformPerformanceGuardrails",
                candidate.Id,
                reason: impact.ToConflictSummary(),
                cancellationToken: cancellationToken);

            await db.SaveChangesAsync(cancellationToken);

            return new GuardrailsApplyResultDto(false, null, ToPreview(impact));
        }

        var current = await db.PlatformPerformanceGuardrails
            .FirstOrDefaultAsync(cancellationToken);

        PlatformPerformanceGuardrails applied;
        if (current is null)
        {
            db.PlatformPerformanceGuardrails.Add(candidate);
            applied = candidate;
        }
        else
        {
            current.Apply(
                req.MinObjectivesPerPlan, req.MaxObjectivesPerPlan,
                req.MinManagerValidationSlaDays, req.MaxManagerValidationSlaDays,
                req.PermittedWeightDecimalPlaces, req.MaxAllowedWeightingValues,
                req.SupportedMeasurementTypes,
                req.MaxTemplateTitleLength, req.MaxTemplateDescriptionLength, req.MaxTemplateTags);
            applied = current;
        }

        await audit.AppendPlatformAsync(
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "GuardrailPublished",
            "PlatformPerformanceGuardrails",
            applied.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        return new GuardrailsApplyResultDto(true, GetGuardrailsQueryHandler.ToDto(applied), null);
    }

    private static GuardrailImpactPreviewDto ToPreview(GuardrailImpactResult r) => new(
        r.HasConflicts, r.AffectedTenantPolicyCount, r.TenantPolicyConflicts, r.StandardSetupConflicts);
}
