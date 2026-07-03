using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;

public sealed record DeleteTemplateDraftCommand(
    Guid TemplateId,
    ClaimsPrincipal Actor) : ICommand<Result>;

/// <summary>
/// Constrained hard deletion (P1.1 §13.10): permitted only while the template has never been
/// activated and remains an unused Draft. Activated or referenced templates must be archived.
/// </summary>
public sealed class DeleteTemplateDraftCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit)
    : ICommandHandler<DeleteTemplateDraftCommand, Result>
{
    public async Task<Result> Handle(
        DeleteTemplateDraftCommand command,
        CancellationToken cancellationToken)
    {
        var template = await db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .FirstOrDefaultAsync(t => t.Id == command.TemplateId, cancellationToken);

        if (template is null)
            return Result.Failure(Error.NotFound("ObjectiveTemplate", command.TemplateId));

        if (!template.IsEligibleForHardDelete)
            return Result.Failure(
                Error.Conflict("ObjectiveTemplate.DeleteNotAllowed",
                    "This template has been activated or is in use and cannot be deleted. Archive it instead."));

        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();

        db.ObjectiveTemplateRevisions.RemoveRange(template.Revisions);
        db.ObjectiveTemplateContainers.Remove(template);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "TemplateDraftDeleted", "ObjectiveTemplate", template.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
