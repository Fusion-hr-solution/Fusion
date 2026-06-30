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

public sealed record PublishGuardrailsCommand(
    ClaimsPrincipal Actor,
    uint ExpectedVersion,
    string? ConflictOverrideReason = null) : ICommand<Result<GuardrailsDto>>;

public sealed class PublishGuardrailsCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit,
    IGuardrailImpactAnalyzer impactAnalyzer)
    : ICommandHandler<PublishGuardrailsCommand, Result<GuardrailsDto>>
{
    public async Task<Result<GuardrailsDto>> Handle(
        PublishGuardrailsCommand command,
        CancellationToken cancellationToken)
    {
        var draft = await db.PlatformPerformanceGuardrails
            .FirstOrDefaultAsync(g => g.IsDraft, cancellationToken);

        if (draft is null)
            return Result.Failure<GuardrailsDto>(
                new Error("PlatformGuardrails.DraftNotFound", "No guardrail Draft exists to publish."));

        if (draft.Version != command.ExpectedVersion)
            return Result.Failure<GuardrailsDto>(
                Error.Conflict("PlatformGuardrails.ConcurrencyConflict",
                    "The guardrail Draft was modified by another request. Reload and retry."));

        // Impact analysis: block if active tenant policies would violate the new guardrails
        var impact = await impactAnalyzer.AnalyzeAsync(draft, cancellationToken);
        if (impact.HasConflicts)
            return Result.Failure<GuardrailsDto>(
                Error.Conflict("PlatformGuardrails.ImpactConflict",
                    $"Cannot publish: {impact.AffectedTenantCount} active tenant policy/policies would violate the new guardrails. " +
                    $"Conflicts: {impact.ConflictSummary}"));

        draft.Publish();

        await audit.AppendPlatformAsync(
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "GuardrailPublished",
            "PlatformPerformanceGuardrails",
            draft.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetGuardrailsQueryHandler.ToDto(draft);
    }
}
