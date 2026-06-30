using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;

public sealed record ActivateTemplateRevisionCommand(
    Guid TemplateId,
    ClaimsPrincipal Actor,
    ActivateTemplateRevisionRequest Request) : ICommand<Result<TemplateDto>>;

public sealed class ActivateTemplateRevisionCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit,
    TemplateRevisionValidator validator)
    : ICommandHandler<ActivateTemplateRevisionCommand, Result<TemplateDto>>
{
    public async Task<Result<TemplateDto>> Handle(
        ActivateTemplateRevisionCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();

        var template = await db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .FirstOrDefaultAsync(t => t.Id == command.TemplateId, cancellationToken);

        if (template is null)
            return Result.Failure<TemplateDto>(Error.NotFound("ObjectiveTemplate", command.TemplateId));

        var draft = template.DraftRevision;
        if (draft is null)
            return Result.Failure<TemplateDto>(
                new Error("ObjectiveTemplate.NoDraft", "No draft revision exists to activate."));

        if (draft.Version != command.Request.ExpectedVersion)
            return Result.Failure<TemplateDto>(
                Error.Conflict("ObjectiveTemplate.Conflict",
                    "The revision has been modified by another user. Reload and try again."));

        var validation = await validator.ValidateForActivationAsync(draft, cancellationToken);
        if (!validation.IsValid)
            return Result.Failure<TemplateDto>(
                Error.Validation("ObjectiveTemplate.ValidationFailed",
                    string.Join(" ", validation.Errors)));

        var actorIdStr = actorId.ToString();
        template.ActivateRevision(actorIdStr, actorName, command.Request.ChangeSummary);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "TemplateRevisionActivated", "ObjectiveTemplate", template.Id,
            versionNumber: draft.VersionNumber,
            newValue: command.Request.ChangeSummary,
            cancellationToken: cancellationToken);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("ObjectiveTemplateRevision", draft.Id);
        }

        return TemplateMapper.ToTemplateDto(template);
    }
}
