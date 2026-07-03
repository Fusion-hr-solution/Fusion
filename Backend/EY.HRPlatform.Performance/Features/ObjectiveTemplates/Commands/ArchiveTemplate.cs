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

public sealed record ArchiveTemplateCommand(
    Guid TemplateId,
    ClaimsPrincipal Actor) : ICommand<Result<TemplateDto>>;

public sealed record RestoreTemplateCommand(
    Guid TemplateId,
    ClaimsPrincipal Actor) : ICommand<Result<TemplateDto>>;

public sealed class ArchiveTemplateCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit)
    : ICommandHandler<ArchiveTemplateCommand, Result<TemplateDto>>
{
    public async Task<Result<TemplateDto>> Handle(
        ArchiveTemplateCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();

        var template = await db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .FirstOrDefaultAsync(t => t.Id == command.TemplateId, cancellationToken);

        if (template is null)
            return Result.Failure<TemplateDto>(Error.NotFound("ObjectiveTemplate", command.TemplateId));

        template.Archive();

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "TemplateArchived", "ObjectiveTemplate", template.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return TemplateMapper.ToTemplateDto(template);
    }
}

public sealed class RestoreTemplateCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit,
    TemplateRevisionValidator validator)
    : ICommandHandler<RestoreTemplateCommand, Result<TemplateDto>>
{
    public async Task<Result<TemplateDto>> Handle(
        RestoreTemplateCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();

        var template = await db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .FirstOrDefaultAsync(t => t.Id == command.TemplateId, cancellationToken);

        if (template is null)
            return Result.Failure<TemplateDto>(Error.NotFound("ObjectiveTemplate", command.TemplateId));

        // A template returns to use only if its current revision is still valid under the
        // current tenant policy (P1.1 §13.10); otherwise it needs corrections first.
        if (template.ActiveRevision is { } activeRevision)
        {
            var validation = await validator.ValidateForActivationAsync(activeRevision, cancellationToken, forNewActivation: false);
            if (!validation.IsValid)
                return Result.Failure<TemplateDto>(
                    Error.Validation("ObjectiveTemplate.RestoreBlocked",
                        "This template no longer complies with the current objective policy and needs corrections before it can return to use. "
                        + string.Join(" ", validation.Errors)));
        }

        template.Restore();

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "TemplateRestored", "ObjectiveTemplate", template.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return TemplateMapper.ToTemplateDto(template);
    }
}
