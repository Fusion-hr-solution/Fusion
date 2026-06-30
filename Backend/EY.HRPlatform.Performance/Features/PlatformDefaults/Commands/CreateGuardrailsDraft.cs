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

public sealed record CreateGuardrailsDraftCommand(
    ClaimsPrincipal Actor,
    CreateGuardrailsDraftRequest Request) : ICommand<Result<GuardrailsDto>>;

public sealed class CreateGuardrailsDraftCommandHandler(
    PerformanceDbContext db,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreateGuardrailsDraftCommand, Result<GuardrailsDto>>
{
    public async Task<Result<GuardrailsDto>> Handle(
        CreateGuardrailsDraftCommand command,
        CancellationToken cancellationToken)
    {
        var existingDraft = await db.PlatformPerformanceGuardrails
            .FirstOrDefaultAsync(g => g.IsDraft, cancellationToken);

        if (existingDraft is not null)
            return Result.Failure<GuardrailsDto>(
                Error.Conflict("PlatformGuardrails.DraftExists", "A guardrail Draft already exists. Update or publish it."));

        var req = command.Request;
        var guardrails = PlatformPerformanceGuardrails.CreateDraft(
            req.MinObjectivesPerPlan, req.MaxObjectivesPerPlan,
            req.MinManagerValidationSlaDays, req.MaxManagerValidationSlaDays,
            req.PermittedWeightDecimalPlaces, req.MaxAllowedWeightingValues,
            req.SupportedMeasurementTypes,
            req.MaxTemplateTitleLength, req.MaxTemplateDescriptionLength,
            req.MaxTemplateTags, req.ObjectiveLibraryEnabled);

        db.PlatformPerformanceGuardrails.Add(guardrails);

        await audit.AppendPlatformAsync(
            command.Actor.GetUserId(),
            command.Actor.GetFullName(),
            "GuardrailDraftCreated",
            "PlatformPerformanceGuardrails",
            guardrails.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return GetGuardrailsQueryHandler.ToDto(guardrails);
    }
}
