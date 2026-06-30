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

public sealed record UpdateGuardrailsDraftCommand(
    ClaimsPrincipal Actor,
    CreateGuardrailsDraftRequest Request,
    uint ExpectedVersion) : ICommand<Result<GuardrailsDto>>;

public sealed class UpdateGuardrailsDraftCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit)
    : ICommandHandler<UpdateGuardrailsDraftCommand, Result<GuardrailsDto>>
{
    public async Task<Result<GuardrailsDto>> Handle(
        UpdateGuardrailsDraftCommand command,
        CancellationToken cancellationToken)
    {
        var draft = await db.PlatformPerformanceGuardrails
            .FirstOrDefaultAsync(g => g.IsDraft, cancellationToken);

        if (draft is null)
            return Result.Failure<GuardrailsDto>(
                new Error("PlatformGuardrails.DraftNotFound", "No guardrail Draft exists to update."));

        if (draft.Version != command.ExpectedVersion)
            return Result.Failure<GuardrailsDto>(
                Error.Conflict("PlatformGuardrails.ConcurrencyConflict",
                    "The guardrail Draft was modified by another request. Reload and retry."));

        var req = command.Request;
        draft.UpdateDraft(
            req.MinObjectivesPerPlan, req.MaxObjectivesPerPlan,
            req.MinManagerValidationSlaDays, req.MaxManagerValidationSlaDays,
            req.PermittedWeightDecimalPlaces, req.MaxAllowedWeightingValues,
            req.SupportedMeasurementTypes,
            req.MaxTemplateTitleLength, req.MaxTemplateDescriptionLength,
            req.MaxTemplateTags, req.ObjectiveLibraryEnabled);

        await audit.AppendPlatformAsync(
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "GuardrailDraftModified",
            "PlatformPerformanceGuardrails",
            draft.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetGuardrailsQueryHandler.ToDto(draft);
    }
}
