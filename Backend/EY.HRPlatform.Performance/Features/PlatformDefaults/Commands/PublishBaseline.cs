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

public sealed record PublishBaselineCommand(
    ClaimsPrincipal Actor) : ICommand<Result<BaselineVersionDto>>;

public sealed class PublishBaselineCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit,
    PolicyValidator validator)
    : ICommandHandler<PublishBaselineCommand, Result<BaselineVersionDto>>
{
    public async Task<Result<BaselineVersionDto>> Handle(
        PublishBaselineCommand command,
        CancellationToken cancellationToken)
    {
        var baseline = await db.PlatformObjectiveBaselines
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (baseline is null || baseline.ActiveDraft is null)
            return Result.Failure<BaselineVersionDto>(
                new Error("PlatformBaseline.DraftNotFound", "No baseline Draft exists to publish."));

        var draft = baseline.ActiveDraft;

        var guardrails = await db.PlatformPerformanceGuardrails
            .FirstOrDefaultAsync(g => !g.IsDraft, cancellationToken);

        if (guardrails is not null)
        {
            var validationCandidate = Domain.Entities.TenantObjectivePolicyVersion.Create(
                Guid.NewGuid(),
                Guid.NewGuid(),
                draft.VersionNumber,
                draft.MaxObjectivesPerPlan,
                draft.AllowedWeightValues,
                draft.ManagerValidationSlaDays,
                draft.CascadeMode,
                draft.MeasurementTypes,
                draft.AttachmentsEnabled,
                Guid.NewGuid(),
                command.Actor.GetFullName());

            var validation = validator.Validate(validationCandidate, guardrails);
            if (validation.IsFailure)
                return Result.Failure<BaselineVersionDto>(
                    Error.Validation("PlatformBaseline.ValidationFailed", validation.Error.Message));
        }

        baseline.PublishDraft();

        await audit.AppendPlatformAsync(
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "BaselinePublished",
            "PlatformObjectiveBaseline",
            baseline.Id,
            versionNumber: draft.VersionNumber,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetBaselineQueryHandler.ToDto(draft);
    }
}
